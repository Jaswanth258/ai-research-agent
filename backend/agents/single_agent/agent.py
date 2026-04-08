import time
import os
from datetime import datetime
import re
import json
from typing import List, Dict, Any, Tuple, Optional
from sentence_transformers import SentenceTransformer, util
from ... import config
from ...tools.search import search_papers
from ...llm import is_available as llm_available, synthesize_report_single

MODEL_NAME = "all-MiniLM-L6-v2"

class SingleAgent:
    def __init__(self):
        self.steps: List[str] = []
        self.model: SentenceTransformer = self._load_model_with_retry()
        self.all_papers: Dict[str, Any] = {}

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
        print(f"[STEP] {text}")
        self.steps.append(text)

    def log_to_file(self, text: str):
        os.makedirs("logs", exist_ok=True)
        with open(config.LOG_FILE, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    def expand_query(self, topic: str) -> List[str]:
        """Local-only query expansion using domain heuristics."""
        self.log_step(f"Expanding query locally: {topic}")
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
        return list(dict.fromkeys(expansions))[:4]

    def rank_papers(self, topic: str, papers: List[Dict[str, Any]], threshold: float = 0.30) -> List[Dict[str, Any]]:
        self.log_step(f"Semantic ranking of {len(papers)} papers (MiniLM).")
        if not papers:
            return []

        topic_emb = self.model.encode(topic, convert_to_tensor=True)
        summaries = [str(p["summary"]) for p in papers]
        paper_embs = self.model.encode(summaries, convert_to_tensor=True)

        scores = util.cos_sim(topic_emb, paper_embs)[0]

        ranked = []
        for p, s in zip(papers, scores.tolist()):
            score = round(float(s), 3)
            if score >= threshold:
                ranked.append({"paper": p, "score": score})

        return sorted(ranked, key=lambda x: x["score"], reverse=True)

    def analyze_results(self, topic: str, ranked_papers: List[Dict[str, Any]]) -> Tuple[str, bool]:
        """
        Generate analysis report. Uses LLM if available, else falls back to templates.
        Returns (report_markdown, llm_used).
        """
        # ── Try LLM-enhanced synthesis ──────────────────────────────────────
        if llm_available():
            self.log_step("🤖 LLM synthesis via Featherless AI (1 unified call).")
            llm_report = synthesize_report_single(topic, ranked_papers)
            if llm_report:
                header = f"# Research Analysis: {topic}\n\n"
                paper_list = "## Top Relevant Papers\n"
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
        self.log_step("Generating template-based report (no LLM key).")
        res_list = [f"# Research Analysis for: {topic}\n\n"]
        res_list.append("## Key Summaries\n")

        for item in ranked_papers[:config.MAX_PAPERS]:
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

        return "".join(res_list), False

    def run(self, topic: str) -> Tuple[str, Dict[str, Any], List[str]]:
        start_time = time.time()
        self.log_step(f"Starting Single-Agent Research: {topic}")

        queries = self.expand_query(topic)
        all_retrieved: List[Dict[str, Any]] = []
        processed_urls = set()

        for q in queries:
            self.log_step(f"Searching arXiv: '{q}'")
            papers = search_papers(q, max_results=5)
            new_papers = [p for p in papers if p["url"] not in processed_urls]
            for p in new_papers:
                processed_urls.add(str(p["url"]))

            if new_papers:
                ranked = self.rank_papers(topic, new_papers)
                all_retrieved.extend(ranked)

        # Final deduplication and ranking
        all_retrieved = sorted(all_retrieved, key=lambda x: x["score"], reverse=True)
        unique_results = []
        seen_titles = set()
        for item in all_retrieved:
            title = item["paper"]["title"].lower()
            if title not in seen_titles:
                unique_results.append(item)
                seen_titles.add(title)

        if not unique_results:
            return "No relevant papers found.", {"papers": 0}, self.steps

        report_body, llm_used = self.analyze_results(topic, unique_results)

        end_time = time.time()
        metrics = {
            "time_taken_sec": round(float(end_time - start_time), 2),
            "total_papers_evaluated": len(processed_urls),
            "relevant_papers_found": len(unique_results),
            "top_relevance_score": unique_results[0]["score"] if unique_results else 0,
            "llm_enhanced": llm_used,
            "llm_calls": 1 if llm_used else 0,
            "mode": "SINGLE_AGENT_LLM" if llm_used else "SINGLE_AGENT_LOCAL",
        }

        self.log_to_file(
            f"\n=== LOCAL RUN {datetime.now()} ===\nTopic: {topic}\nMetrics: {metrics}"
        )
        return report_body, metrics, self.steps
