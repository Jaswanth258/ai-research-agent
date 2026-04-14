MAX_PAPERS = 5
SUMMARY_SENTENCES = 3
LOG_FILE = "logs/runs.log"

# ── Retrieval Parameters ─────────────────────────────────────────────────────
# These control how many papers each agent fetches.
# Keeping them EQUAL makes the experiment a pure architectural comparison.
# Setting them differently tests architecture + retrieval strategy combined.

MAX_QUERIES      = 4   # Max search queries generated per run
PAPERS_PER_QUERY = 5   # Max papers fetched per query from arXiv

# Relevance Thresholds (can be equalized or kept different)
SINGLE_AGENT_THRESHOLD = 0.30  # Lenient — designed to pass more papers
MULTI_AGENT_THRESHOLD  = 0.30  # Set equal to single for pure arch comparison
                                # Change to 0.35 to test stricter quality gating

# ── Experiment Modes ─────────────────────────────────────────────────────────
# EQUALIZED  → Both agents use MAX_QUERIES & PAPERS_PER_QUERY from above
#              Pure architectural comparison — recommended for research
# NATURAL    → Single uses 4q×5p, Multi uses 5q×6p (original behavior)
#              Tests real-world deployment differences
EXPERIMENT_MODE = "EQUALIZED"

# Local Analysis Configuration
PROJECT_MODE = "PURE_LOCAL"

# ── LLM Enhancement (Featherless AI) ─────────────────────────────────────────
# Set FEATHERLESS_API_KEY in .env to enable LLM-powered synthesis.
# Single agent: 1 LLM call | Multi agent: 2 specialized LLM calls
LLM_ENABLED = True  # Automatically disabled if API key is missing
