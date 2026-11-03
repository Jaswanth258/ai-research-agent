import time
import os
from datetime import datetime
import re
from typing import List, Dict, Any, Tuple, Optional, TypedDict
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


# ═══════════════════════════════════════════════════════════════════════════
# LangGraph State Schema
# ═══════════════════════════════════════════════════════════════════════════

class MultiAgentState(TypedDict):
    topic: str
    filters: Dict[str, Any]
    queries: List[str]
    raw_papers: List[Dict[str, Any]]
    ranked_papers: List[Dict[str, Any]]
    all_scored_papers: List[Dict[str, Any]]
    trend_analysis: Optional[str]
    first_draft: Optional[str]
    critique: Optional[str]
    revised_report: Optional[str]
    final_report: str
    llm_used: bool
    llm_calls: int
    revision_applied: bool
    threshold: float
    max_papers: int
    date_range: Optional[str]
    processed_count: int


# ═══════════════════════════════════════════════════════════════════════════
# MultiAgent LangGraph Orchestrator
# ═══════════════════════════════════════════════════════════════════════════

class MultiAgent:
    """
    6-Agent Collaborative System orchestrated via LangGraph.
    
    Graph Topology:
         START
           │
      ▼ planner (LLM query diversification)
           │
     ▼ researcher (arXiv API retrieval)
           │
      ▼ reviewer (MiniLM embedding semantic gate)
           │
       [Approved papers?] ── No ──► END ("No relevant papers found")
           │ Yes
           ▼
     trend_analyst (K-Means & trend synthesis)
           │
      writer_draft (first comprehensive draft)
           │
         critic (peer-review feedback)
           │
       [Critique generated?] ── No ──► END (first draft final)
           │ Yes
           ▼
    writer_revision (2-pass revision with critique + trends)
           │
          END
    """

    def __init__(self):
        self.steps: List[str] = []
        self._current_callback = None
        self._reviewer_model = None
        self.graph = self._build_graph()

    def log_step(self, text: str):
        print(f"[LANGGRAPH MULTI-AGENT STEP] {text}")
        self.steps.append(text)
        if hasattr(self, '_current_callback') and self._current_callback:
            self._current_callback(text)

    def log_to_file(self, text: str):
        os.makedirs("logs", exist_ok=True)
        with open(config.LOG_FILE, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    def get_reviewer_model(self) -> SentenceTransformer:
        """Lazy load or pre-warm SentenceTransformer embedding model."""
        if self._reviewer_model is None:
            self.log_step("[Reviewer] Loading embedding model for deep evaluation...")
            for attempt in range(3):
                try:
                    self._reviewer_model = SentenceTransformer(MODEL_NAME)
                    break
                except Exception as e:
                    if attempt < 2:
                        time.sleep(2 ** attempt)
                    else:
                        raise e
        return self._reviewer_model

    def _build_graph(self):
        """Construct the LangGraph StateGraph with nodes and conditional edges."""
        try:
            from langgraph.graph import StateGraph, START, END

            workflow = StateGraph(MultiAgentState)

            # Register agent nodes
            workflow.add_node("planner", self._planner_node)
            workflow.add_node("researcher", self._researcher_node)
            workflow.add_node("reviewer", self._reviewer_node)
            workflow.add_node("trend_analyst", self._trend_analyst_node)
            workflow.add_node("writer_draft", self._writer_draft_node)
            workflow.add_node("critic", self._critic_node)
            workflow.add_node("writer_revision", self._writer_revision_node)

            # Build workflow edges
            workflow.add_edge(START, "planner")
            workflow.add_edge("planner", "researcher")
            workflow.add_edge("researcher", "reviewer")

            # Quality gate conditional edge
            workflow.add_conditional_edges(
                "reviewer",
                self._route_after_review,
                {
                    "has_papers": "trend_analyst",
                    "no_papers": END
                }
            )

            workflow.add_edge("trend_analyst", "writer_draft")
            workflow.add_edge("writer_draft", "critic")

            # Critique feedback loop conditional edge
            workflow.add_conditional_edges(
                "critic",
                self._route_after_critic,
                {
                    "has_critique": "writer_revision",
                    "no_critique": END
                }
            )

            workflow.add_edge("writer_revision", END)

            return workflow.compile()
        except Exception as e:
            self.log_step(f"Warning: LangGraph initialization failed: {e}")
            return None

    # ── Conditional Routing Functions ──────────────────────────────────────────

    def _route_after_review(self, state: MultiAgentState) -> str:
        """Route to trend_analyst if papers passed threshold, otherwise terminate early."""
        if state.get("ranked_papers") and len(state["ranked_papers"]) > 0:
            return "has_papers"
        return "no_papers"

    def _route_after_critic(self, state: MultiAgentState) -> str:
        """Route to writer_revision if critique is available, otherwise conclude."""
        if state.get("critique"):
            return "has_critique"
        return "no_critique"

    # ── LangGraph Agent Nodes ──────────────────────────────────────────────────

    def _planner_node(self, state: MultiAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        llm_calls = state.get("llm_calls", 0)

        if llm_available():
            self.log_step(f"[Planner Node] 🤖 LLM query strategy for: {topic}")
            llm_queries = expand_queries_llm(topic)
            if llm_queries:
                final = llm_queries[:config.MAX_QUERIES]
                self.log_step(f"[Planner Node] LLM generated {len(final)} diverse queries.")
                return {"queries": final, "llm_calls": llm_calls + 1}

        # Fallback heuristic
        self.log_step(f"[Planner Node] Heuristic query expansion for: {topic} (max: {config.MAX_QUERIES} queries)")
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

        final_queries = list(dict.fromkeys(queries))[:config.MAX_QUERIES]
        self.log_step(f"[Planner Node] Generated {len(final_queries)} queries.")
        return {"queries": final_queries}

    def _researcher_node(self, state: MultiAgentState) -> Dict[str, Any]:
        queries = state["queries"]
        topic = state["topic"]
        date_range = state.get("date_range")
        self.log_step(f"[Researcher Node] Executing searches for {len(queries)} queries.")

        all_papers = []
        processed_urls = set()

        for q in queries:
            try:
                time.sleep(0.5)
                papers = search_papers(q, max_results=config.PAPERS_PER_QUERY, date_range=date_range)
                for p in papers:
                    if p["url"] not in processed_urls:
                        all_papers.append(p)
                        processed_urls.add(p["url"])
            except Exception as e:
                self.log_step(f"[Researcher Node] Error searching arXiv for '{q}': {e}")

        # ── Hybrid Retrieval: Query local FAISS Vector Store ────────────────
        try:
            from ...vector_store import get_store, FAISS_AVAILABLE
            if FAISS_AVAILABLE:
                store = get_store()
                faiss_results = store.search(topic, top_k=5)
                rag_added = 0
                for item in faiss_results:
                    p = item.get("paper", {})
                    url = p.get("url", "")
                    if url and url not in processed_urls:
                        all_papers.append({
                            "title": p.get("title", ""),
                            "summary": p.get("summary", ""),
                            "authors": p.get("authors", []),
                            "url": url,
                            "source": "faiss_rag",
                        })
                        processed_urls.add(url)
                        rag_added += 1
                if rag_added > 0:
                    self.log_step(f"[Researcher Node] 🧠 Injected {rag_added} relevant historical papers from FAISS RAG index.")
        except Exception as e:
            self.log_step(f"[Researcher Node] FAISS RAG search note: {e}")

        self.log_step(f"[Researcher Node] Retrieved {len(all_papers)} unique candidate papers (arXiv + RAG).")
        return {
            "raw_papers": all_papers,
            "processed_count": len(processed_urls)
        }

    def _reviewer_node(self, state: MultiAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        papers = state.get("raw_papers", [])
        threshold = state.get("threshold", config.MULTI_AGENT_THRESHOLD)

        self.log_step(f"[Reviewer Node] Evaluating {len(papers)} papers (threshold: {threshold}).")
        if not papers:
            self.log_step("[Reviewer Node] No papers passed the Reviewer's quality threshold.")
            return {
                "ranked_papers": [],
                "all_scored_papers": [],
                "final_report": "No relevant papers found by the Multi-Agent System."
            }

        model = self.get_reviewer_model()
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
        self.log_step(f"[Reviewer Node] Approved {len(ranked)} high-quality papers.")

        # ── Auto-index approved papers to FAISS RAG vector store ─────────────
        if ranked:
            try:
                from ...vector_store import get_store, FAISS_AVAILABLE
                if FAISS_AVAILABLE:
                    store = get_store()
                    newly_added = store.add_papers([item["paper"] for item in ranked])
                    if newly_added > 0:
                        self.log_step(f"[Reviewer Node] 💾 Persisted {newly_added} approved papers to FAISS RAG index.")
            except Exception as e:
                self.log_step(f"[Reviewer Node] Vector store auto-index note: {e}")

        final_report = ""
        if not ranked:
            self.log_step("[Reviewer Node] No papers passed the Reviewer's quality threshold.")
            final_report = "No relevant papers found by the Multi-Agent System."

        return {
            "ranked_papers": ranked,
            "all_scored_papers": all_scored,
            "final_report": final_report
        }

    def _trend_analyst_node(self, state: MultiAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        ranked_papers = state.get("ranked_papers", [])
        llm_calls = state.get("llm_calls", 0)

        if not llm_available() or not ranked_papers:
            self.log_step("[TrendAnalyst Node] Skipped (LLM unavailable or no papers).")
            return {"trend_analysis": None}

        self.log_step(f"[TrendAnalyst Node] 📈 Analyzing trends across {len(ranked_papers)} papers...")
        cluster_info = ""

        try:
            model = self.get_reviewer_model()
            if model and len(ranked_papers) >= 3:
                self.log_step(f"[TrendAnalyst Node] 📈 Executing K-Means Clustering on {len(ranked_papers)} papers...")
                from sklearn.cluster import KMeans

                summaries = [str(p["paper"]["summary"]) for p in ranked_papers]
                embeddings = model.encode(summaries, convert_to_tensor=False)

                num_clusters = min(3, len(ranked_papers))
                kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init='auto')
                labels = kmeans.fit_predict(embeddings)

                clusters = {i: [] for i in range(num_clusters)}
                for idx, label in enumerate(labels):
                    clusters[label].append(ranked_papers[idx]["paper"]["title"])

                cluster_lines = []
                for c_id, titles in clusters.items():
                    cluster_lines.append(f"Cluster {c_id + 1}: " + " | ".join(titles))

                cluster_info = "\n".join(cluster_lines)
                self.log_step(f"[TrendAnalyst Node] 📈 Formed {num_clusters} mathematical clusters.")
        except Exception as e:
            self.log_step(f"[TrendAnalyst Node] ⚠️ K-Means clustering failed: {str(e)}")

        result = analyze_trends_llm(topic, ranked_papers, cluster_info=cluster_info)
        if result:
            self.log_step("[TrendAnalyst Node] Trend analysis complete.")
            return {"trend_analysis": result, "llm_calls": llm_calls + 1}
        else:
            self.log_step("[TrendAnalyst Node] ⚠️ LLM call failed — continuing without trends.")
            return {"trend_analysis": None}

    def _writer_draft_node(self, state: MultiAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        ranked_papers = state.get("ranked_papers", [])
        max_papers = state.get("max_papers", config.MAX_PAPERS)
        llm_calls = state.get("llm_calls", 0)

        # ── LLM synthesis via LangChain / Featherless AI ────────────────────
        if llm_available():
            self.log_step("[Writer Node] 🤖 LLM deep synthesis — first draft (specialized writer prompt).")
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
                full_report = header + paper_list + "\n---\n\n" + llm_report
                return {
                    "first_draft": full_report,
                    "final_report": full_report,
                    "llm_used": True,
                    "llm_calls": llm_calls + 1
                }

        # ── Template-based fallback ──────────────────────────────────────────
        self.log_step("[Writer Node] Generating template-based report (no LLM key).")
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

        full_template = "".join(res_list)
        return {
            "first_draft": full_template,
            "final_report": full_template,
            "llm_used": False,
            "llm_calls": llm_calls
        }

    def _critic_node(self, state: MultiAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        first_draft = state.get("first_draft", "")
        llm_used = state.get("llm_used", False)
        llm_calls = state.get("llm_calls", 0)

        if not llm_used or not llm_available() or not first_draft:
            self.log_step("[Critic Node] Skipped (template draft or LLM unavailable).")
            return {"critique": None}

        self.log_step("[Critic Node] 🔍 Peer-reviewing the Writer's draft...")
        critique = critique_report_llm(topic, first_draft)
        if critique:
            self.log_step("[Critic Node] Critique complete — sending feedback to Writer.")
            return {"critique": critique, "llm_calls": llm_calls + 1}
        else:
            self.log_step("[Critic Node] ⚠️ LLM call failed — using first draft as final.")
            return {"critique": None}

    def _writer_revision_node(self, state: MultiAgentState) -> Dict[str, Any]:
        topic = state["topic"]
        first_draft = state.get("first_draft", "")
        critique = state.get("critique", "")
        trend_analysis = state.get("trend_analysis") or ""
        ranked_papers = state.get("ranked_papers", [])
        max_papers = state.get("max_papers", config.MAX_PAPERS)
        llm_calls = state.get("llm_calls", 0)

        self.log_step("[Writer Node] ✍️ Revising report based on Critic feedback + Trend insights...")
        revised = revise_report_llm(topic, first_draft, critique, trend_analysis)

        if revised:
            self.log_step("[Writer Node] ✅ Final revised report complete (2-pass).")
            header = f"# Multi-Agent Research Analysis: {topic}\n\n"
            header += "> *Generated by 6-Agent LangGraph System — Peer-Reviewed & Revised*\n\n"
            paper_list = "## Reviewed Papers\n"
            for item in ranked_papers[:max_papers]:
                p = item["paper"]
                paper_list += (
                    f"### {p['title']}\n"
                    f"- **Relevance Score**: {item['score']}\n"
                    f"- **Authors**: {', '.join(p['authors'][:3])}\n"
                    f"- **Link**: [{p['url']}]({p['url']})\n\n"
                )

            trend_section = ""
            if trend_analysis:
                trend_section = (
                    "\n---\n\n## 📈 Research Trend Analysis\n\n"
                    + trend_analysis
                    + "\n"
                )

            final_report = header + paper_list + "\n---\n\n" + revised + trend_section
            return {
                "revised_report": revised,
                "final_report": final_report,
                "revision_applied": True,
                "llm_calls": llm_calls + 1
            }
        else:
            self.log_step("[Writer Node] ⚠️ Revision failed — using first draft as final.")
            return {"revision_applied": False}

    # ── Public Runner Method ──────────────────────────────────────────────────

    def run(self, topic: str, filters: Dict[str, Any] = None, log_callback=None) -> Tuple[str, Dict[str, Any], List[str]]:
        import threading
        self.steps = []
        self._current_callback = log_callback
        start_time = time.time()
        self.log_step(f"Starting Enhanced Multi-Agent LangGraph Orchestration (6 agents) for: {topic}")

        # Pre-warm Reviewer's model in background
        threading.Thread(target=self.get_reviewer_model, daemon=True).start()

        filters = filters or {}
        min_score_val = filters.get("min_score")
        threshold = float(min_score_val) if min_score_val is not None and str(min_score_val).strip() else config.MULTI_AGENT_THRESHOLD

        max_papers_val = filters.get("max_papers")
        max_papers = int(max_papers_val) if max_papers_val is not None and str(max_papers_val).strip() else config.MAX_PAPERS

        date_range = filters.get("date_range")

        initial_state: MultiAgentState = {
            "topic": topic,
            "filters": filters,
            "queries": [],
            "raw_papers": [],
            "ranked_papers": [],
            "all_scored_papers": [],
            "trend_analysis": None,
            "first_draft": None,
            "critique": None,
            "revised_report": None,
            "final_report": "",
            "llm_used": False,
            "llm_calls": 0,
            "revision_applied": False,
            "threshold": threshold,
            "max_papers": max_papers,
            "date_range": date_range,
            "processed_count": 0,
        }

        if self.graph:
            final_state = self.graph.invoke(initial_state)
        else:
            # Fallback direct execution if graph compilation failed
            s1 = self._planner_node(initial_state)
            initial_state.update(s1)
            s2 = self._researcher_node(initial_state)
            initial_state.update(s2)
            s3 = self._reviewer_node(initial_state)
            initial_state.update(s3)
            if initial_state.get("ranked_papers"):
                s4 = self._trend_analyst_node(initial_state)
                initial_state.update(s4)
                s5 = self._writer_draft_node(initial_state)
                initial_state.update(s5)
                s6 = self._critic_node(initial_state)
                initial_state.update(s6)
                if initial_state.get("critique"):
                    s7 = self._writer_revision_node(initial_state)
                    initial_state.update(s7)
            final_state = initial_state

        end_time = time.time()

        raw_papers = final_state.get("raw_papers", [])
        ranked_papers = final_state.get("ranked_papers", [])
        all_scored = final_state.get("all_scored_papers", [])
        trend_analysis = final_state.get("trend_analysis")
        revision_applied = final_state.get("revision_applied", False)
        llm_used = final_state.get("llm_used", False)
        llm_calls = final_state.get("llm_calls", 0)
        queries = final_state.get("queries", [])
        processed_count = final_state.get("processed_count", len(raw_papers))

        agents_used = 4 if ranked_papers else 3
        if trend_analysis:
            agents_used += 1
        if revision_applied:
            agents_used += 1

        metrics = {
            "time_taken_sec": round(float(end_time - start_time), 2),
            "total_papers_evaluated": processed_count,
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
            "mode": "MULTI_AGENT_LANGGRAPH_LLM_6" if revision_applied else ("MULTI_AGENT_LANGGRAPH_LLM" if llm_used else "MULTI_AGENT_LANGGRAPH_LOCAL"),
        }

        self.log_to_file(
            f"\n=== LANGGRAPH MULTI-AGENT RUN {datetime.now()} ===\nTopic: {topic}\nMetrics: {metrics}"
        )
        return final_state.get("final_report", "No report generated."), metrics, self.steps


# Backward compatibility aliases
PlannerAgent = None
ResearcherAgent = None
ReviewerAgent = None
TrendAnalystAgent = None
WriterAgent = None
CriticAgent = None
