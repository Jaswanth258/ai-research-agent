"""
Featherless AI LLM Integration
OpenAI-compatible API wrapper for enhanced agent reasoning.
Set FEATHERLESS_API_KEY in .env to enable LLM-powered synthesis.
"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
DEFAULT_MODEL = os.getenv("FEATHERLESS_MODEL", "meta-llama/Meta-Llama-3.1-8B-Instruct")

_client = None

def get_client():
    """Get or create the OpenAI-compatible client for Featherless AI."""
    global _client
    if not FEATHERLESS_API_KEY:
        return None
    if _client is None:
        try:
            from openai import OpenAI
            _client = OpenAI(
                api_key=FEATHERLESS_API_KEY,
                base_url=FEATHERLESS_BASE_URL,
            )
        except ImportError:
            print("[LLM] openai package not installed. Run: pip install openai")
            return None
        except Exception as e:
            print(f"[LLM] Failed to create client: {e}")
            return None
    return _client

def is_available() -> bool:
    """Check if LLM integration is configured."""
    return bool(FEATHERLESS_API_KEY)

def generate(
    prompt: str,
    system_prompt: str = "You are a helpful AI research assistant.",
    model: str = DEFAULT_MODEL,
    max_tokens: int = 900,
    temperature: float = 0.65,
) -> Optional[str]:
    """
    Generate text using Featherless AI.
    Returns None if LLM is unavailable — callers should fall back to templates.
    """
    client = get_client()
    if not client:
        return None

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[LLM] Generation failed: {e}")
        return None


# ── Specialized prompt helpers ──────────────────────────────────────────────

def expand_queries_llm(topic: str) -> Optional[list]:
    """
    Ask the LLM to generate diverse academic search queries.
    Used by PlannerAgent in the multi-agent system.
    """
    prompt = (
        f"Generate exactly 5 diverse and targeted academic search queries for the topic: '{topic}'.\n"
        "Each query should approach the topic from a different angle (e.g., methods, applications, datasets, surveys, limitations).\n"
        "Return ONLY the 5 queries, one per line, no numbering or extra text."
    )
    result = generate(
        prompt,
        system_prompt="You are an expert academic search strategist. Output only the queries.",
        max_tokens=200,
        temperature=0.75,
    )
    if not result:
        return None
    import re
    cleaned_queries = []
    for line in result.strip().splitlines():
        # Strip bullets (-, *), numbering (1., 1)), and extra whitespace
        q = re.sub(r"^(\d+[\.\)]\s*|[-*]\s*)", "", line.strip())
        # Strip surrounding quotes often added by LLMs
        q = q.strip('"\'')
        if q and len(q) > 2 and not q.lower().startswith("here are"):
            cleaned_queries.append(q)
            
    return cleaned_queries[:5] if cleaned_queries else None


def synthesize_report_single(topic: str, papers: list) -> Optional[str]:
    """
    Single-agent LLM synthesis: one comprehensive call with all papers.
    """
    paper_summaries = "\n\n".join([
        f"**Paper {i+1}: {p['paper']['title']}** (Score: {p['score']})\n"
        f"Authors: {', '.join(p['paper']['authors'][:2])}\n"
        f"Summary: {p['paper']['summary'][:350]}"
        for i, p in enumerate(papers[:5])
    ])

    prompt = (
        f"You are analyzing {len(papers)} research papers on the topic: **{topic}**\n\n"
        f"{paper_summaries}\n\n"
        "Write a comprehensive research analysis in Markdown with these sections:\n"
        "1. **Key Findings** — What the top papers collectively reveal\n"
        "2. **Research Gaps** — What challenges or gaps remain (be specific, not generic)\n"
        "3. **Strategic Research Questions** — 3 forward-looking questions for future researchers\n"
        "Keep it concise, academic, and insightful. Use bullet points where appropriate."
    )
    return generate(
        prompt,
        system_prompt="You are an expert AI research analyst. Write in formal academic Markdown.",
        max_tokens=900,
    )


def synthesize_report_writer(topic: str, papers: list) -> Optional[str]:
    """
    Multi-agent WriterAgent LLM synthesis: specialized deeper analysis.
    """
    paper_summaries = "\n\n".join([
        f"**Paper {i+1}: {p['paper']['title']}** (Score: {p['score']})\n"
        f"Authors: {', '.join(p['paper']['authors'][:2])}\n"
        f"Abstract: {p['paper']['summary'][:380]}"
        for i, p in enumerate(papers[:5])
    ])

    prompt = (
        f"As a specialized research writer, synthesize these top papers on **{topic}**:\n\n"
        f"{paper_summaries}\n\n"
        "Produce a structured Markdown report with:\n"
        "1. **Executive Summary** — 2-3 sentences on the state of the field\n"
        "2. **Synthesis of Key Insights** — Cross-paper patterns and themes\n"
        "3. **Advanced Gap Analysis** — Specific limitations and open problems\n"
        "4. **Critical Research Questions** — 3 pressing questions the field must address\n"
        "5. **Recommended Directions** — 2 concrete next steps for researchers\n"
        "Be analytical and precise. Draw connections between papers where possible."
    )
    return generate(
        prompt,
        system_prompt="You are a senior AI researcher writing a literature synthesis. Use formal academic Markdown.",
        max_tokens=1000,
    )


def analyze_paper_llm(text: str, filename: str = "Uploaded Paper") -> Optional[str]:
    """
    Analyze a research paper's extracted text.
    Produces a structured report with summary, key insights, and research gaps.
    """
    # Truncate to avoid exceeding token limits (roughly 6000 chars ≈ 1500 tokens)
    truncated = text[:6000]
    if len(text) > 6000:
        truncated += "\n\n[... text truncated for analysis ...]"

    prompt = (
        f"You are analyzing a research paper titled/file: **{filename}**\n\n"
        f"Here is the extracted text from the paper:\n\n"
        f"---\n{truncated}\n---\n\n"
        "Produce a comprehensive analysis in Markdown with these sections:\n\n"
        "## 📄 Paper Summary\n"
        "A concise 3-5 sentence overview of the paper's objective, methodology, and main contribution.\n\n"
        "## 🔑 Key Insights\n"
        "5-7 bullet points highlighting the most important findings, contributions, and novel ideas.\n\n"
        "## 🔬 Methodology Analysis\n"
        "Briefly describe the research methodology, experimental setup, and evaluation approach.\n\n"
        "## ⚠️ Research Gaps & Limitations\n"
        "4-6 bullet points identifying limitations, assumptions, missing comparisons, or areas for improvement.\n\n"
        "## 🚀 Future Research Directions\n"
        "3-4 concrete suggestions for extending this work.\n\n"
        "Be analytical, specific, and academic. Reference specific details from the paper text."
    )
    return generate(
        prompt,
        system_prompt="You are an expert academic peer reviewer. Provide rigorous, constructive analysis in formal Markdown.",
        max_tokens=1200,
        temperature=0.5,
    )
