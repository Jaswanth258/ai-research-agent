"""
Automated Report Evaluation Module
Computes quantitative quality metrics for generated research reports.
Metrics: ROUGE-1/2/L, Lexical Diversity, Source Coverage, Structural Analysis.
"""

import re
from typing import Dict, Any, List
from collections import Counter

try:
    from rouge_score import rouge_scorer
    ROUGE_AVAILABLE = True
except ImportError:
    ROUGE_AVAILABLE = False


def _tokenize(text: str) -> List[str]:
    """Simple whitespace + punctuation tokenizer."""
    return re.findall(r'\b\w+\b', text.lower())


def _compute_rouge(report: str, references: List[str]) -> Dict[str, float]:
    """Compute ROUGE-1, ROUGE-2, ROUGE-L between report and reference abstracts."""
    if not ROUGE_AVAILABLE or not references:
        return {"rouge_1": 0.0, "rouge_2": 0.0, "rouge_l": 0.0}

    scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
    combined_ref = " ".join(references)

    scores = scorer.score(combined_ref, report)
    return {
        "rouge_1": round(scores['rouge1'].fmeasure, 4),
        "rouge_2": round(scores['rouge2'].fmeasure, 4),
        "rouge_l": round(scores['rougeL'].fmeasure, 4),
    }


def _compute_lexical_diversity(report: str) -> float:
    """Type-Token Ratio: unique words / total words. Higher = richer vocabulary."""
    tokens = _tokenize(report)
    if not tokens:
        return 0.0
    return round(len(set(tokens)) / len(tokens), 4)


def _compute_coverage(report: str, paper_titles: List[str]) -> Dict[str, Any]:
    """What fraction of source papers are explicitly referenced in the report."""
    if not paper_titles:
        return {"coverage_ratio": 0.0, "papers_mentioned": 0, "papers_total": 0}

    report_lower = report.lower()
    mentioned = 0
    for title in paper_titles:
        # Check if a significant portion of the title appears in the report
        title_words = _tokenize(title)
        if len(title_words) < 3:
            # Short titles: require exact match
            if title.lower() in report_lower:
                mentioned += 1
        else:
            # Longer titles: check if at least 60% of significant words appear
            significant_words = [w for w in title_words if len(w) > 3]
            if significant_words:
                matches = sum(1 for w in significant_words if w in report_lower)
                if matches / len(significant_words) >= 0.6:
                    mentioned += 1

    return {
        "coverage_ratio": round(mentioned / len(paper_titles), 4),
        "papers_mentioned": mentioned,
        "papers_total": len(paper_titles),
    }


def _compute_structure(report: str) -> Dict[str, int]:
    """Analyze report structure: headings, sections, word count."""
    tokens = _tokenize(report)
    headings = len(re.findall(r'^#{1,3}\s+', report, re.MULTILINE))
    bullet_points = len(re.findall(r'^\s*[-*•]\s+', report, re.MULTILINE))
    bold_terms = len(re.findall(r'\*\*[^*]+\*\*', report))

    return {
        "word_count": len(tokens),
        "heading_count": headings,
        "bullet_points": bullet_points,
        "bold_terms": bold_terms,
    }


def _compute_key_terms(report: str, top_n: int = 8) -> List[str]:
    """Extract top-N key terms by frequency (excluding stopwords)."""
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
        'it', 'its', 'they', 'their', 'we', 'our', 'you', 'your', 'he', 'she',
        'as', 'if', 'not', 'no', 'more', 'most', 'than', 'each', 'which',
        'what', 'when', 'where', 'how', 'all', 'both', 'few', 'many', 'some',
        'other', 'into', 'through', 'during', 'before', 'after', 'above',
        'between', 'such', 'also', 'about', 'up', 'out', 'so', 'then',
        'very', 'just', 'over', 'only', 'using', 'used', 'based', 'paper',
        'research', 'results', 'approach', 'proposed', 'show', 'work',
        'however', 'authors', 'study', 'method', 'methods', 'score',
        'papers', 'analysis', 'report', 'relevance', 'http', 'https', 'arxiv',
    }
    tokens = _tokenize(report)
    filtered = [t for t in tokens if t not in stopwords and len(t) > 2]
    counter = Counter(filtered)
    return [term for term, _ in counter.most_common(top_n)]


def evaluate_report(
    report: str,
    source_abstracts: List[str] = None,
    paper_titles: List[str] = None,
) -> Dict[str, Any]:
    """
    Run full evaluation suite on a generated report.

    Args:
        report: The generated markdown report text
        source_abstracts: List of source paper abstracts (for ROUGE)
        paper_titles: List of source paper titles (for coverage)

    Returns:
        Dictionary with all quality metrics
    """
    source_abstracts = source_abstracts or []
    paper_titles = paper_titles or []

    rouge = _compute_rouge(report, source_abstracts)
    diversity = _compute_lexical_diversity(report)
    coverage = _compute_coverage(report, paper_titles)
    structure = _compute_structure(report)
    key_terms = _compute_key_terms(report)

    return {
        **rouge,
        "lexical_diversity": diversity,
        **coverage,
        **structure,
        "key_terms": key_terms,
        "rouge_available": ROUGE_AVAILABLE,
    }
