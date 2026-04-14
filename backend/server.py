from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
from typing import List, Dict, Any
from .agents.single_agent.agent import SingleAgent
from .agents.multi_agent.agent import MultiAgent
from .auth import router as auth_router
from .history import router as history_router
from .paper_analysis import router as paper_router
from .evaluation import evaluate_report
from .vector_store import get_store, FAISS_AVAILABLE
import os

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Agentic Research Bot UI")

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Auth Router
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Include History Router
app.include_router(history_router, prefix="/history", tags=["History"])

# Include Paper Analysis Router
app.include_router(paper_router, prefix="/paper", tags=["Paper Analysis"])

# Initialize Agents
single_agent = SingleAgent()
multi_agent = MultiAgent()

log_queues: Dict[str, asyncio.Queue] = {}

# Mount static files — serve dist/ in production (Docker), frontend/ in dev
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DIST_DIR = os.path.join(PROJECT_ROOT, "frontend", "dist")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

if os.path.isdir(DIST_DIR):
    # Production mode: serve built frontend
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/", response_class=HTMLResponse)
    async def read_root():
        index_path = os.path.join(DIST_DIR, "index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            return f.read()
else:
    # Dev mode: just serve a placeholder (frontend runs on Vite dev server)
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def read_root():
        return "<html><body><h1>Backend running. Use Vite dev server at :5173</h1></body></html>"


@app.get("/stream/{run_id}")
async def stream_logs(request: Request, run_id: str):
    if run_id not in log_queues:
        log_queues[run_id] = asyncio.Queue()
    
    async def event_generator():
        q = log_queues[run_id]
        try:
            while True:
                if await request.is_disconnected():
                    break
                msg = await q.get()
                if msg == "[DONE]":
                    yield "data: [DONE]\n\n"
                    break
                # Replacing newlines to keep it one SSE data line, though not strictly required
                clean_msg = msg.replace('\n', ' ')
                yield f"data: {clean_msg}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if run_id in log_queues:
                del log_queues[run_id]
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _extract_eval_data(result_data: dict) -> dict:
    """Extract evaluation data from a research result and compute quality metrics."""
    report = result_data.get("report", "")
    papers = result_data.get("metrics", {}).get("all_scored_papers", [])

    abstracts = [p["paper"].get("summary", "") for p in papers if p.get("passed")]
    titles = [p["paper"].get("title", "") for p in papers if p.get("passed")]

    return evaluate_report(report, source_abstracts=abstracts, paper_titles=titles)


def _index_papers(result_data: dict):
    """Add discovered papers to the FAISS vector store."""
    if not FAISS_AVAILABLE:
        return 0

    store = get_store()
    papers = result_data.get("metrics", {}).get("all_scored_papers", [])
    raw_papers = [p["paper"] for p in papers]

    return store.add_papers(raw_papers)


@app.post("/research")
async def perform_research(request: Request):
    try:
        data = await request.json()
        topic = data.get("topic")
        mode = data.get("mode", "single")
        
        # Extract advanced filters
        filters = {
            "min_score": data.get("min_score"),
            "max_papers": data.get("max_papers"),
            "date_range": data.get("date_range")
        }
        
        run_id = data.get("run_id")
        
        if not topic:
            raise HTTPException(status_code=400, detail="Topic is required")
        
        loop = asyncio.get_event_loop()
        
        if run_id and run_id not in log_queues:
            log_queues[run_id] = asyncio.Queue()
            
        def make_callback(prefix=""):
            def callback(msg):
                if run_id and run_id in log_queues:
                    loop.call_soon_threadsafe(log_queues[run_id].put_nowait, f"{prefix}{msg}")
            return callback
        
        try:
            if mode == "compare":
                single_task = loop.run_in_executor(None, single_agent.run, topic, filters, make_callback("[Single] "))
                multi_task = loop.run_in_executor(None, multi_agent.run, topic, filters, make_callback("[Multi] "))
                single_res, multi_res = await asyncio.gather(single_task, multi_task)
            
                single_data = {
                    "report": single_res[0],
                    "metrics": single_res[1],
                    "steps": single_res[2]
                }
                multi_data = {
                    "report": multi_res[0],
                    "metrics": multi_res[1],
                    "steps": multi_res[2]
                }

                # Evaluate both reports
                single_data["quality_metrics"] = _extract_eval_data(single_data)
                multi_data["quality_metrics"] = _extract_eval_data(multi_data)

                # Index papers in FAISS
                _index_papers(single_data)
                _index_papers(multi_data)

                return {
                    "comparison": True,
                    "single": single_data,
                    "multi": multi_data,
                }
            else:
                agent = multi_agent if mode == "multi" else single_agent
                report, metrics, steps = await loop.run_in_executor(None, agent.run, topic, filters, make_callback())
                
                result = {
                    "comparison": False,
                    "report": report,
                    "metrics": metrics,
                    "steps": steps
                }

                # Evaluate report quality
                result["quality_metrics"] = _extract_eval_data(result)

                # Index papers in FAISS
                _index_papers(result)

                return result
        finally:
            if run_id and run_id in log_queues:
                log_queues[run_id].put_nowait("[DONE]")
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Research failed: {str(e)}"}
        )


# ── Vector Store Endpoints ───────────────────────────────────────────────────

@app.get("/vector-store/stats")
async def vector_store_stats():
    """Return FAISS index statistics."""
    store = get_store()
    return store.get_stats()


class VectorSearchRequest(BaseModel):
    query: str
    top_k: int = 10


@app.post("/vector-store/search")
async def vector_store_search(req: VectorSearchRequest):
    """Semantic search across all indexed papers."""
    store = get_store()
    results = store.search(req.query, top_k=req.top_k)
    return {"results": results, "total_indexed": store.get_stats()["total_papers"]}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
