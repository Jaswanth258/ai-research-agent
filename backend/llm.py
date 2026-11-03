"""
LangChain & Featherless AI LLM Integration
OpenAI-compatible model wrappers & prompt templates using LangChain.
Set FEATHERLESS_API_KEY in .env to enable LLM-powered synthesis.
"""
import os
import hashlib
import re
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
DEFAULT_MODEL = os.getenv("FEATHERLESS_MODEL", "meta-llama/Meta-Llama-3.1-8B-Instruct")

_llm_instances: Dict[str, Any] = {}
_llm_cache: Dict[str, str] = {}

def is_available() -> bool:
    """Check if LLM integration is configured."""
    return bool(FEATHERLESS_API_KEY)

def get_chat_model(
    model: str = DEFAULT_MODEL,
    temperature: float = 0.65,
    max_tokens: int = 900
):
    """
    Get or create a LangChain ChatOpenAI instance configured for Featherless AI.
    """
    if not is_available():
        return None
    key = f"{model}:{temperature}:{max_tokens}"
    if key in _llm_instances:
        return _llm_instances[key]

    try:
        from langchain_openai import ChatOpenAI
        chat = ChatOpenAI(
            model=model,
            api_key=FEATHERLESS_API_KEY,
            base_url=FEATHERLESS_BASE_URL,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=60,
        )
        _llm_instances[key] = chat
        return chat
    except Exception as e:
        print(f"[LangChain LLM] Failed to create ChatOpenAI model: {e}")
        return None

def generate(
    prompt: str,
    system_prompt: str = "You are a helpful AI research assistant.",
    model: str = DEFAULT_MODEL,
    max_tokens: int = 900,
    temperature: float = 0.65,
) -> Optional[str]:
    """
    Generate text using LangChain ChatOpenAI pipeline with LCEL.
    Falls back gracefully if LLM is unavailable or errors occur.
    """
    if not is_available():
        return None

    cache_key = hashlib.md5(f"{model}:{system_prompt}:{prompt}:{max_tokens}:{temperature}".encode("utf-8")).hexdigest()
    if cache_key in _llm_cache:
        print("[LLM] Cache hit! Returning saved response.")
        return _llm_cache[cache_key]

    chat = get_chat_model(model=model, temperature=temperature, max_tokens=max_tokens)
    if not chat:
        return None

    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt}"),
            ("human", "{user_prompt}")
        ])
        chain = prompt_template | chat | StrOutputParser()
        result = chain.invoke({
            "system_prompt": system_prompt,
            "user_prompt": prompt
        }).strip()

        _llm_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"[LangChain LLM] Generation failed: {e}")
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


def analyze_trends_llm(topic: str, papers: list, cluster_info: str = "") -> Optional[str]:
    """
    TrendAnalyst agent: identify temporal patterns, methodology clusters,
    and emerging research directions across the approved papers.
    """
    paper_info = "\n".join([
        f"- **{p['paper']['title']}** (Score: {p['score']}) | "
        f"Authors: {', '.join(p['paper']['authors'][:2])} | "
        f"Published: {p['paper'].get('published', 'N/A')}"
        for p in papers[:8]
    ])
    
    cluster_context = f"\n\n**Empirical K-Means Clusters:**\n{cluster_info}\n" if cluster_info else ""

    prompt = (
        f"Analyze research trends across these papers on **{topic}**:\n\n"
        f"{paper_info}\n"
        f"{cluster_context}\n"
        "Provide analysis in these exact sections:\n\n"
        "### 📈 Emerging Trends\n"
        "3-4 bullet points on what's gaining traction and new directions.\n\n"
        "### 🔬 Methodology Clusters\n"
        f"{'Use the provided Empirical K-Means Clusters to accurately describe the groups of these papers.' if cluster_info else 'Group these papers by their approach (e.g., transformer-based, reinforcement learning, hybrid). 2-3 clusters with paper names.'}\n\n"
        "### 🔥 Research Hotspots\n"
        "2-3 bullet points on the most active sub-areas within this topic.\n\n"
        "### 📊 Field Maturity Assessment\n"
        "One paragraph: Is this field nascent, growing, or mature? "
        "What's the evidence from these papers?\n\n"
        "Be concise and specific. Reference actual paper titles."
    )
    return generate(
        prompt,
        system_prompt="You are a bibliometrics and research trends analyst. "
                      "Write in concise academic Markdown.",
        max_tokens=700,
        temperature=0.6,
    )


def critique_report_llm(topic: str, report: str) -> Optional[str]:
    """
    Critic agent: review the Writer's first draft and identify weaknesses.
    """
    truncated_report = report[:4000]

    prompt = (
        f"You are a senior academic editor reviewing this research report on **{topic}**:\n\n"
        f"---\n{truncated_report}\n---\n\n"
        "Provide a structured critique with:\n\n"
        "### Strengths\n"
        "2-3 things the report does well.\n\n"
        "### Weaknesses\n"
        "3-4 specific issues: missing connections, unsupported claims, "
        "vague statements, or structural problems.\n\n"
        "### Missing Elements\n"
        "2-3 things that should be added or expanded.\n\n"
        "### Revision Instructions\n"
        "3-4 concrete, actionable instructions for the writer to improve the report.\n\n"
        "Be constructive and specific. Reference sections of the report."
    )
    return generate(
        prompt,
        system_prompt="You are a rigorous academic peer reviewer. "
                      "Be critical but constructive.",
        max_tokens=600,
        temperature=0.5,
    )


def revise_report_llm(topic: str, original_report: str, critique: str,
                       trend_analysis: str = "") -> Optional[str]:
    """
    Writer agent (revision pass): improve the report based on Critic feedback
    and TrendAnalyst insights.
    """
    trunc_report = original_report[:3500]
    trunc_critique = critique[:1500]
    trunc_trends = trend_analysis[:1200] if trend_analysis else ""

    trend_section = ""
    if trunc_trends:
        trend_section = (
            f"\n\n**Trend Analysis to incorporate:**\n{trunc_trends}\n"
        )

    prompt = (
        f"Revise this research report on **{topic}** based on peer review feedback.\n\n"
        f"**Original Report:**\n---\n{trunc_report}\n---\n\n"
        f"**Peer Review Critique:**\n---\n{trunc_critique}\n---"
        f"{trend_section}\n\n"
        "Instructions:\n"
        "1. Address ALL weaknesses identified in the critique\n"
        "2. Add missing elements the reviewer identified\n"
        "3. If trend analysis is provided, integrate relevant insights\n"
        "4. Strengthen connections between papers\n"
        "5. Ensure every claim is supported by evidence from the papers\n"
        "6. Add a **Methodology Comparison** section as a markdown table\n"
        "7. Add a **Confidence Assessment** at the end (how reliable is this analysis)\n\n"
        "Output the COMPLETE revised report in Markdown. Include all original "
        "sections plus improvements."
    )
    return generate(
        prompt,
        system_prompt="You are a senior research writer producing a final, "
                      "publication-quality literature review. Write in formal "
                      "academic Markdown with rich structure.",
        max_tokens=1500,
        temperature=0.55,
    )
