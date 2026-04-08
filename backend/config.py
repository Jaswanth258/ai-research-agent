MAX_PAPERS = 5
SUMMARY_SENTENCES = 3
LOG_FILE = "logs/runs.log"

# Local Analysis Configuration
PROJECT_MODE = "PURE_LOCAL"
RElevance_THRESHOLD = 0.30

# LLM Enhancement (Featherless AI)
# Set FEATHERLESS_API_KEY in .env to enable LLM-powered synthesis.
# When set, agents use real LLM calls instead of template-based generation.
# Single agent: 1 LLM call | Multi agent: 2 specialized LLM calls
LLM_ENABLED = True  # Automatically disabled if API key is missing
