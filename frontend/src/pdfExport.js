import { jsPDF } from 'jspdf';

/**
 * Generate a clean text-based PDF from a markdown report string.
 * Uses jsPDF text rendering — no screenshots, no html2canvas.
 */
export function downloadReportPDF(markdownText, title = 'Research Report') {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 5.5;
  const fontSize = {
    h1: 18,
    h2: 14,
    h3: 12,
    body: 10,
    bullet: 10,
    meta: 8,
  };

  let y = margin;

  const checkPageBreak = (needed = 12) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const addText = (text, size, style = 'normal', color = [230, 230, 230]) => {
    pdf.setFontSize(size);
    pdf.setFont('helvetica', style);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      checkPageBreak();
      pdf.text(line, margin, y);
      y += lineHeight * (size / 10);
    }
  };

  // ── Dark background on every page ──────────────────────────────────
  const addBackground = () => {
    pdf.setFillColor(17, 24, 39); // #111827
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  // Override addPage to auto-add background
  const originalAddPage = pdf.addPage.bind(pdf);
  pdf.addPage = (...args) => {
    originalAddPage(...args);
    addBackground();
    return pdf;
  };

  // First page background
  addBackground();

  // ── Header ────────────────────────────────────────────────────────
  pdf.setFillColor(99, 102, 241); // indigo accent
  pdf.rect(0, 0, pageWidth, 2, 'F');

  y = margin + 4;
  addText(title, fontSize.h1, 'bold', [165, 140, 255]);
  y += 2;

  // Date line
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  addText(`Generated on ${dateStr}`, fontSize.meta, 'italic', [140, 140, 160]);
  y += 2;

  // Divider
  pdf.setDrawColor(60, 60, 80);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ── Parse markdown lines ──────────────────────────────────────────
  const rawLines = markdownText.split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      y += 3;
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      checkPageBreak(10);
      y += 3;
      const headingText = trimmed.replace(/^###\s+/, '').replace(/\*\*/g, '');
      addText(headingText, fontSize.h3, 'bold', [200, 180, 255]);
      y += 1;
    } else if (trimmed.startsWith('## ')) {
      checkPageBreak(12);
      y += 5;
      const headingText = trimmed.replace(/^##\s+/, '').replace(/\*\*/g, '');
      // Heading underline
      pdf.setDrawColor(99, 102, 241);
      pdf.setLineWidth(0.4);
      pdf.line(margin, y - 1, margin + 50, y - 1);
      addText(headingText, fontSize.h2, 'bold', [140, 160, 255]);
      y += 2;
    } else if (trimmed.startsWith('# ')) {
      checkPageBreak(14);
      y += 4;
      const headingText = trimmed.replace(/^#\s+/, '').replace(/\*\*/g, '');
      addText(headingText, fontSize.h1, 'bold', [165, 140, 255]);
      y += 3;
    }
    // Blockquotes
    else if (trimmed.startsWith('>')) {
      checkPageBreak(8);
      const quoteText = trimmed.replace(/^>\s*/, '').replace(/\*/g, '');
      pdf.setFillColor(30, 35, 50);
      const quoteLines = pdf.splitTextToSize(quoteText, contentWidth - 8);
      const quoteHeight = quoteLines.length * lineHeight + 4;
      pdf.rect(margin, y - 3, contentWidth, quoteHeight, 'F');
      pdf.setDrawColor(99, 102, 241);
      pdf.setLineWidth(0.6);
      pdf.line(margin, y - 3, margin, y - 3 + quoteHeight);
      pdf.setFontSize(fontSize.body);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(180, 180, 200);
      for (const ql of quoteLines) {
        pdf.text(ql, margin + 5, y);
        y += lineHeight;
      }
      y += 2;
    }
    // Horizontal rule
    else if (trimmed === '---' || trimmed === '***') {
      y += 3;
      pdf.setDrawColor(50, 50, 70);
      pdf.setLineWidth(0.2);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;
    }
    // Bullet points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      checkPageBreak(8);
      const bulletText = trimmed
        .replace(/^[-*•]\s+/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // strip links

      pdf.setFillColor(99, 102, 241);
      pdf.circle(margin + 2, y - 1.2, 0.8, 'F');

      pdf.setFontSize(fontSize.bullet);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(210, 210, 220);
      const bulletLines = pdf.splitTextToSize(bulletText, contentWidth - 8);
      for (const bl of bulletLines) {
        checkPageBreak();
        pdf.text(bl, margin + 6, y);
        y += lineHeight;
      }
      y += 1;
    }
    // Regular text
    else {
      checkPageBreak(8);
      const cleanText = trimmed
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)'); // links → text (url)

      addText(cleanText, fontSize.body, 'normal', [200, 200, 210]);
    }
  }

  // ── Footer on every page ──────────────────────────────────────────
  const totalPages = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 100, 120);
    pdf.text(
      `Agentic Research Bot  •  Page ${p} of ${totalPages}`,
      pageWidth / 2, pageHeight - 8,
      { align: 'center' }
    );
  }

  // Save
  const safeName = title.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  pdf.save(`${safeName || 'research_report'}.pdf`);
}
