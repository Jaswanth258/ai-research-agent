import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Clock, Trash2, FileText, Activity, TerminalSquare,
  Sparkles, AlertCircle, Loader2, ChevronDown, ChevronUp, Cpu, Users, Download
} from 'lucide-react';

const API = 'http://127.0.0.1:8000/history';

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [clearing, setClearing] = useState(false);

  const token = localStorage.getItem('agentic_token');

  const fetchHistory = async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(data.items || []);
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail === 'Token expired' || detail === 'Invalid token') {
        // Clear stale auth so user can re-login
        localStorage.removeItem('agentic_token');
        localStorage.removeItem('agentic_email');
        setError('Your session has expired. Please log out and log back in to view your saved history.');
      } else {
        setError(detail || 'Failed to load history');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleClear = async () => {
    if (!window.confirm('Delete all saved research? This cannot be undone.')) return;
    setClearing(true);
    try {
      await axios.delete(`${API}/clear`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems([]);
    } catch (err) {
      setError('Failed to clear history');
    } finally {
      setClearing(false);
    }
  };

  const md = (src) => ({ __html: marked(src || '') });

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const modeLabel = (m) => m === 'single' ? 'Single Agent' : m === 'multi' ? 'Multi-Agent' : 'Comparison';
  const modeColor = (m) => m === 'single' ? '#818cf8' : m === 'multi' ? '#f472b6' : '#34d399';
  const ModeIcon = ({ mode }) => mode === 'multi' ? <Users size={14} /> : <Cpu size={14} />;
  const itemRefs = useRef({});

  const handleDownloadPDF = async (idx, topic) => {
    const el = itemRefs.current[idx];
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
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
      pdf.save(`${topic || 'research'}_report.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  if (!token) {
    return (
      <div className="history-empty">
        <Clock size={48} color="var(--text-3)" />
        <h2>Login Required</h2>
        <p>Sign in to save and view your research history.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="history-empty">
        <Loader2 size={32} className="spin" color="var(--primary)" />
        <p>Loading history…</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1 className="history-title"><Clock size={28} /> Research History</h1>
          <p className="history-subtitle">{items.length} saved {items.length === 1 ? 'result' : 'results'}</p>
        </div>
        {items.length > 0 && (
          <button className="clear-btn" onClick={handleClear} disabled={clearing}>
            <Trash2 size={14} /> {clearing ? 'Clearing…' : 'Clear All'}
          </button>
        )}
      </div>

      {error && (
        <div className="error-box">
          <AlertCircle size={16} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {items.length === 0 && !error ? (
        <div className="history-empty">
          <Clock size={48} color="var(--text-3)" />
          <h2>No Saved Research Yet</h2>
          <p>Run a search in the Tool tab and click the "Save" button to store results here.</p>
        </div>
      ) : (
        <div className="history-list">
          {items.map((item, i) => {
            const isExpanded = expandedIdx === i;
            const result = item.result || {};
            const isCompare = item.mode === 'compare';

            return (
              <div key={i} className="history-item" style={{ borderLeftColor: modeColor(item.mode) }}>
                <div
                  className="history-item-header"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                >
                  <div className="history-item-left">
                    <span className="history-mode-badge" style={{ color: modeColor(item.mode), borderColor: modeColor(item.mode) }}>
                      <ModeIcon mode={item.mode} /> {modeLabel(item.mode)}
                    </span>
                    <span className="history-topic">{item.topic}</span>
                  </div>
                  <div className="history-item-right">
                    <span className="history-date">{formatDate(item.saved_at)}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="history-item-body" ref={el => itemRefs.current[i] = el}>
                    {isCompare ? (
                      <div className="results-grid">
                        {result.single && (
                          <div className="result-col">
                            <div className="card" style={{ borderTop: '3px solid #818cf8' }}>
                              <div className="card-header">
                                <FileText size={16} color="#818cf8" />
                                <h2>Single Agent Report</h2>
                                {result.single.metrics?.llm_enhanced && (
                                  <span className="agent-badge badge-llm"><Sparkles size={10} /> LLM</span>
                                )}
                              </div>
                              <div className="markdown-content" dangerouslySetInnerHTML={md(result.single.report)} />
                            </div>
                          </div>
                        )}
                        {result.multi && (
                          <div className="result-col">
                            <div className="card" style={{ borderTop: '3px solid #f472b6' }}>
                              <div className="card-header">
                                <FileText size={16} color="#f472b6" />
                                <h2>Multi-Agent Report</h2>
                                {result.multi.metrics?.llm_enhanced && (
                                  <span className="agent-badge badge-llm"><Sparkles size={10} /> LLM</span>
                                )}
                              </div>
                              <div className="markdown-content" dangerouslySetInnerHTML={md(result.multi.report)} />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="card" style={{ borderTop: `3px solid ${modeColor(item.mode)}` }}>
                        <div className="card-header">
                          <FileText size={16} color={modeColor(item.mode)} />
                          <h2>{modeLabel(item.mode)} Report</h2>
                          {result.metrics?.llm_enhanced && (
                            <span className="agent-badge badge-llm"><Sparkles size={10} /> LLM</span>
                          )}
                        </div>
                        <div className="markdown-content" dangerouslySetInnerHTML={md(result.report)} />
                        <div style={{ marginTop: '1rem' }}>
                          <div className="card-header">
                            <Activity size={16} color="#34d399" />
                            <h2>Metrics</h2>
                          </div>
                          <div>
                            {result.metrics && Object.entries(result.metrics).map(([k, v]) => (
                              <div key={k} className="metric-row">
                                <span className="metric-key">{k.replace(/_/g, ' ')}</span>
                                <span className="metric-val">
                                  {typeof v === 'boolean' ? (v ? '✅ Yes' : '❌ No') : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                      <button className="download-btn" onClick={() => handleDownloadPDF(i, item.topic)}>
                        <Download size={14} /> Download PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
