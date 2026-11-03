import time
import os
from datetime import datetime
import re
from typing import List, Dict, Any, Tuple, Optional, TypedDict
from sentence_transformers import SentenceTransformer, util
from ... import config
from ...tools.search import search_papers
from ...llm import is_available as llm_available, synthesize_report_single

MODEL_NAME = "all-MiniLM-L6-v2"


class SingleAgentState(TypedDict):
    topic: str
    queries: List[str]
    raw_papers: List[Dict[str, Any]]
    ranked_papers: List[Dict[str, Any]]
    all_scored_papers: List[Dict[str, Any]]
    report: str
    llm_used: bool
    threshold: float
    max_papers: int
    date_range: Optional[str]
    processed_count: int


class SingleAgent:
    """
    Single-Agent System powered by LangGraph.
    Executes a linear computational graph:
    START -> expand_query -> search -> rank -> synthesize -> END
    """

    def __init__(self):
        self.steps: List[str] = []
        self._current_callback = None
        self.model: SentenceTransformer = self._load_model_with_retry()
        self.graph = self._build_graph()

    def _load_model_with_retry(self, max_retries: int = 3) -> SentenceTransformer:
        """Load SentenceTransformer model with retry logic."""
        for attempt in range(max_retries):
            try:
                self.log_step(f"Loading Embedding model ({attempt + 1}/{max_retries})")
                return SentenceTransformer(MODEL_NAME)
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise e
        raise RuntimeError("Failed to load model")

    def log_step(self, text: str):
        print(f"[LANGGRAPH SINGLE-AGENT STEP] {text}")
        self.steps.append(text)
        if hasattr(self, '_current_callback') and self._current_callback:
            self._current_callback(text)

    def log_to_file(self, text: str):
        os.makedirs("logs", exist_ok=True)
        with open(config.LOG_FILE, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    def _build_graph(self):
        """Construct the LangGraph StateGraph pipeline."""
        try:
            from langgraph.graph import StateGraph, START, END

            workflow = StateGraph(SingleAgentState)
            workflow.add_node("expand_query", self._expand_query_node)
            workflow.add_node("search_papers", self._search_papers_node)
            workflow.add_node("rank_papers", self._rank_papers_node)
            workflow.add_node("synthesize_report", self._synthesize_report_node)

            workflow.add_edge(START, "expand_query")
            workflow.add_edge("expand_query", "search_papers")
            workflow.add_edge("search_papers", "rank_papers")
            workflow.add_edge("rank_papers", "synthesize_report")
            workflow.add_edge("synthesize_report", END)

            return workflow.compile()
        except Exception as e:
            self.log_step(f"Warning: LangGraph initialization fallback: {e}")
            return None

    # ── LangGraph Graph Nodes ──────────────────────────────────────────────────

    def _expand_query_node(self, state: SingleAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        self.log_step(f"[LangGraph: expand_query] Expanding query locally: {topic} (max: {config.MAX_QUERIES})")
        expansions = [topic]
        lower_topic = topic.lower()

        if "detection" in lower_topic:
            expansions.append(topic.replace("detection", "identification"))
            expansions.append(topic.replace("detection", "localization"))
        if "nlp" in lower_topic or "language" in lower_topic:
            expansions.append(f"transformer {topic}")
            expansions.append(f"large language model {topic}")
        if "vision" in lower_topic or "image" in lower_topic:
            expansions.append(f"deep learning {topic}")
            expansions.append(f"convolutional neural network {topic}")

        expansions.append(f"recent advances in {topic}")
        queries = list(dict.fromkeys(expansions))[:config.MAX_QUERIES]
        return {"queries": queries}

    def _search_papers_node(self, state: SingleAgentState) -> Dict[str, Any]:
        queries = state["queries"]
        date_range = state.get("date_range")
        raw_papers = []
        processed_urls = set()

        for q in queries:
            self.log_step(f"[LangGraph: search_papers] Searching arXiv: '{q}' ({config.PAPERS_PER_QUERY} papers, date: {date_range or 'Any'})")
            try:
                papers = search_papers(q, max_results=config.PAPERS_PER_QUERY, date_range=date_range)
                for p in papers:
                    if p["url"] not in processed_urls:
                        raw_papers.append(p)
                        processed_urls.add(str(p["url"]))
            except Exception as e:
                self.log_step(f"[LangGraph: search_papers] Error retrieving '{q}': {e}")

        return {
            "raw_papers": raw_papers,
            "processed_count": len(processed_urls)
        }

    def _rank_papers_node(self, state: SingleAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        papers = state.get("raw_papers", [])
        threshold = state.get("threshold", config.SINGLE_AGENT_THRESHOLD)

        self.log_step(f"[LangGraph: rank_papers] Semantic ranking of {len(papers)} papers (MiniLM).")
        if not papers:
            return {"ranked_papers": [], "all_scored_papers": []}

        topic_emb = self.model.encode(topic, convert_to_tensor=True)
        summaries = [str(p["summary"]) for p in papers]
        paper_embs = self.model.encode(summaries, convert_to_tensor=True)

        scores = util.cos_sim(topic_emb, paper_embs)[0]

        ranked = []
        all_scored = []
        for p, s in zip(papers, scores.tolist()):
            score = round(float(s), 3)
            scored_entry = {"paper": p, "score": score, "passed": score >= threshold}
            all_scored.append(scored_entry)
            if score >= threshold:
                ranked.append({"paper": p, "score": score})

        # Deduplicate by paper title
        ranked.sort(key=lambda x: x["score"], reverse=True)
        unique_ranked = []
        seen_titles = set()
        for item in ranked:
            title = item["paper"]["title"].lower()
            if title not in seen_titles:
                unique_ranked.append(item)
                seen_titles.add(title)

        all_scored.sort(key=lambda x: x["score"], reverse=True)
        unique_all_scored = []
        seen_all = set()
        for item in all_scored:
            title = item["paper"]["title"].lower()
            if title not in seen_all:
                unique_all_scored.append(item)
                seen_all.add(title)

        return {
            "ranked_papers": unique_ranked,
            "all_scored_papers": unique_all_scored
        }

    def _synthesize_report_node(self, state: SingleAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        ranked_papers = state.get("ranked_papers", [])
        max_papers = state.get("max_papers", config.MAX_PAPERS)

        if not ranked_papers:
            return {"report": "No relevant papers found.", "llm_used": False}

        # ── Try LLM synthesis via LangChain / Featherless AI ────────────────
        if llm_available():
            self.log_step("[LangGraph: synthesize_report] 🤖 LLM synthesis via LangChain (1 unified call).")
            llm_report = synthesize_report_single(topic, ranked_papers)
            if llm_report:
                header = f"# Research Analysis: {topic}\n\n"
                paper_list = "## Top Relevant Papers\n"
                for item in ranked_papers[:max_papers]:
                    p = item["paper"]
                    paper_list += (
                        f"### {p['title']}\n"
                        f"- **Relevance Score**: {item['score']}\n"
                        f"- **Authors**: {', '.join(p['authors'][:3])}\n"
                        f"- **Link**: [{p['url']}]({p['url']})\n\n"
                    )
                return {
                    "report": header + paper_list + "\n---\n\n" + llm_report,
                    "llm_used": True
                }

        # ── Template-based fallback ──────────────────────────────────────────
        self.log_step("[LangGraph: synthesize_report] Generating template-based report (no LLM key).")
        res_list = [f"# Research Analysis for: {topic}\n\n"]
        res_list.append("## Key Summaries\n")

        for item in ranked_papers[:max_papers]:
            p = item["paper"]
            score = item["score"]
            res_list.append(f"### {p['title']}\n")
            res_list.append(f"- **Relevance Score**: {score}\n")
            res_list.append(f"- **Summary**: {p['summary'][:400]}...\n")
            res_list.append(f"- **Authors**: {', '.join(p['authors'][:3])}\n")
            res_list.append(f"- **Link**: [{p['url']}]({p['url']})\n\n")

        res_list.append("## Identified Research Gaps\n")
        patterns = [
            (r"lack of\s+([^,.]+)", "Lack of research in: {}"),
            (r"insufficient\s+([^,.]+)", "Insufficient data/study on: {}"),
            (r"limited\s+([^,.]+)", "Limited focus on: {}"),
            (r"however,\s+([^,.]+)", "Challenge noted: {}"),
            (r"but\s+([^,.]+)", "Potential limitation: {}"),
            (r"future work\s+([^,.]+)", "Suggested future direction: {}")
        ]

        all_text = " ".join([str(p["paper"]["summary"]) for p in ranked_papers[:5]])
        gaps_found = set()
        for pattern, label in patterns:
            for match in re.finditer(pattern, all_text, re.IGNORECASE):
                gap_text = match.group(1).strip()
                if 10 < len(gap_text) < 100:
                    gaps_found.add(label.format(gap_text))

        if not gaps_found:
            gaps_found = {
                "Scalability to real-world edge environments",
                "Computational efficiency in low-resource settings",
                "Robustness against diverse environmental noise"
            }

        for g in list(gaps_found)[:4]:
            res_list.append(f"- {g}\n")

        res_list.append("\n## Strategic Research Questions\n")
        res_list.append(f"- How can the current state-of-the-art in **{topic}** be optimized for real-time inference?\n")
        res_list.append(f"- What are the primary bottlenecks in the scalability of **{topic}** observed in recent works?\n")
        res_list.append(f"- How do these findings impact the practical deployment of **{topic}** in industry?\n")

        return {
            "report": "".join(res_list),
            "llm_used": False
        }

    # ── Public Runner Method ──────────────────────────────────────────────────

    def run(self, topic: str, filters: Dict[str, Any] = None, log_callback=None) -> Tuple[str, Dict[str, Any], List[str]]:
        self.steps = []
        self._current_callback = log_callback
        start_time = time.time()
        self.log_step(f"Starting Single-Agent LangGraph Research: {topic}")

        filters = filters or {}
        min_score_val = filters.get("min_score")
        threshold = float(min_score_val) if min_score_val is not None and str(min_score_val).strip() else config.SINGLE_AGENT_THRESHOLD

        max_papers_val = filters.get("max_papers")
        max_papers = int(max_papers_val) if max_papers_val is not None and str(max_papers_val).strip() else config.MAX_PAPERS

        date_range = filters.get("date_range")

        initial_state: SingleAgentState = {
            "topic": topic,
            "queries": [],
            "raw_papers": [],
            "ranked_papers": [],
            "all_scored_papers": [],
            "report": "",
            "llm_used": False,
            "threshold": threshold,
            "max_papers": max_papers,
            "date_range": date_range,
            "processed_count": 0,
        }

        if self.graph:
            final_state = self.graph.invoke(initial_state)
        else:
            # Fallback direct execution
            s1 = self._expand_query_node(initial_state)
            initial_state.update(s1)
            s2 = self._search_papers_node(initial_state)
            initial_state.update(s2)
            s3 = self._rank_papers_node(initial_state)
            initial_state.update(s3)
            s4 = self._synthesize_report_node(initial_state)
            initial_state.update(s4)
            final_state = initial_state

        end_time = time.time()
        unique_results = final_state.get("ranked_papers", [])
        llm_used = final_state.get("llm_used", False)
        unique_all_scored = final_state.get("all_scored_papers", [])
        processed_count = final_state.get("processed_count", len(unique_all_scored))

        metrics = {
            "time_taken_sec": round(float(end_time - start_time), 2),
            "total_papers_evaluated": processed_count,
            "relevant_papers_found": len(unique_results),
            "top_relevance_score": unique_results[0]["score"] if unique_results else 0,
            "llm_enhanced": llm_used,
            "llm_calls": 1 if llm_used else 0,
            "queries_used": len(final_state.get("queries", [])),
            "papers_per_query": config.PAPERS_PER_QUERY,
            "threshold": threshold,
            "max_papers_used": max_papers,
            "all_scored_papers": unique_all_scored,
            "mode": "SINGLE_AGENT_LANGGRAPH_LLM" if llm_used else "SINGLE_AGENT_LANGGRAPH_LOCAL",
        }

        self.log_to_file(
            f"\n=== LANGGRAPH SINGLE-AGENT RUN {datetime.now()} ===\nTopic: {topic}\nMetrics: {metrics}"
        )
        return final_state["report"], metrics, self.steps
