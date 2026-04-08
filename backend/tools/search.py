import feedparser # type: ignore
import urllib.parse
from typing import List, Dict, Any

BASE_URL = "http://export.arxiv.org/api/query?"

def search_papers(topic: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """Search arXiv for research papers related to a topic."""
    try:
        query = f"all:{topic}"
        encoded_query = urllib.parse.quote(query)
        url = f"{BASE_URL}search_query={encoded_query}&start=0&max_results={max_results}&sortBy=relevance&sortOrder=descending"

        feed = feedparser.parse(url)
        if feed.bozo:
            return []

        papers = []
        for entry in feed.entries:
            papers.append({
                "title": str(entry.title),
                "summary": str(entry.summary).replace("\n", " ").strip(),
                "authors": [str(a.name) for a in entry.authors],
                "url": str(entry.link)
            })
        return papers
    except Exception:
        return []
