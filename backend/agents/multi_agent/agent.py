import time
import os
from datetime import datetime
import re
from typing import List, Dict, Any, Tuple
from sentence_transformers import SentenceTransformer, util
from ... import config
from ...tools.search import search_papers
from ...llm import is_available as llm_available, expand_queries_llm, synthesize_report_writer

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
                self.log_step(f"[Planner] LLM generated {len(llm_queries)} diverse queries.")
                return llm_queries

        # ── Heuristic fallback ───────────────────────────────────────────────
        self.log_step(f"[Planner] Heuristic query expansion for: {topic}")
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

        final_queries = list(dict.fromkeys(queries))[:5]
        self.log_step(f"[Planner] Generated {len(final_queries)} queries.")
        return final_queries


class ResearcherAgent:
    def __init__(self, log_step_func):
        self.log_step = log_step_func

    def research(self, queries: List[str]) -> List[Dict[str, Any]]:
        self.log_step(f"[Researcher] Executing searches for {len(queries)} queries.")
        all_papers = []
        processed_urls = set()

        for q in queries:
            try:
                time.sleep(0.5)
                papers = search_papers(q, max_results=6)
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

    def review_and_rank(self, topic: str, papers: List[Dict[str, Any]], threshold: float = 0.35) -> List[Dict[str, Any]]:
        self.log_step(f"[Reviewer] Evaluating {len(papers)} papers (threshold: {threshold}).")
        if not papers:
            return []

        model = self.get_model()
        topic_emb = model.encode(topic, convert_to_tensor=True)
        summaries = [str(p["summary"]) for p in papers]
        paper_embs = model.encode(summaries, convert_to_tensor=True)

        scores = util.cos_sim(topic_emb, paper_embs)[0]

        ranked = []
        for p, s in zip(papers, scores.tolist()):
            score = round(float(s), 3)
            if score >= threshold:
                ranked.append({"paper": p, "score": score})

        self.log_step(f"[Reviewer] Approved {len(ranked)} high-quality papers.")
        return sorted(ranked, key=lambda x: x["score"], reverse=True)


class WriterAgent:
    def __init__(self, log_step_func):
        self.log_step = log_step_func

    def write_report(self, topic: str, ranked_papers: List[Dict[str, Any]]) -> Tuple[str, bool]:
        """
        Synthesize the final report. Uses LLM if available (specialized writer prompt),
        else falls back to template. Returns (report_markdown, llm_used).
        """
        # ── LLM-powered deep synthesis ───────────────────────────────────────
        if llm_available():
            self.log_step("[Writer] 🤖 LLM deep synthesis (specialized writer prompt).")
            llm_report = synthesize_report_writer(topic, ranked_papers)
            if llm_report:
                header = f"# Multi-Agent Research Analysis: {topic}\n\n"
                header += "> *Generated by Collaborative Multi-Agent System with LLM-Enhanced Writing*\n\n"
                paper_list = "## Reviewed Papers\n"
                for item in ranked_papers[:config.MAX_PAPERS]:
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

        for item in ranked_papers[:config.MAX_PAPERS]:
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


class MultiAgent:
    def __init__(self):
        self.steps: List[str] = []
        self.planner = PlannerAgent(self.log_step)
        self.researcher = ResearcherAgent(self.log_step)
        self.reviewer = ReviewerAgent(self.log_step)
        self.writer = WriterAgent(self.log_step)

    def log_step(self, text: str):
        print(f"[MULTI-AGENT STEP] {text}")
        self.steps.append(text)

    def log_to_file(self, text: str):
        os.makedirs("logs", exist_ok=True)
        with open(config.LOG_FILE, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    def run(self, topic: str) -> Tuple[str, Dict[str, Any], List[str]]:
        start_time = time.time()
        self.log_step(f"Starting Multi-Agent Orchestration for: {topic}")

        # 1. Planner (may use LLM)
        queries = self.planner.plan(topic)

        # 2. Researcher
        raw_papers = self.researcher.research(queries)

        # 3. Reviewer (semantic quality gate)
        ranked_papers = self.reviewer.review_and_rank(topic, raw_papers)

        if not ranked_papers:
            self.log_step("[Orchestrator] No papers passed the Reviewer's quality threshold.")
            return "No relevant papers found by the Multi-Agent System.", {"papers": 0}, self.steps

        # 4. Writer (may use LLM)
        report_body, llm_used = self.writer.write_report(topic, ranked_papers)

        end_time = time.time()

        # LLM call count: Planner (1) + Writer (1) = 2, if LLM was used
        llm_calls = 2 if llm_used else 0

        metrics = {
            "time_taken_sec": round(float(end_time - start_time), 2),
            "total_papers_evaluated": len(raw_papers),
            "relevant_papers_found": len(ranked_papers),
            "top_relevance_score": ranked_papers[0]["score"] if ranked_papers else 0,
            "llm_enhanced": llm_used,
            "llm_calls": llm_calls,
            "mode": "MULTI_AGENT_LLM" if llm_used else "MULTI_AGENT_LOCAL",
        }

        self.log_to_file(
            f"\n=== MULTI-AGENT RUN {datetime.now()} ===\nTopic: {topic}\nMetrics: {metrics}"
        )
        return report_body, metrics, self.steps
