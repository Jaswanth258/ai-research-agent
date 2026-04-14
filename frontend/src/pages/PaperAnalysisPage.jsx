import React, { useState, useRef } from 'react';
import { marked } from 'marked';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Upload, FileText, Loader2, AlertCircle, Download,
  Sparkles, Clock, FileType, Hash, CheckCircle, X, Save
} from 'lucide-react';

import { API_PAPER, API_HISTORY } from '../api';

export default function PaperAnalysisPage({ userEmail, onRequestLogin }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const reportRef = useRef(null);
  const fileInputRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const selectFile = (f) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File too large. Max 20MB.');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);
  };

  const handleFileInput = (e) => {
    if (e.target.files?.[0]) selectFile(e.target.files[0]);
  };

  const handleAnalyze = async () => {
    if (!file) return;

    // Auth gate
    if (!userEmail) {
      onRequestLogin?.();
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await axios.post(`${API_PAPER}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min timeout for large papers
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - 20;
      }

      const name = file?.name?.replace('.pdf', '') || 'paper';
      pdf.save(`${name}_analysis.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveDraft = async () => {
    const token = localStorage.getItem('agentic_token');
    if (!token || !result) return;

    setSaveStatus('saving');
    try {
      await axios.post(`${API_HISTORY}/save`, {
        topic: file?.name || 'Paper Analysis',
        mode: 'paper',
        result: { report: result.report, filename: result.filename, llm_enhanced: result.llm_enhanced },
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const md = (src) => {
    // Normalize: strip common leading indentation that causes marked to
    // render content as code blocks (4+ spaces = <pre><code>)
    let text = (src || '').replace(/^\uFEFF/, ''); // strip BOM
    // Remove leading whitespace from each line (LLM responses can be indented)
    text = text
      .split('\n')
      .map((line) => line.replace(/^\t+/, '').replace(/^    /, ''))
      .join('\n');
    return { __html: marked.parse(text, { gfm: true, breaks: false }) };
  };

  return (
    <div className="paper-analysis-page">
      <div className="paper-hero">
        <h1 className="paper-title">
          <FileText size={36} /> Paper Analyzer
        </h1>
        <p className="paper-subtitle">
          Upload a research paper (PDF) and let our AI agents analyze it —
          extracting key insights, methodology, and identifying research gaps.
        </p>
      </div>

      {/* Upload Area */}
      <div className="paper-upload-section">
        <div
          className={`upload-dropzone ${dragActive ? 'dropzone-active' : ''} ${file ? 'dropzone-has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          {file ? (
            <div className="dropzone-file-info">
              <div className="dropzone-file-icon">
                <FileType size={32} color="#818cf8" />
              </div>
              <div className="dropzone-file-details">
                <span className="dropzone-filename">{file.name}</span>
                <span className="dropzone-filesize">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button className="dropzone-remove" onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}>
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="dropzone-placeholder">
              <Upload size={40} color={dragActive ? '#818cf8' : '#64748b'} />
              <p className="dropzone-text">
                {dragActive ? 'Drop your PDF here' : 'Drag & drop a PDF here, or click to browse'}
              </p>
              <span className="dropzone-hint">PDF files up to 20MB</span>
            </div>
          )}
        </div>

        {file && !loading && !result && (
          <button className="analyze-btn" onClick={handleAnalyze}>
            <Sparkles size={18} /> Analyze Paper
          </button>
        )}

        {loading && (
          <div className="paper-loading">
            <Loader2 size={24} className="spin" color="var(--primary)" />
            <span>Analyzing paper — extracting text and generating insights…</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="error-box" style={{ maxWidth: '700px', margin: '1.5rem auto' }}>
          <AlertCircle size={18} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="paper-results">
          {/* Metrics strip */}
          <div className="paper-metrics-strip">
            <div className="paper-metric">
              <Clock size={14} color="var(--primary)" />
              <span>{result.time_taken_sec}s</span>
            </div>
            <div className="paper-metric">
              <Hash size={14} color="var(--multi)" />
              <span>{result.text_length.toLocaleString()} chars extracted</span>
            </div>
            <div className="paper-metric">
              {result.llm_enhanced
                ? <><Sparkles size={14} color="var(--accent-green)" /><span style={{ color: 'var(--accent-green)' }}>LLM Enhanced</span></>
                : <><FileText size={14} color="var(--text-3)" /><span>Template Analysis</span></>
              }
            </div>
          </div>

          {/* Report card */}
          <div className="card paper-report-card" ref={reportRef}>
            <div className="card-header">
              <FileText size={18} color="var(--primary)" />
              <h2>Analysis Report</h2>
              {result.llm_enhanced && (
                <span className="agent-badge badge-llm"><Sparkles size={10} /> AI Powered</span>
              )}
              <div className="report-header-actions">
                <button className="report-action-btn" onClick={handleDownloadPDF} title="Download PDF">
                  <Download size={14} /> PDF
                </button>
                {userEmail && (
                  <button
                    className={`report-action-btn report-action-save ${saveStatus === 'saved' ? 'report-action-saved' : ''}`}
                    onClick={handleSaveDraft}
                    disabled={saveStatus === 'saving'}
                    title="Save Draft"
                  >
                    {saveStatus === 'saving' ? <Loader2 size={14} className="spin" /> : saveStatus === 'saved' ? <CheckCircle size={14} /> : <Save size={14} />}
                    {saveStatus === 'saved' ? 'Saved' : 'Save'}
                  </button>
                )}
              </div>
            </div>
            <div className="markdown-content" dangerouslySetInnerHTML={md(result.report)} />
          </div>

          {/* Action buttons */}
          <div className="paper-actions">
            <button className="download-btn" onClick={handleDownloadPDF}>
              <Download size={16} /> Download PDF
            </button>
            <button className="analyze-again-btn" onClick={handleRemoveFile}>
              <Upload size={16} /> Analyze Another Paper
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
