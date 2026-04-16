import time
import os
from datetime import datetime
import re
from typing import List, Dict, Any, Tuple, Optional
from sentence_transformers import SentenceTransformer, util
from ... import config
from ...tools.search import search_papers
from ...llm import (
    is_available as llm_available,
    expand_queries_llm,
    synthesize_report_writer,
    analyze_trends_llm,
    critique_report_llm,
    revise_report_llm,
)

MODEL_NAME = "all-MiniLM-L6-v2"


class PlannerAgent:
    def __init__(self, log_step_func):
        self.log_step = log_step_func

    def plan(self, topic: str) -> List[str]:
        # ── LLM-powered query diversification ───────────────────────────────
        if llm_available():
            self.log_step(f"[Planner] 🤖 LLM query strategy for: {topic}")
            llm_queries = expand_queries_llm(topic)
            if llm_queries:
                final = llm_queries[:config.MAX_QUERIES]
                self.log_step(f"[Planner] LLM generated {len(final)} diverse queries.")
                return final

        # ── Heuristic fallback ───────────────────────────────────────────────
        self.log_step(f"[Planner] Heuristic query expansion for: {topic} (max: {config.MAX_QUERIES} queries)")
        queries = [topic]
        lower_topic = topic.lower()

        words = topic.split()
        if len(words) > 1:
            queries.append(" AND ".join(words))

        if "detection" in lower_topic:
            queries.append(topic.replace("detection", "identification"))
            queries.append(topic.replace("detection", "localization"))
        if "nlp" in lower_topic or "language" in lower_topic:
            queries.append(f"transformer {topic}")
            queries.append(f"large language model {topic}")
        if "vision" in lower_topic or "image" in lower_topic:
            queries.append(f"deep learning {topic}")
            queries.append(f"convolutional neural network {topic}")

        queries.append(f"recent advances in {topic}")
        queries.append(f"state of the art {topic}")

        # ← controlled by config.MAX_QUERIES (shared with single agent)
        final_queries = list(dict.fromkeys(queries))[:config.MAX_QUERIES]
        self.log_step(f"[Planner] Generated {len(final_queries)} queries.")
        return final_queries


class ResearcherAgent:
    def __init__(self, log_step_func):
        self.log_step = log_step_func

    def research(self, queries: List[str], date_range: str = None) -> List[Dict[str, Any]]:
        self.log_step(f"[Researcher] Executing searches for {len(queries)} queries.")
        all_papers = []
        processed_urls = set()

        for q in queries:
            try:
                time.sleep(0.5)
                papers = search_papers(q, max_results=config.PAPERS_PER_QUERY, date_range=date_range)  # ← from config
                for p in papers:
                    if p["url"] not in processed_urls:
                        all_papers.append(p)
                        processed_urls.add(p["url"])
            except Exception as e:
                self.log_step(f"[Researcher] Error searching for '{q}': {e}")

        self.log_step(f"[Researcher] Retrieved {len(all_papers)} unique papers.")
        return all_papers


class ReviewerAgent:
    def __init__(self, log_step_func):
        self.log_step = log_step_func
        self._model = None

    def get_model(self):
        if self._model is None:
            self.log_step("[Reviewer] Loading embedding model for deep evaluation...")
            for attempt in range(3):
                try:
                    self._model = SentenceTransformer(MODEL_NAME)
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(2 ** attempt)
                    else:
                        raise e
        return self._model

    def review_and_rank(self, topic: str, papers: List[Dict[str, Any]], threshold: float = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        if threshold is None:
            threshold = config.MULTI_AGENT_THRESHOLD  # ← from config (equalized or differentiated)
        self.log_step(f"[Reviewer] Evaluating {len(papers)} papers (threshold: {threshold}).")
        if not papers:
            return []

        model = self.get_model()
        topic_emb = model.encode(topic, convert_to_tensor=True)
        summaries = [str(p["summary"]) for p in papers]
        paper_embs = model.encode(summaries, convert_to_tensor=True)

        scores = util.cos_sim(topic_emb, paper_embs)[0]

        ranked = []
        all_scored = []
        for p, s in zip(papers, scores.tolist()):
            score = round(float(s), 3)
            scored_entry = {"paper": p, "score": score, "passed": score >= threshold}
            all_scored.append(scored_entry)
            if score >= threshold:
                ranked.append({"paper": p, "score": score})

        all_scored.sort(key=lambda x: x["score"], reverse=True)
        ranked.sort(key=lambda x: x["score"], reverse=True)
        self.log_step(f"[Reviewer] Approved {len(ranked)} high-quality papers.")
        return ranked, all_scored


# ═══════════════════════════════════════════════════════════════════════════
# NEW AGENT: TrendAnalyst — Identifies temporal patterns & methodology clusters
# ═══════════════════════════════════════════════════════════════════════════

class TrendAnalystAgent:
    """Analyzes approved papers for temporal trends, methodology clusters,
    research hotspots, and field maturity. Uses 1 LLM call."""

    def __init__(self, log_step_func):
        self.log_step = log_step_func

    def analyze(self, topic: str, ranked_papers: List[Dict[str, Any]]) -> Optional[str]:
        if not llm_available() or not ranked_papers:
            self.log_step("[TrendAnalyst] Skipped (LLM unavailable or no papers).")
            return None

        self.log_step(f"[TrendAnalyst] 📈 Analyzing trends across {len(ranked_papers)} papers...")
        result = analyze_trends_llm(topic, ranked_papers)
        if result:
            self.log_step("[TrendAnalyst] Trend analysis complete.")
        else:
            self.log_step("[TrendAnalyst] ⚠️ LLM call failed — continuing without trends.")
        return result


# ═══════════════════════════════════════════════════════════════════════════
# NEW AGENT: Critic — Peer-reviews the Writer's first draft
# ═══════════════════════════════════════════════════════════════════════════

class CriticAgent:
    """Reviews the Writer's first-pass report, identifies weaknesses,
    missing elements, and provides revision instructions. Uses 1 LLM call."""

    def __init__(self, log_step_func):
        self.log_step = log_step_func

    def critique(self, topic: str, report: str) -> Optional[str]:
        if not llm_available() or not report:
            self.log_step("[Critic] Skipped (LLM unavailable or empty report).")
            return None

        self.log_step("[Critic] 🔍 Peer-reviewing the Writer's draft...")
        result = critique_report_llm(topic, report)
        if result:
            self.log_step("[Critic] Critique complete — sending feedback to Writer.")
        else:
            self.log_step("[Critic] ⚠️ LLM call failed — using first draft as final.")
        return result


class WriterAgent:
    def __init__(self, log_step_func):
        self.log_step = log_step_func

    def write_report(self, topic: str, ranked_papers: List[Dict[str, Any]], max_papers: int = config.MAX_PAPERS) -> Tuple[str, bool]:
        """
        Synthesize the first-draft report. Uses LLM if available (specialized writer prompt),
        else falls back to template. Returns (report_markdown, llm_used).
        """
        # ── LLM-powered deep synthesis ───────────────────────────────────────
        if llm_available():
            self.log_step("[Writer] 🤖 LLM deep synthesis — first draft (specialized writer prompt).")
            llm_report = synthesize_report_writer(topic, ranked_papers)
            if llm_report:
                header = f"# Multi-Agent Research Analysis: {topic}\n\n"
                header += "> *Generated by Collaborative Multi-Agent System with LLM-Enhanced Writing*\n\n"
                paper_list = "## Reviewed Papers\n"
                for item in ranked_papers[:max_papers]:
                    p = item["paper"]
                    paper_list += (
                        f"### {p['title']}\n"
                        f"- **Relevance Score**: {item['score']}\n"
                        f"- **Authors**: {', '.join(p['authors'][:3])}\n"
                        f"- **Link**: [{p['url']}]({p['url']})\n\n"
                    )
                return header + paper_list + "\n---\n\n" + llm_report, True

        # ── Template-based fallback ──────────────────────────────────────────
        self.log_step("[Writer] Generating template-based report (no LLM key).")
        res_list = [f"# Multi-Agent Research Analysis: {topic}\n\n"]
        res_list.append("> Generated by Collaborative Multi-Agent System\n\n")
        res_list.append("## Executive Summaries\n")

        for item in ranked_papers[:max_papers]:
            p = item["paper"]
            score = item["score"]
            res_list.append(f"### {p['title']}\n")
            res_list.append(f"- **Relevance Score**: {score}\n")
            res_list.append(f"- **Summary**: {p['summary'][:400]}...\n")
            res_list.append(f"- **Authors**: {', '.join(p['authors'][:3])}\n")
            res_list.append(f"- **Link**: [{p['url']}]({p['url']})\n\n")

        res_list.append("## Advanced Gap Analysis\n")
        patterns = [
            (r"lack of\s+([^,.]+)", "Lack of research in: {}"),
            (r"insufficient\s+([^,.]+)", "Insufficient data/study on: {}"),
            (r"limited\s+([^,.]+)", "Limited focus on: {}"),
            (r"however,\s+([^,.]+)", "Challenge noted: {}"),
            (r"but\s+([^,.]+)", "Potential limitation: {}"),
            (r"future work\s+([^,.]+)", "Suggested future direction: {}"),
            (r"fail to\s+([^,.]+)", "Failure to address: {}")
        ]

        all_text = " ".join([str(p["paper"]["summary"]) for p in ranked_papers[:7]])
        gaps_found = set()
        for pattern, label in patterns:
            for match in re.finditer(pattern, all_text, re.IGNORECASE):
                gap_text = match.group(1).strip()
                if 10 < len(gap_text) < 120:
                    gaps_found.add(label.format(gap_text))

        if not gaps_found:
            gaps_found = {
                "Scalability to real-world edge environments",
                "Computational efficiency in low-resource settings",
                "Robustness against diverse environmental noise",
                "Long-term stability in dynamic environments"
            }

        for g in list(gaps_found)[:5]:
            res_list.append(f"- {g}\n")

        res_list.append("\n## Critical Research Questions\n")
        res_list.append(f"- How can the findings from the top papers in **{topic}** be synthesized into a unified framework?\n")
        res_list.append(f"- What are the primary bottlenecks in the scalability of **{topic}** across these studies?\n")
        res_list.append(f"- Given the identified gaps, what novel methodologies should future researchers prioritize?\n")

        return "".join(res_list), False

    def revise_report(self, topic: str, first_draft: str,
                      critique: str, trend_analysis: str = "") -> Optional[str]:
        """Second pass: revise the report using Critic feedback + TrendAnalyst insights."""
        self.log_step("[Writer] ✍️ Revising report based on Critic feedback + Trend insights...")
        revised = revise_report_llm(topic, first_draft, critique, trend_analysis)
        if revised:
            self.log_step("[Writer] ✅ Final revised report complete (2-pass).")
        else:
            self.log_step("[Writer] ⚠️ Revision failed — using first draft as final.")
        return revised


class MultiAgent:
    def __init__(self):
        self.steps: List[str] = []
        self.planner = PlannerAgent(self.log_step)
        self.researcher = ResearcherAgent(self.log_step)
        self.reviewer = ReviewerAgent(self.log_step)
        self.trend_analyst = TrendAnalystAgent(self.log_step)
        self.writer = WriterAgent(self.log_step)
        self.critic = CriticAgent(self.log_step)

    def log_step(self, text: str):
        print(f"[MULTI-AGENT STEP] {text}")
        self.steps.append(text)
        if hasattr(self, '_current_callback') and self._current_callback:
            self._current_callback(text)

    def log_to_file(self, text: str):
        os.makedirs("logs", exist_ok=True)
        with open(config.LOG_FILE, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    def run(self, topic: str, filters: Dict[str, Any] = None, log_callback=None) -> Tuple[str, Dict[str, Any], List[str]]:
        self.steps = []  # Clear previous state
        self._current_callback = log_callback
        start_time = time.time()
        self.log_step(f"Starting Enhanced Multi-Agent Orchestration (6 agents) for: {topic}")
        
        filters = filters or {}
        min_score_val = filters.get("min_score")
        threshold = float(min_score_val) if min_score_val is not None and str(min_score_val).strip() else config.MULTI_AGENT_THRESHOLD
        
        max_papers_val = filters.get("max_papers")
        max_papers = int(max_papers_val) if max_papers_val is not None and str(max_papers_val).strip() else config.MAX_PAPERS
        
        date_range = filters.get("date_range")

        llm_calls = 0

        # ── Stage 1: Planner (may use LLM) ──────────────────────────────────
        queries = self.planner.plan(topic)
        if llm_available():
            llm_calls += 1

        # ── Stage 2: Researcher ──────────────────────────────────────────────
        raw_papers = self.researcher.research(queries, date_range=date_range)

        # ── Stage 3: Reviewer (semantic quality gate) ────────────────────────
        ranked_papers, all_scored = self.reviewer.review_and_rank(topic, raw_papers, threshold=threshold)

        if not ranked_papers:
            self.log_step("[Orchestrator] No papers passed the Reviewer's quality threshold.")
            end_time = time.time()
            metrics = {
                "time_taken_sec": round(float(end_time - start_time), 2),
                "total_papers_evaluated": len(raw_papers),
                "relevant_papers_found": 0,
                "top_relevance_score": 0,
                "llm_enhanced": False,
                "llm_calls": llm_calls,
                "agents_used": 3,
                "all_scored_papers": all_scored,
                "mode": "MULTI_AGENT_LOCAL",
            }
            return "No relevant papers found by the Multi-Agent System.", metrics, self.steps

        # ── Stage 4: TrendAnalyst (NEW — 1 LLM call) ────────────────────────
        trend_analysis = self.trend_analyst.analyze(topic, ranked_papers)
        if trend_analysis:
            llm_calls += 1

        # ── Stage 5: Writer — First Draft (1 LLM call) ──────────────────────
        report_body, llm_used = self.writer.write_report(topic, ranked_papers, max_papers=max_papers)
        if llm_used:
            llm_calls += 1

        # ── Stage 6: Critic → Writer Revision (2 LLM calls) ─────────────────
        final_report = report_body
        revision_applied = False

        if llm_used:  # Only critique+revise LLM-generated reports
            critique = self.critic.critique(topic, report_body)
            if critique:
                llm_calls += 1

                # Writer revision pass with critique + trends
                revised = self.writer.revise_report(
                    topic, report_body, critique,
                    trend_analysis=trend_analysis or ""
                )
                if revised:
                    llm_calls += 1
                    revision_applied = True
                    # Rebuild final report with header + paper list + revised body
                    header = f"# Multi-Agent Research Analysis: {topic}\n\n"
                    header += "> *Generated by 6-Agent Collaborative System — Peer-Reviewed & Revised*\n\n"
                    paper_list = "## Reviewed Papers\n"
                    for item in ranked_papers[:max_papers]:
                        p = item["paper"]
                        paper_list += (
                            f"### {p['title']}\n"
                            f"- **Relevance Score**: {item['score']}\n"
                            f"- **Authors**: {', '.join(p['authors'][:3])}\n"
                            f"- **Link**: [{p['url']}]({p['url']})\n\n"
                        )

                    # Inject trend analysis as its own section if available
                    trend_section = ""
                    if trend_analysis:
                        trend_section = (
                            "\n---\n\n## 📈 Research Trend Analysis\n\n"
                            + trend_analysis
                            + "\n"
                        )

                    final_report = (
                        header + paper_list
                        + "\n---\n\n" + revised
                        + trend_section
                    )

        end_time = time.time()

        agents_used = 4  # Planner + Researcher + Reviewer + Writer (always)
        if trend_analysis:
            agents_used += 1
        if revision_applied:
            agents_used += 1  # Critic counted (Writer revision is same Writer)

        metrics = {
            "time_taken_sec": round(float(end_time - start_time), 2),
            "total_papers_evaluated": len(raw_papers),
            "relevant_papers_found": len(ranked_papers),
            "top_relevance_score": ranked_papers[0]["score"] if ranked_papers else 0,
            "llm_enhanced": llm_used,
            "llm_calls": llm_calls,
            "agents_used": agents_used,
            "revision_applied": revision_applied,
            "trend_analysis": bool(trend_analysis),
            "queries_used": len(queries),
            "papers_per_query": config.PAPERS_PER_QUERY,
            "threshold": threshold,
            "max_papers_used": max_papers,
            "all_scored_papers": all_scored,
            "mode": "MULTI_AGENT_LLM_6" if revision_applied else ("MULTI_AGENT_LLM" if llm_used else "MULTI_AGENT_LOCAL"),
        }

        self.log_to_file(
            f"\n=== MULTI-AGENT RUN {datetime.now()} ===\nTopic: {topic}\nMetrics: {metrics}"
        )
        return final_report, metrics, self.steps

