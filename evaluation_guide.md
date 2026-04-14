# Agentic Research Bot: Project Evaluation Guide

## 1. Problem Statement
In the rapidly accelerating field of academic research, researchers and developers face severe information overload. Finding, filtering, and synthesizing highly specialized academic literature from repositories like arXiv takes hours of manual effort. Traditional keyword-based search heuristic tools often miss lateral, cross-disciplinary connections, while feeding raw search results directly to Large Language Models (LLMs) leads to context-window overflow, high API costs, and hallucinations. There is a critical need for an automated, intelligent pipeline that can act as an autonomous research assistant—capable of intelligently planning searches, aggressively filtering noise using local semantics, and generating high-quality synthesized reports.

## 2. Overview
The **Agentic Research Bot** is a full-stack, AI-powered web application designed to autonomously conduct deep-dive academic research. It provides a robust comparison between two distinct AI architectures: a traditional **Single-Agent System** and an advanced **Multi-Agent Orchestrator**. 

By integrating real-time API queries to arXiv with local, privacy-preserving semantic vector embeddings, the bot evaluates the relevance of hundreds of papers before selecting the top candidates. These candidates are then passed to a high-reasoning LLM to extract key summaries, identify current research gaps, and formulate strategic questions. The application is completely decoupled, featuring a Python/FastAPI backend and a modern React/Vite frontend wrapper containing live streaming, user authentication, and persistent research history.

## 3. Workflow

The application supports evaluating and comparing two different research workflows:

### A. Single-Agent Workflow (The Baseline)
1. **Heuristic Expansion**: Takes the user's topic and applies hard-coded keyword rules (e.g., adding "deep learning" or "transformer" to specific domain queries) to generate search variations.
2. **Data Retrieval**: Executes queries concurrently against the arXiv API to fetch up to 30 raw candidate papers.
3. **Local Semantic Ranking**: Feeds the abstracts into a local embedding model to score them against the original user prompt.
4. **LLM Synthesis**: Passes the top-scoring papers into a single LLM prompt to generate a final markdown report.

### B. Multi-Agent Orchestrator Workflow (The Advanced Approach)
This workflow isolates cognitive tasks into four specialized "agents", executing sequentially:
1. **The Planner Agent**: Breaks free of rigid heuristics by utilizing the LLM to intellectually draft up to 5 highly diverse, lateral-thinking search queries based on the user's core intent.
2. **The Researcher Agent**: A pure execution function that hits the arXiv API with the Planner's queries, gathering candidates while deduplicating URLs.
3. **The Reviewer Agent**: The strict quality gatekeeper. It uses local vector semantics (`all-MiniLM-L6-v2`) to aggressively score candidate abstracts against the prompt. Any paper scoring below a strict 0.35 threshold is discarded.
4. **The Writer Agent**: Takes only the highest-quality surviving papers and uses a specialized prompt to generate an executive summary, cross-paper gap analysis, and future research formulations.

## 4. Technologies Used

### Backend Stack
*   **Python 3 & FastAPI**: Core backend framework for high-speed, asynchronous API routing.
*   **MongoDB (Local)**: NoSQL database used to persist user accounts, bcrypt-hashed passwords, and JWT-authenticated research history.
*   **HuggingFace `sentence-transformers`**: Provides the PyTorch-based `all-MiniLM-L6-v2` model for lightning-fast, local NLP vector embeddings.
*   **Featherless AI**: OpenAI-compatible API wrapper used to interface with the state-of-the-art **DeepSeek-V3.2** LLM.
*   **Feedparser**: Used to parse raw XML atom feeds from the arXiv academic database.

### Frontend Stack
*   **React 19 & Vite 8**: Modern frontend toolchain for incredibly fast Hot Module Replacement (HMR) and optimized building.
*   **Axios**: Promise-based HTTP client for intercepting requests and attaching JWT Authorization headers.
*   **Server-Sent Events (SSE)**: EventSource integration allowing the frontend to stream real-time `[STEP]` logs dynamically as the backend agents "think".
*   **Lucide-React & Marked**: Provides crisp vector icons and secure markdown-to-HTML rendering for the final generated reports.

## 5. How They Are Used and Implemented

*   **Cost-Efficient LLM Usage (Embeddings Implementation)**: Instead of passing 30 full abstracts directly to the `DeepSeek` LLM (which consumes massive token bandwidth and degrades reasoning), t  he system routes them through the local `sentence-transformers` model. By converting text to tensors and running Cosine Similarity calculations, the system mathematically ranks the papers on the user's hardware. Only the top 5 papers are serialized and sent to the LLM, resulting in cheaper, faster, and highly precise outputs.

*   **Real-time AI Transparency (SSE Implementation)**: Because multi-agent research can take 15-30 seconds, traditional HTTP requests would timeout or leave the user staring at a static loading bar. The backend implements `StreamingResponse` via Python's `asyncio.Queue`. Each agent pushes a text element into the queue as they work, which is piped via SSE to the React frontend in real-time, displaying a dynamic terminal-like log sequence.

*   **Stateful Autonomy (Auth & DB Implementation)**: The application features a fully independent auth system in `auth.py`. User credentials are encrypted using `bcrypt`, and a 24-hour JSON Web Token (JWT) is issued. The React frontend stores this in `localStorage` securely locked to the port. All subsequent calls to generate or fetch research attach this token, allowing the `history.py` router to save vast JSON payloads of research data natively into MongoDB documents tied to that specific user email.

*   **Process Stability (DevOps Implementation)**: To prevent port-clashing—a common issue where Zombie Node or Uvicorn processes trap ports 5173 and 8000—a custom `start.bat` script actively sweeps local Windows network states via `netstat` and aggressively kills orphaned PIDs before seamlessly bootstrapping both servers.
