"""
FAISS Vector Store — Persistent Semantic Paper Index
Implements a RAG (Retrieval-Augmented Generation) pipeline by storing
paper embeddings in a FAISS index for cross-session semantic search.
"""

import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

MODEL_NAME = "all-MiniLM-L6-v2"
INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "faiss_index")
INDEX_FILE = os.path.join(INDEX_DIR, "papers.index")
META_FILE = os.path.join(INDEX_DIR, "papers_meta.json")
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension


class VectorStore:
    """FAISS-backed vector store for persistent paper embeddings."""

    def __init__(self):
        self._model: Optional[SentenceTransformer] = None
        self._index = None
        self._metadata: List[Dict[str, Any]] = []
        self._load_index()

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(MODEL_NAME)
        return self._model

    def _load_index(self):
        """Load existing FAISS index and metadata from disk."""
        if not FAISS_AVAILABLE:
            return

        os.makedirs(INDEX_DIR, exist_ok=True)

        if os.path.exists(INDEX_FILE) and os.path.exists(META_FILE):
            try:
                self._index = faiss.read_index(INDEX_FILE)
                with open(META_FILE, "r", encoding="utf-8") as f:
                    self._metadata = json.load(f)
            except Exception:
                self._index = faiss.IndexFlatIP(EMBEDDING_DIM)  # Inner product (cosine sim on normalized vectors)
                self._metadata = []
        else:
            self._index = faiss.IndexFlatIP(EMBEDDING_DIM)
            self._metadata = []

    def _save_index(self):
        """Persist the FAISS index and metadata to disk."""
        if not FAISS_AVAILABLE or self._index is None:
            return

        os.makedirs(INDEX_DIR, exist_ok=True)
        faiss.write_index(self._index, INDEX_FILE)
        with open(META_FILE, "w", encoding="utf-8") as f:
            json.dump(self._metadata, f, ensure_ascii=False)

    def add_papers(self, papers: List[Dict[str, Any]]) -> int:
        """
        Add papers to the FAISS index.
        
        Args:
            papers: List of paper dicts with 'title', 'summary', 'url', 'authors'
            
        Returns:
            Number of new papers added (skips duplicates)
        """
        if not FAISS_AVAILABLE or self._index is None:
            return 0

        # Filter out duplicates by URL
        existing_urls = {m["url"] for m in self._metadata}
        new_papers = [p for p in papers if p.get("url") not in existing_urls]

        if not new_papers:
            return 0

        model = self._get_model()
        texts = [f"{p['title']}. {p['summary']}" for p in new_papers]
        embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)

        # Add to FAISS index
        self._index.add(embeddings.astype(np.float32))

        # Store metadata
        for p in new_papers:
            self._metadata.append({
                "title": p.get("title", ""),
                "summary": p.get("summary", "")[:500],
                "url": p.get("url", ""),
                "authors": p.get("authors", [])[:3],
            })

        self._save_index()
        return len(new_papers)

    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Semantic search across all indexed papers.
        
        Args:
            query: Natural language search query
            top_k: Number of results to return
            
        Returns:
            List of {paper, score} dicts sorted by relevance
        """
        if not FAISS_AVAILABLE or self._index is None or self._index.ntotal == 0:
            return []

        model = self._get_model()
        query_vec = model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
        
        k = min(top_k, self._index.ntotal)
        scores, indices = self._index.search(query_vec.astype(np.float32), k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self._metadata):
                results.append({
                    "paper": self._metadata[idx],
                    "score": round(float(score), 4),
                })

        return results

    def get_stats(self) -> Dict[str, Any]:
        """Return current index statistics."""
        return {
            "faiss_available": FAISS_AVAILABLE,
            "total_papers": self._index.ntotal if FAISS_AVAILABLE and self._index else 0,
            "embedding_dim": EMBEDDING_DIM,
            "index_path": INDEX_DIR,
            "model": MODEL_NAME,
        }

    def clear(self):
        """Clear the entire index."""
        if FAISS_AVAILABLE:
            self._index = faiss.IndexFlatIP(EMBEDDING_DIM)
            self._metadata = []
            self._save_index()


# Singleton instance
_store: Optional[VectorStore] = None


def get_store() -> VectorStore:
    """Get the singleton VectorStore instance."""
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
