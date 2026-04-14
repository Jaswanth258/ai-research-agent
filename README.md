# ⚗️ Agentic Research Bot

An AI-powered autonomous research assistant that discovers, evaluates, and synthesizes academic papers into structured reports — powered by multi-agent architectures, semantic embeddings, and large language models.

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

---

## ✨ Features

### 🔍 AI Research Tool
- Enter any research topic and get a comprehensive literature synthesis
- Real-time arXiv paper retrieval via feedparser API
- Semantic ranking using **all-MiniLM-L6-v2** embeddings (local, no API cost)
- LLM-powered report generation via **Featherless AI**

### 🤖 Dual Agent Architecture
| | Single Agent | Multi-Agent Pipeline |
|---|---|---|
| **Design** | Monolithic — one class does everything | 4 specialized agents (Planner → Researcher → Reviewer → Writer) |
| **Query Expansion** | Heuristic-based | LLM-powered diverse queries |
| **Speed** | ~3–6 seconds | ~8–15 seconds |
| **Depth** | Fast, cost-efficient | Deeper cross-paper analysis |
| **LLM Calls** | 1 | 3 (planning, expansion, synthesis) |

### 📄 Paper Analysis
- Upload any PDF research paper
- AI extracts text, identifies key insights, methodology, limitations, and future directions
- Works with both LLM-enhanced and template-based analysis

### 📊 Comparative Analysis Dashboard
- Run both agents on the same topic and compare side-by-side
- Real-time execution logging via Server-Sent Events (SSE)
- Detailed metrics: relevance scores, paper counts, execution times

### 💾 Save & Export
- **Save Draft** — Persist research to MongoDB-backed history
- **Download PDF** — Export any report as a formatted PDF document
- Personal research history with per-user authentication

### 🎨 Modern UI
- Immersive 3D landing page with CSS perspective animations
- Dark-themed glassmorphic design system
- Real-time progress tracking with live agent logs
- Responsive layout for all screen sizes

---

## 🛠 Tech Stack

### Backend
- **Python 3.9+** — Core language
- **FastAPI** + **Uvicorn** — Async API server
- **Sentence-Transformers** (PyTorch) — Local semantic embeddings
- **Featherless AI** (OpenAI-compatible) — LLM synthesis
- **MongoDB** + **PyMongo** — User auth & research history
- **PyPDF2** — PDF text extraction
- **bcrypt** + **PyJWT** — Authentication

### Frontend
- **React 19** + **Vite 8** — SPA framework & dev server
- **Axios** — API communication
- **Marked** — Markdown → HTML rendering
- **html2canvas** + **jsPDF** — PDF report generation
- **Lucide React** — Icon library
- **Vanilla CSS** — Custom design system with 3D transforms

---

## 📋 Prerequisites

- **Python 3.9+**
- **Node.js v18+** (for Vite 8)
- **MongoDB** (local or Atlas — optional, for auth & history)
- Active internet connection (for arXiv queries & HuggingFace model download)

---

## 🚀 Installation & Setup

### 1. Clone & Backend Setup

```bash
git clone https://github.com/Jaswanth258/ai-research-agent.git
cd ai-research-agent

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy the example environment file and add your keys:

```bash
cp .env.example .env
```

Edit `.env`:
```env
FEATHERLESS_API_KEY=your_featherless_api_key_here
FEATHERLESS_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
MONGO_URI=mongodb://localhost:27017
```

> **Note**: The app works without an API key (uses template-based analysis) and without MongoDB (auth/history disabled). Add them for the full experience.

### 3. Frontend Setup

```bash
cd frontend
npm install
cd ..
```

---

## ▶️ Running the Application

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1: Backend

```bash
# From project root, with venv activated
python main.py --web
```

The FastAPI server starts on `http://127.0.0.1:8000`.

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

The Vite dev server starts on `http://localhost:5173`.

### Quick Start (Windows)

```bash
# Or use the provided script
.\start.bat
```

---

## 📁 Project Structure

```
agentic-research-bot/
├── backend/
│   ├── agents/
│   │   ├── single_agent/       # Monolithic agent (heuristic queries + 1 LLM call)
│   │   └── multi_agent/        # 4-agent pipeline (Planner, Researcher, Reviewer, Writer)
│   ├── tools/
│   │   └── search.py           # arXiv API integration via feedparser
│   ├── auth.py                 # JWT authentication (bcrypt + PyJWT)
│   ├── db.py                   # MongoDB connection manager
│   ├── history.py              # Research history CRUD endpoints
│   ├── paper_analysis.py       # PDF upload & analysis endpoint
│   ├── llm.py                  # Featherless AI LLM integration
│   ├── config.py               # Tunable parameters (thresholds, limits)
│   └── server.py               # FastAPI app, CORS, SSE streaming
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── ResearchTool.jsx       # Main research interface
│       │   └── AnalysisDashboard.jsx  # Comparative analysis dashboard
│       ├── pages/
│       │   ├── LandingPage.jsx        # 3D animated landing page
│       │   ├── PaperAnalysisPage.jsx  # PDF upload & analysis
│       │   ├── SingleAgentPage.jsx    # Single agent architecture docs
│       │   ├── MultiAgentPage.jsx     # Multi-agent architecture docs
│       │   ├── AuthPage.jsx           # Login / Sign Up
│       │   ├── HistoryPage.jsx        # Saved research history
│       │   └── AboutPage.jsx          # Project information
│       ├── App.jsx                    # Root component & routing
│       └── index.css                  # Complete design system
├── main.py                     # CLI / Web entry point
├── requirements.txt            # Python dependencies
├── .env.example                # Environment template
├── start.bat                   # Windows quick-start script
└── evaluation_guide.md         # Architecture comparison guide
```

---

## 🔧 Configuration

Key parameters can be tuned in `backend/config.py`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MAX_QUERIES` | 4 | Max search queries per run |
| `PAPERS_PER_QUERY` | 5 | Papers fetched per query |
| `SINGLE_AGENT_THRESHOLD` | 0.30 | Relevance gate for single agent |
| `MULTI_AGENT_THRESHOLD` | 0.30 | Relevance gate for multi agent |

---

## 🧪 Troubleshooting

| Issue | Solution |
|-------|----------|
| `[Errno 11001] getaddrinfo failed` | Check internet connection; disable VPN temporarily |
| Port 8000/5173 in use | Kill existing processes or change ports in `server.py` / `vite.config.js` |
| MongoDB connection failed | Ensure MongoDB is running, or remove `MONGO_URI` from `.env` to disable auth |
| LLM analysis unavailable | Add `FEATHERLESS_API_KEY` to `.env` — the app falls back to template analysis without it |
| PDF extraction fails | Ensure the PDF contains selectable text (scanned/image PDFs are not supported) |

---

## 📄 License

MIT License
