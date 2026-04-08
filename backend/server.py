from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
from typing import List, Dict, Any
from .agents.single_agent.agent import SingleAgent
from .agents.multi_agent.agent import MultiAgent
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

# Initialize Agents
single_agent = SingleAgent()
multi_agent = MultiAgent()


# Mount static files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return f.read()

@app.post("/research")
async def perform_research(request: Request):
    try:
        data = await request.json()
        topic = data.get("topic")
        mode = data.get("mode", "single")
        
        if not topic:
            raise HTTPException(status_code=400, detail="Topic is required")
        
        loop = asyncio.get_event_loop()
        
        if mode == "compare":
            single_task = loop.run_in_executor(None, single_agent.run, topic)
            multi_task = loop.run_in_executor(None, multi_agent.run, topic)
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
            report, metrics, steps = await loop.run_in_executor(None, agent.run, topic)
            
            return {
                "comparison": False,
                "report": report,
                "metrics": metrics,
                "steps": steps
            }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Research failed: {str(e)}"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
