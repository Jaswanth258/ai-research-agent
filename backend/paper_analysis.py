"""
Paper Analysis Endpoint
Accepts a PDF upload, extracts text, and generates an AI-powered analysis report.
"""
import re
import time
from fastapi import APIRouter, UploadFile, File, HTTPException
from .llm import is_available as llm_available, analyze_paper_llm

router = APIRouter()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file using PyPDF2."""
    try:
        from PyPDF2 import PdfReader
        import io

        reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

        return "\n\n".join(text_parts)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {str(e)}")


def template_analysis(text: str, filename: str) -> str:
    """
    Fallback template-based analysis when LLM is not available.
    Uses regex and heuristics to extract key information.
    """
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 20]

    report = f"# Paper Analysis: {filename}\n\n"

    # Summary — first few meaningful sentences
    report += "## 📄 Paper Summary\n"
    summary_sents = sentences[:5] if sentences else ["No extractable text found."]
    for s in summary_sents:
        report += f"{s}.\n\n"

    # Key insights — look for signal words
    report += "## 🔑 Key Insights\n"
    insight_patterns = [
        r"(?:we propose|we present|we introduce|our approach|this paper)\s+([^.]{15,120})",
        r"(?:results show|experiments demonstrate|we achieve|outperforms)\s+([^.]{15,120})",
        r"(?:novel|state-of-the-art|significant|remarkable)\s+([^.]{15,100})",
    ]
    insights = set()
    for pattern in insight_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            insights.add(match.group(0).strip())
    if not insights:
        insights = {"Key contributions identified in the uploaded paper", "Novel methodology or approach described"}
    for ins in list(insights)[:6]:
        report += f"- {ins}\n"

    # Research gaps
    report += "\n## ⚠️ Research Gaps & Limitations\n"
    gap_patterns = [
        (r"(?:limitation|drawback|shortcoming)[s]?\s+(?:of|include|are)\s+([^.]{10,100})", "Limitation: {}"),
        (r"(?:future work|future research|further investigation)\s+([^.]{10,100})", "Future direction: {}"),
        (r"(?:however|although|despite)[,]?\s+([^.]{10,100})", "Challenge: {}"),
        (r"(?:does not|cannot|fails to|unable to)\s+([^.]{10,80})", "Gap: {}"),
    ]
    gaps = set()
    for pattern, label in gap_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            gaps.add(label.format(match.group(1).strip()))
    if not gaps:
        gaps = {
            "Generalizability to other domains not discussed",
            "Computational complexity analysis may be needed",
            "Limited comparison with recent approaches",
        }
    for g in list(gaps)[:5]:
        report += f"- {g}\n"

    report += "\n## 🚀 Future Research Directions\n"
    report += "- Extend the approach to additional domains and datasets\n"
    report += "- Investigate computational efficiency improvements\n"
    report += "- Conduct more comprehensive comparative evaluations\n"

    report += "\n---\n*Analysis generated using template-based extraction (no LLM key). "
    report += "Set FEATHERLESS_API_KEY in .env for AI-powered deep analysis.*\n"

    return report


@router.post("/analyze")
async def analyze_paper(file: UploadFile = File(...)):
    """Upload a PDF and get an AI-powered analysis report."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Read file
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File too large. Max 20MB.")

    # Extract text
    text = extract_text_from_pdf(contents)
    if not text or len(text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Could not extract sufficient text from the PDF. It may be a scanned/image PDF."
        )

    start_time = time.time()
    filename = file.filename or "Uploaded Paper"

    # Try LLM analysis, fall back to template
    llm_used = False
    if llm_available():
        llm_report = analyze_paper_llm(text, filename)
        if llm_report:
            report = f"# 📋 Paper Analysis: {filename}\n\n" + llm_report
            llm_used = True
        else:
            report = template_analysis(text, filename)
    else:
        report = template_analysis(text, filename)

    elapsed = round(time.time() - start_time, 2)

    return {
        "report": report,
        "filename": filename,
        "pages_extracted": text.count("\n\n") + 1,
        "text_length": len(text),
        "llm_enhanced": llm_used,
        "time_taken_sec": elapsed,
    }
