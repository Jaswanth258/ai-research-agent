import feedparser # type: ignore
import urllib.parse
from typing import List, Dict, Any

import hashlib

BASE_URL = "http://export.arxiv.org/api/query?"
_search_cache = {}

def search_papers(topic: str, max_results: int = 5, date_range: str = None) -> List[Dict[str, Any]]:
    """Search arXiv for research papers related to a topic."""
    cache_key = hashlib.md5(f"{topic}:{max_results}:{date_range}".encode("utf-8")).hexdigest()
    if cache_key in _search_cache:
        print(f"[Search Tools] Cache hit for topic: {topic}")
        return _search_cache[cache_key]

    try:
        query = f"all:{topic}"
        encoded_query = urllib.parse.quote(query)
        url = f"{BASE_URL}search_query={encoded_query}&start=0&max_results={max_results}&sortBy=relevance&sortOrder=descending"

        feed = feedparser.parse(url)
        if feed.bozo:
            return []

        import time
        from datetime import datetime, timedelta
        
        cutoff_date = None
        if date_range == "1y":
            cutoff_date = datetime.now() - timedelta(days=365)
        elif date_range == "3y":
            cutoff_date = datetime.now() - timedelta(days=365*3)

        papers = []
        for entry in feed.entries:
            if cutoff_date and hasattr(entry, 'published_parsed') and entry.published_parsed:
                pub_date = datetime.fromtimestamp(time.mktime(entry.published_parsed))
                if pub_date < cutoff_date:
                    continue
                    
            papers.append({
                "title": str(entry.title),
                "summary": str(entry.summary).replace("\n", " ").strip(),
                "authors": [str(a.name) for a in entry.authors],
                "url": str(entry.link)
            })
        _search_cache[cache_key] = papers
        return papers
    except Exception:
        return []
