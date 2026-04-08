# Agentic Research Bot

An intelligent, autonomous AI research assistant capable of querying, evaluating, and synthesizing academic papers into comprehensive research reports.

This project features a robust Python/FastAPI backend powered by HuggingFace `sentence-transformers` for local semantic ranking of literature, and a modern, responsive React web interface for an optimal user experience.

## Features

- **Semantic Literature Ranking**: Utilizes `all-MiniLM-L6-v2` to locally rank arXiv papers against your research topic, ensuring high relevance.
- **Live Up-To-Date Research**: Utilizes the `feedparser` library to seamlessly query the **arXiv API** for the most recent academic papers.
- **Automated Research Synthesis**: Automatically extracts key summaries, identifies research gaps, and formulates strategic research questions based on retrieved papers.
- **Dual Interfaces**:
  - **Traditional CLI Mode**: Run entirely in the terminal for quick, text-based insights.
  - **Modern Web UI Mode**: A beautiful, glassmorphic React frontend for a rich, interactive experience.
- **Local-First Processing**: Designed to perform heavy lifting (like semantic embedding and gap analysis) locally on your hardware.

## Tech Stack

### Backend

- **Python 3**
- **FastAPI** & **Uvicorn**
- **Sentence-Transformers** (PyTorch)
- **HuggingFace Hub**
- **Feedparser** (arXiv API Integration)

### Frontend

- **React 19** setup with **Vite 8**
- **Axios** for API requests
- **Marked** for markdown rendering
- **Lucide-React** for beautiful icons
- Seamless Vanilla CSS with a modern dark theme

## Prerequisites

- **Python 3.9+**
- **Node.js** (v18+ recommended for Vite 8)
- Active Internet Connection (for the initial HuggingFace model download and querying arXiv)

## Installation & Setup

### 1. Backend Setup

1. Clone the repository and navigate to the project root:
   ```bash
   cd agentic-research-bot
   ```
2. Create and activate a virtual environment:
   ```powershell
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install the Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### 2. Frontend Setup

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the Node modules:
   ```bash
   npm install
   ```

## Running the Application

To run the full stack, you will need to run both the backend API and the frontend development server simultaneously.

### Start the Backend

From the project root (with your virtual environment activated):

```bash
python main.py
```

_When prompted, select **Mode 2 (Modern Web UI Mode)**._ By default, the API will start on `http://127.0.0.1:8000`.

### Start the Frontend

From the `frontend` directory:

```bash
npm run dev
```

_The Vite development server will start, typically on `http://localhost:5173`._

Open your browser and navigate to the frontend URL to start interacting with the Agentic Research Bot!

## Project Structure

```
agentic-research-bot/
├── backend/               # FastAPI backend and core Agent logic
│   ├── agents/            # Contains SingleAgent core logic
│   ├── tools/             # Contains external search tools (e.g., arXiv)
│   └── server.py          # FastAPI server configuration
├── frontend/              # Modern React UI scaffolded with Vite
│   ├── src/               # React components, styles, and assets
│   ├── package.json
│   └── vite.config.js
├── frontend_old/          # Deprecated vanilla HTML/JS UI (for backup)
├── logs/                  # Local execution logs and metrics
├── _agents/               # Internal Bot workflow rules and instructions
├── main.py                # Single entry point for both CLI and Web modes
└── requirements.txt       # Python dependencies
```

## Troubleshooting

- **`[Errno 11001] getaddrinfo failed`**: This occurs if the application cannot reach HuggingFace to download the model for the first time. Ensure you have an active internet connection, and disable restrictve VPNs or proxies temporarily.
- **Port Conflicts**: If port 8000 or 5173 are already in use, you can modify `server.py` or the Vite start script to use alternative ports. Make sure to update the CORS middleware in `server.py` if the frontend port changes.

## License

MIT License
