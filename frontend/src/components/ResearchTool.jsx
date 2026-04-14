import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { marked } from 'marked';
import { downloadReportPDF } from '../pdfExport';
import {
  Search, Loader2, FileText, Activity, TerminalSquare,
  GitCompare, Cpu, Users, Sparkles, AlertCircle, RefreshCw, Bell, X,
  Bookmark, CheckCircle, Sliders, BarChart2, Download, Save, LogIn
} from 'lucide-react';

import { API_RESEARCH, API_HISTORY, API_STREAM } from '../api';

export default function ResearchTool({ userEmail, onRequestLogin }) {
  const [topic, setTopic] = useState('');
  const [mode, setMode]   = useState('single');
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  const [minScore, setMinScore] = useState(0.30);
  const [maxPapers, setMaxPapers] = useState(5);
  const [dateRange, setDateRange] = useState('any');
  const [showFilters, setShowFilters] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const resultsRef = useRef(null);

  // ── Per-mode result caches ───────────────────────────────────────────────
  const [cachedTopic, setCachedTopic]     = useState('');
  const [singleResult, setSingleResult]   = useState(null);
  const [multiResult, setMultiResult]     = useState(null);
  const [compareResult, setCompareResult] = useState(null);

  // ── Per-mode independent loading states ─────────────────────────────────
  // Each mode can run in the background while user browses another mode's result
  const [modeLoading, setModeLoading] = useState({ single: false, multi: false, compare: false });

  // ── Toast notifications ──────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const notifCounter = useRef(0);

  const addNotif = useCallback((msg, targetMode, color) => {
    const id = ++notifCounter.current;
    setNotifications(n => [...n, { id, msg, targetMode, color }]);
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 10000);
  }, []);

  const dismissNotif = (id) => setNotifications(n => n.filter(x => x.id !== id));

  const jumpToMode = (targetMode, notifId) => {
    setMode(targetMode);
    dismissNotif(notifId);
  };

  // Current mode's result
  const currentResult =
    mode === 'single'  ? singleResult  :
    mode === 'multi'   ? multiResult   :
    compareResult;

  const isCurrentLoading = modeLoading[mode];

  // Clear all caches when topic text changes
  const handleTopicChange = (e) => {
    const val = e.target.value;
    setTopic(val);
    if (val.trim() !== cachedTopic) {
      setSingleResult(null);
      setMultiResult(null);
      setCompareResult(null);
      setError(null);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    // Auth gate — require login to run searches
    if (!userEmail) {
      onRequestLogin?.();
      return;
    }

    const runMode   = mode;
    const runTopic  = topic.trim();

    // Smart Compare: if both already cached, combine instantly
    if (runMode === 'compare' && singleResult && multiResult && cachedTopic === runTopic) {
      setCompareResult({ comparison: true, single: singleResult, multi: multiResult, reused: true });
      return;
    }

    // Start this mode's background run — does NOT block other modes
    setModeLoading(prev => ({ ...prev, [runMode]: true }));
    setError(null);
    setLiveLogs([]);

    const runId = Math.random().toString(36).substring(7);
    const eventSource = new EventSource(`${API_STREAM}/${runId}`);
    
    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        eventSource.close();
      } else {
        setLiveLogs(prev => [...prev, event.data]);
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      const { data } = await axios.post(API_RESEARCH, { 
        topic: runTopic, 
        mode: runMode,
        min_score: minScore,
        max_papers: maxPapers,
        date_range: dateRange === 'any' ? null : dateRange,
        run_id: runId
      });
      setCachedTopic(runTopic);

      if (runMode === 'single') {
        setSingleResult(data);
        addNotif('🔵 Single Agent finished — result ready!', 'single', '#818cf8');
      } else if (runMode === 'multi') {
        setMultiResult(data);
        addNotif('🩷 Multi-Agent finished — result ready!', 'multi', '#f472b6');
      } else {
        setSingleResult(data.single);
        setMultiResult(data.multi);
        setCompareResult({ comparison: true, single: data.single, multi: data.multi, reused: false });
        addNotif('⚡ Comparison complete — both results ready!', 'compare', '#34d399');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Is the backend running?');
    } finally {
      setModeLoading(prev => ({ ...prev, [runMode]: false }));
      eventSource.close();
    }
  };

  // ── Save to MongoDB History ───────────────────────────────────────────
  const handleSave = async () => {
    const token = localStorage.getItem('agentic_token');
    if (!token) { setError('Login to save results'); return; }
    if (!currentResult) return;

    setSaveStatus('saving');
    try {
      const resultPayload = mode === 'compare'
        ? { single: compareResult.single, multi: compareResult.multi }
        : currentResult;

      await axios.post(`${API_HISTORY}/save`, {
        topic: cachedTopic,
        mode,
        result: resultPayload,
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
    let text = (src || '').replace(/^\uFEFF/, '');
    text = text.split('\n').map(line => line.replace(/^\t+/, '').replace(/^    /, '')).join('\n');
    return { __html: marked.parse ? marked.parse(text, { gfm: true, breaks: false }) : marked(text) };
  };

  // ── Download Report as PDF ────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const currentResult = mode === 'single' ? singleResult : mode === 'multi' ? multiResult : null;
    if (currentResult?.report) {
      downloadReportPDF(currentResult.report, `${cachedTopic || 'Research'} Report`);
    } else if (compareResult) {
      // For compare mode, download both in one PDF
      const combinedText = 
        '# Single Agent Report\n\n' + (compareResult.single?.report || '') +
        '\n\n---\n\n# Multi-Agent Report\n\n' + (compareResult.multi?.report || '');
      downloadReportPDF(combinedText, `${cachedTopic || 'Research'} Comparison`);
    }
  };

  const renderMetrics = (metrics) => (
    <div>
      {Object.entries(metrics).map(([k, v]) => (
        <div key={k} className="metric-row">
          <span className="metric-key">{k.replace(/_/g, ' ')}</span>
          <span className={`metric-val ${k === 'llm_enhanced' && v ? 'good' : ''}`}>
            {typeof v === 'boolean' ? (v ? '✅ Yes' : '❌ No') : String(v)}
          </span>
        </div>
      ))}
    </div>
  );

  const renderSteps = (steps) => (
    <ul className="step-list">
      {steps.map((s, i) => <li key={i} className="step-item">{s}</li>)}
    </ul>
  );

  const renderRelevanceChart = (data) => {
    const allScored = data.metrics?.all_scored_papers;
    const threshold = data.metrics?.threshold || 0.3;
    if (!allScored || allScored.length === 0) return null;
    return (
      <div className="card">
        <div className="card-header">
          <BarChart2 size={18} color="#8b5cf6" />
          <h2>Relevance Distribution</h2>
        </div>
        <div className="relevance-chart" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {allScored.slice(0, 15).map((p, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-1)', fontWeight: p.passed ? '500' : 'normal' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }} title={p.paper.title}>
                  {p.paper.title}
                </span>
                <span style={{ color: p.passed ? 'var(--primary)' : 'var(--text-3)' }}>{p.score.toFixed(3)}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--bg-1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.min(100, Math.max(0, p.score * 100))}%`, 
                  background: p.passed ? 'var(--primary)' : 'var(--text-3)', 
                  transition: 'width 0.5s ease',
                  opacity: p.passed ? 1 : 0.6
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderColumn = (data, label, color, badgeClass) => (
    <div className="result-col">
      <div className="card" style={{ borderTop: `3px solid ${color}` }}>
        <div className="card-header">
          <FileText size={18} color={color} />
          <h2>{label} Report</h2>
          {data.metrics?.llm_enhanced && (
            <span className="agent-badge badge-llm"><Sparkles size={10} /> LLM Enhanced</span>
          )}
          <div className="report-header-actions">
            <button className="report-action-btn" onClick={handleDownloadPDF} title="Download PDF">
              <Download size={14} /> PDF
            </button>
            {userEmail && (
              <button 
                className={`report-action-btn report-action-save ${saveStatus === 'saved' ? 'report-action-saved' : ''}`} 
                onClick={handleSave} 
                disabled={saveStatus === 'saving'}
                title="Save Draft"
              >
                {saveStatus === 'saving' ? <Loader2 size={14} className="spin" /> : saveStatus === 'saved' ? <CheckCircle size={14} /> : <Save size={14} />}
                {saveStatus === 'saved' ? 'Saved' : 'Save'}
              </button>
            )}
          </div>
        </div>
        <div className="markdown-content" dangerouslySetInnerHTML={md(data.report)} />
      </div>
      <div className="card">
        <div className="card-header">
          <Activity size={18} color="#34d399" />
          <h2>Run Metrics</h2>
        </div>
        {renderMetrics(data.metrics)}
      </div>
      {data.quality_metrics && (
        <div className="card" style={{ borderTop: '3px solid #a78bfa' }}>
          <div className="card-header">
            <BarChart2 size={18} color="#a78bfa" />
            <h2>Report Quality</h2>
            <span className="agent-badge" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
              Evaluation
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {data.quality_metrics.rouge_available && (
              <>
                <div className="quality-metric-card">
                  <span className="quality-metric-val">{(data.quality_metrics.rouge_1 * 100).toFixed(1)}%</span>
                  <span className="quality-metric-label">ROUGE-1</span>
                </div>
                <div className="quality-metric-card">
                  <span className="quality-metric-val">{(data.quality_metrics.rouge_2 * 100).toFixed(1)}%</span>
                  <span className="quality-metric-label">ROUGE-2</span>
                </div>
                <div className="quality-metric-card">
                  <span className="quality-metric-val">{(data.quality_metrics.rouge_l * 100).toFixed(1)}%</span>
                  <span className="quality-metric-label">ROUGE-L</span>
                </div>
              </>
            )}
            <div className="quality-metric-card">
              <span className="quality-metric-val">{(data.quality_metrics.lexical_diversity * 100).toFixed(1)}%</span>
              <span className="quality-metric-label">Lexical Diversity</span>
            </div>
            <div className="quality-metric-card">
              <span className="quality-metric-val">{(data.quality_metrics.coverage_ratio * 100).toFixed(0)}%</span>
              <span className="quality-metric-label">Source Coverage</span>
            </div>
            <div className="quality-metric-card">
              <span className="quality-metric-val">{data.quality_metrics.word_count}</span>
              <span className="quality-metric-label">Word Count</span>
            </div>
          </div>
          {data.quality_metrics.key_terms?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginRight: '0.3rem', lineHeight: '1.8' }}>Key Terms:</span>
              {data.quality_metrics.key_terms.map((t, i) => (
                <span key={i} className="feature-tag" style={{ fontSize: '0.7rem' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {renderRelevanceChart(data)}
      <div className="card">
        <div className="card-header">
          <TerminalSquare size={18} color="#fbbf24" />
          <h2>Execution Steps</h2>
          <span className={`agent-badge ${badgeClass}`}>{data.steps?.length} steps</span>
        </div>
        {renderSteps(data.steps)}
      </div>
    </div>
  );

  const modes = [
    { id: 'single',  label: 'Single Agent', icon: <Cpu size={15} />,        active: 'mode-active-single'  },
    { id: 'multi',   label: 'Multi-Agent',  icon: <Users size={15} />,      active: 'mode-active-multi'   },
    { id: 'compare', label: 'Compare Both', icon: <GitCompare size={15} />, active: 'mode-active-compare' },
  ];

  const resultFor = { single: singleResult, multi: multiResult, compare: compareResult };
  const alreadyRan = !!currentResult && cachedTopic === topic.trim();
  const willReuse  = mode === 'compare' && singleResult && multiResult && cachedTopic === topic.trim() && !compareResult;

  // Any mode currently running (not just the current one)
  const anyLoading = Object.values(modeLoading).some(Boolean);

  return (
    <div className="tool-root">
      {/* Hero */}
      <div className="tool-hero">
        <h1 className="tool-title">AI Research Helper</h1>
        <p className="tool-subtitle">
          Discover and synthesize the latest academic papers using AI —
          powered by arXiv and semantic search.
        </p>
      </div>

      {/* Controls */}
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div className="mode-selector">
          {modes.map(m => {
            const isLoading  = modeLoading[m.id];
            const hasCached  = !!resultFor[m.id] && cachedTopic === topic.trim();
            return (
              <button
                key={m.id}
                className={`mode-btn ${mode === m.id ? m.active : ''}`}
                onClick={() => { setMode(m.id); setError(null); }}
              >
                {isLoading
                  ? <Loader2 size={14} className="spin" />
                  : m.icon
                }
                {m.label}
                {isLoading && (
                  <span className="mode-running-badge">running…</span>
                )}
                {!isLoading && hasCached && (
                  <span className={`cache-dot ${m.id === 'single' ? 'single-dot' : m.id === 'multi' ? 'multi-dot' : ''}`} />
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearch}>
          <div className="search-bar-wrap" style={{ maxWidth: '860px' }}>
            <input
              className="search-input"
              value={topic}
              onChange={handleTopicChange}
              placeholder="e.g. Transformer-Based Object Detection"
              disabled={modeLoading[mode]}
            />
            <button
              className="search-btn"
              type="submit"
              disabled={modeLoading[mode] || !topic.trim()}
            >
              {modeLoading[mode]
                ? <><Loader2 size={18} className="spin" /> Running…</>
                : alreadyRan
                  ? <><RefreshCw size={18} /> Re-run</>
                  : <><Search size={18} /> Explore</>
              }
            </button>
            <button 
              type="button" 
              className={`search-btn ${showFilters ? 'active-filter-btn' : ''}`} 
              style={{ background: showFilters ? 'var(--primary)' : 'var(--bg-2)', color: showFilters ? 'white' : 'var(--text-1)', padding: '0 1rem' }}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Sliders size={18} />
            </button>
          </div>
          
          {showFilters && (
            <div className="filters-panel" style={{ maxWidth: '860px', margin: '1rem auto 0', padding: '1rem', background: 'var(--bg-2)', borderRadius: '8px', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-2)', fontWeight: '500' }}>Min Relevance Score ({minScore})</label>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={minScore} 
                  onChange={(e) => setMinScore(parseFloat(e.target.value))} 
                  style={{ width: '150px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-2)', fontWeight: '500' }}>Max Papers Count</label>
                <input 
                  type="number" min="1" max="20" 
                  value={maxPapers} 
                  onChange={(e) => setMaxPapers(parseInt(e.target.value) || 5)} 
                  style={{ width: '100px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-1)', color: 'var(--text-1)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-2)', fontWeight: '500' }}>Date Range</label>
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value)}
                  style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-1)', color: 'var(--text-1)' }}
                >
                  <option value="any">Any Time</option>
                  <option value="1y">Last 1 Year</option>
                  <option value="3y">Last 3 Years</option>
                </select>
              </div>
            </div>
          )}
        </form>

        {/* Context hints */}
        {mode === 'compare' && !modeLoading.compare && !compareResult && (
          willReuse ? (
            <div className="compare-banner" style={{ borderColor: 'rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.08)' }}>
              <Sparkles size={16} color="#34d399" />
              <span>Both agents already ran — <strong>Explore will combine them instantly</strong>, no re-run.</span>
            </div>
          ) : (
            <div className="compare-banner">
              <GitCompare size={16} />
              Runs <strong>both agents simultaneously</strong>. Or run each agent first then compare instantly.
            </div>
          )
        )}

        {/* Background run notice */}
        {anyLoading && !modeLoading[mode] && (
          <div className="bg-run-notice">
            <Loader2 size={13} className="spin" />
            {Object.entries(modeLoading)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(' & ')} agent running in background — you'll be notified when done.
          </div>
        )}

        {/* Cache status strip */}
        {cachedTopic && cachedTopic === topic.trim() && (
          <div className="cache-strip">
            {singleResult  && <span className="cache-tag single-tag">🔵 Single cached</span>}
            {multiResult   && <span className="cache-tag multi-tag">🩷 Multi cached</span>}
            {compareResult?.reused && <span className="cache-tag" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)' }}>⚡ Compare: used cached</span>}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="error-box">
          <AlertCircle size={18} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* Results area — switches instantly between cached modes */}
      <div className="results-area" ref={resultsRef} style={{ marginTop: '2rem' }}>
        {isCurrentLoading && !currentResult ? (
          /* First-time run for this mode — show spinner & live logs */
          <div className="skeleton" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="skeleton-pulse" />
              <span>Running {mode === 'compare' ? 'both agents in parallel' : `${mode} agent`}…</span>
            </div>
            {liveLogs.length > 0 && (
              <div style={{ width: '100%', maxWidth: '860px', padding: '1rem', background: 'var(--bg-2)', borderRadius: '8px', border: '1px solid var(--border-color)', height: '240px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                {liveLogs.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: '0.5rem', opacity: idx === liveLogs.length - 1 ? 1 : 0.7 }}>
                    <span style={{ color: 'var(--primary)', marginRight: '0.5rem' }}>&gt;</span> {log}
                  </div>
                ))}
                {/* Invisible element to auto-scroll to bottom */}
                <div ref={(el) => el && el.scrollIntoView({ behavior: 'smooth' })} />
              </div>
            )}
          </div>
        ) : currentResult ? (
          /* Show cached result — instant, no waiting */
          mode === 'compare' && compareResult ? (
            <>
              {compareResult.reused && (
                <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--accent-green)' }}>
                  ⚡ Showing cached results — no new API calls made
                </div>
              )}
              <div className="results-grid">
                {renderColumn(compareResult.single, 'Single Agent', '#818cf8', 'badge-single')}
                {renderColumn(compareResult.multi,  'Multi-Agent',  '#f472b6', 'badge-multi')}
              </div>
            </>
          ) : (
            <div className="results-grid single-col">
              {renderColumn(
                currentResult,
                mode === 'multi' ? 'Multi-Agent' : 'Single Agent',
                mode === 'multi' ? '#f472b6' : '#818cf8',
                mode === 'multi' ? 'badge-multi' : 'badge-single'
              )}
            </div>
          )
        ) : null}

        {/* Action buttons — shown when results exist */}
        {currentResult && !isCurrentLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="download-btn" onClick={handleDownloadPDF}>
              <Download size={16} /> Download PDF
            </button>
            {localStorage.getItem('agentic_token') && (
              <button
                className={`save-btn ${saveStatus === 'saved' ? 'save-btn-done' : ''}`}
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? (
                  <><Loader2 size={16} className="spin" /> Saving…</>
                ) : saveStatus === 'saved' ? (
                  <><CheckCircle size={16} /> Saved to History</>
                ) : saveStatus === 'error' ? (
                  <><AlertCircle size={16} /> Save Failed — Retry</>
                ) : (
                  <><Bookmark size={16} /> Save to History</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Toast Notifications ── */}
      <div className="notif-stack">
        {notifications.map(n => (
          <div key={n.id} className="notif-toast" style={{ borderLeftColor: n.color }}>
            <Bell size={15} color={n.color} style={{ flexShrink: 0 }} />
            <span className="notif-msg">{n.msg}</span>
            <button
              className="notif-view-btn"
              style={{ color: n.color, borderColor: n.color }}
              onClick={() => jumpToMode(n.targetMode, n.id)}
            >
              View
            </button>
            <button className="notif-dismiss" onClick={() => dismissNotif(n.id)}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
