---
title: Agentic Research Bot
emoji: ⚗️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: AI-powered multi-agent research assistant
---

# ⚗️ Agentic Research Bot

An AI-powered autonomous research assistant that discovers, evaluates, and synthesizes academic papers into structured reports — powered by a **6-agent collaborative pipeline**, semantic embeddings, and large language models.

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![FAISS](https://img.shields.io/badge/FAISS-Vector_Store-FF6F00?logo=meta&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

🔗 **Live Demo**: [jaswanth258-agentic-research-bot.hf.space](https://jaswanth258-agentic-research-bot.hf.space)

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
| **Design** | Monolithic — one class does everything | **6 specialized agents** with feedback loop |
| **Query Expansion** | Heuristic-based | LLM-powered diverse queries |
| **Pipeline** | Search → Rank → Report | Planner → Researcher → Reviewer → TrendAnalyst → Writer → Critic → Writer (revised) |
| **Speed** | ~3–6 seconds | ~15–25 seconds |
| **Depth** | Fast, cost-efficient | Publication-quality peer-reviewed analysis |
| **LLM Calls** | 1 | Up to 5 (planning, trends, writing, critique, revision) |

### 🧬 Enhanced Multi-Agent Pipeline (6 Agents)

```
Planner → Researcher → Reviewer → TrendAnalyst → Writer → Critic → Writer ✍️
                                       ↑ NEW           ↑ feedback loop  ↑ NEW
```

| Agent | Role | LLM |
|-------|------|-----|
| **Planner** | Generates diverse search queries | ✅ |
| **Researcher** | Executes arXiv searches | ❌ |
| **Reviewer** | Semantic quality gate (MiniLM embeddings) | ❌ |
| **TrendAnalyst** | Identifies emerging trends, methodology clusters, field maturity | ✅ |
| **Writer** | First-draft synthesis with executive summary & gap analysis | ✅ |
| **Critic** | Peer-reviews draft → identifies weaknesses & missing elements | ✅ |
| **Writer (revision)** | Revises with critique + trends → final polished report | ✅ |

### 🔐 Authentication System
- **Email + Password** login for returning users
- **Google OAuth** — One-click sign in with Google Identity Services
- **Forgot Password** — Email OTP verification with 10-minute expiry
- **Detailed Signup** — Full profile: name, institution, role, research interests
- Premium glassmorphism UI with animated backgrounds

### 📄 Paper Analysis
- Upload any PDF research paper
- AI extracts text, identifies key insights, methodology, limitations, and future directions
- Works with both LLM-enhanced and template-based analysis

### 📊 Comparative Analysis Dashboard
- Run both agents on the same topic and compare side-by-side
- Real-time execution logging via Server-Sent Events (SSE)
- Detailed metrics: relevance scores, paper counts, execution times, agents used

### 💾 Save & Export
- **Save Draft** — Persist research to MongoDB-backed history
- **Download PDF** — Export any report as a formatted PDF document
- Personal research history with per-user authentication

### 🧠 RAG Pipeline (FAISS Vector Store)
- Papers are automatically indexed in a **FAISS** vector database after each search
- Cross-session semantic search across all previously discovered papers
- Persistent index stored on disk — grows your knowledge base over time
- API endpoint for direct semantic search: `POST /vector-store/search`

### 📈 Automated Report Evaluation
- Quantitative quality metrics computed for every generated report
- **ROUGE-1/2/L** scores measuring information coverage against source abstracts
- **Lexical Diversity** (type-token ratio) measuring vocabulary richness
- **Source Coverage** — what percentage of source papers are referenced
- **Key Term Extraction** — top domain terms identified in the report
- Side-by-side quality comparison in Compare mode

### 🐳 Docker Deployment
- One-command deployment: `docker compose up`
- Multi-stage Dockerfile (Node build + Python runtime)
- Docker Compose with MongoDB service included
- Persistent volumes for FAISS index and database

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
- **FAISS** — Vector database for RAG pipeline
- **Featherless AI** (OpenAI-compatible) — LLM synthesis
- **rouge-score** — Automated report evaluation (ROUGE-1/2/L)
- **MongoDB** + **PyMongo** — User auth & research history
- **PyPDF2** — PDF text extraction
- **bcrypt** + **PyJWT** — Authentication
- **google-auth** — Google OAuth ID token verification
- **smtplib** — SMTP email service for OTP delivery
- **Docker** + **Docker Compose** — Containerized deployment

### Frontend
- **React 19** + **Vite 8** — SPA framework & dev server
- **Axios** — API communication
- **Marked** — Markdown → HTML rendering
- **html2canvas** + **jsPDF** — PDF report generation
- **Lucide React** — Icon library
- **Google Identity Services** — Google OAuth sign-in
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
# Required
FEATHERLESS_API_KEY=your_featherless_api_key_here
FEATHERLESS_MODEL=deepseek-ai/DeepSeek-V3.2
MONGO_URI=mongodb://localhost:27017

# Google OAuth (optional — for "Sign in with Google")
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# SMTP (optional — for password reset OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_NAME=Agentic Research Bot
```

> **Note**: The app works without any optional keys. Add them for the full experience:
> - Without `FEATHERLESS_API_KEY` → Uses template-based analysis
> - Without `MONGO_URI` → Auth & history disabled
> - Without `GOOGLE_CLIENT_ID` → Google sign-in hidden
> - Without `SMTP_*` → Forgot password feature disabled

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

### 🐳 Docker Deployment (one command)

```bash
docker compose up --build
```

Open `http://localhost:8000` — the entire stack (app + MongoDB) runs in containers.

---

## 📁 Project Structure

```
agentic-research-bot/
├── backend/
│   ├── agents/
│   │   ├── single_agent/       # Monolithic agent (heuristic queries + 1 LLM call)
│   │   └── multi_agent/        # 6-agent pipeline (Planner, Researcher, Reviewer,
│   │                           #   TrendAnalyst, Writer, Critic)
│   ├── tools/
│   │   └── search.py           # arXiv API integration via feedparser
│   ├── auth.py                 # JWT + Google OAuth + OTP password reset
│   ├── email_service.py        # SMTP email service for OTP delivery
│   ├── db.py                   # MongoDB connection manager
│   ├── history.py              # Research history CRUD endpoints
│   ├── paper_analysis.py       # PDF upload & analysis endpoint
│   ├── llm.py                  # Featherless AI LLM integration (7 prompt functions)
│   ├── evaluation.py           # ROUGE scoring & report quality metrics
│   ├── vector_store.py         # FAISS vector store for RAG pipeline
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
│       │   ├── MultiAgentPage.jsx     # 6-agent architecture docs
│       │   ├── AuthPage.jsx           # Login / Sign Up / Google OAuth / OTP
│       │   ├── HistoryPage.jsx        # Saved research history
│       │   └── AboutPage.jsx          # Project information
│       ├── App.jsx                    # Root component & routing
│       └── index.css                  # Complete design system (~2700 lines)
├── main.py                     # CLI / Web entry point
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.yml          # Docker Compose orchestration
├── .env.example                # Environment template
└── start.bat                   # Windows quick-start script
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

## 🔐 Authentication Setup

### Google OAuth (optional)
1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:5173` to Authorized JavaScript origins
4. Copy Client ID to `.env` as `GOOGLE_CLIENT_ID`

### SMTP for Password Reset (optional)
1. Enable 2FA on your Gmail account
2. Create an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Add credentials to `.env` as `SMTP_USER` and `SMTP_PASSWORD`

---

## 🧪 Troubleshooting

| Issue | Solution |
|-------|----------|
| `[Errno 11001] getaddrinfo failed` | Check internet connection; disable VPN temporarily |
| Port 8000/5173 in use | Kill existing processes or change ports in `server.py` / `vite.config.js` |
| MongoDB connection failed | Ensure MongoDB is running, or remove `MONGO_URI` from `.env` to disable auth |
| LLM analysis unavailable | Add `FEATHERLESS_API_KEY` to `.env` — the app falls back to template analysis without it |
| PDF extraction fails | Ensure the PDF contains selectable text (scanned/image PDFs are not supported) |
| Google sign-in "no registered origin" | Add `http://localhost:5173` to OAuth Authorized JavaScript origins |
| Forgot password OTP not received | Verify `SMTP_USER` and `SMTP_PASSWORD` in `.env` (use Gmail App Password) |

---

## 📄 License

MIT License
