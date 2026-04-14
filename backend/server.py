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
import os

from fastapi.middleware.cors import CORSMiddleware

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

# Mount static files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return f.read()

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
            
                return {
                    "comparison": True,
                    "single": {
                        "report": single_res[0],
                        "metrics": single_res[1],
                        "steps": single_res[2]
                    },
                    "multi": {
                        "report": multi_res[0],
                        "metrics": multi_res[1],
                        "steps": multi_res[2]
                    }
                }
            else:
                agent = multi_agent if mode == "multi" else single_agent
                report, metrics, steps = await loop.run_in_executor(None, agent.run, topic, filters, make_callback())
                
                return {
                    "comparison": False,
                    "report": report,
                    "metrics": metrics,
                    "steps": steps
                }
        finally:
            if run_id and run_id in log_queues:
                log_queues[run_id].put_nowait("[DONE]")
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Research failed: {str(e)}"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
