import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { marked } from 'marked';
import { downloadReportPDF } from '../pdfExport';
import {
  Search, Loader2, FileText, Activity, TerminalSquare,
  GitCompare, Cpu, Users, Sparkles, AlertCircle, RefreshCw, Bell, X,
  Bookmark, CheckCircle, Sliders, BarChart2, Download, Save, LogIn,
  Copy, ExternalLink, ChevronDown, ChevronUp, Compass, TrendingUp,
  BookOpen, Check, Layers, ArrowUpRight
} from 'lucide-react';

import { API_RESEARCH, API_HISTORY, API_STREAM, API_AUTH } from '../api';

const LANGGRAPH_NODES = [
  { id: 'planner', label: 'Planner', desc: 'Query Strategy', icon: Compass },
  { id: 'researcher', label: 'Researcher', desc: 'Hybrid Retrieval', icon: Search },
  { id: 'reviewer', label: 'Reviewer', desc: 'Quality Gate & FAISS', icon: CheckCircle },
  { id: 'trend_analyst', label: 'Trend Analyst', desc: 'K-Means Clustering', icon: TrendingUp },
  { id: 'writer_draft', label: 'Writer', desc: 'Deep Synthesis', icon: FileText },
  { id: 'critic', label: 'Critic & Polish', desc: 'Self-Correction', icon: Sparkles }
];

export default function ResearchTool({ userEmail, onRequestLogin, onNavigate }) {
  const [topic, setTopic] = useState('');
  const [mode, setMode]   = useState('multi');
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [toastMessage, setToastMessage] = useState(null);
  const [expandedPapers, setExpandedPapers] = useState({});

  const [minScore, setMinScore] = useState(0.30);
  const [maxPapers, setMaxPapers] = useState(5);
  const [dateRange, setDateRange] = useState('any');
  const [showFilters, setShowFilters] = useState(false);
  const [liveLogs, setLiveLogs] = useState([]);
  const resultsRef = useRef(null);

  const [userInterests, setUserInterests] = useState([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('agentic_token');
      if (!userEmail || !token) {
        setUserInterests([]);
        return;
      }
      try {
        const { data } = await axios.get(`${API_AUTH}/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data.research_interests) {
          const interests = data.research_interests
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          setUserInterests(interests);
        } else {
          setUserInterests([]);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, [userEmail]);

  // ── Per-mode result caches ───────────────────────────────────────────────
  const [cachedTopic, setCachedTopic]     = useState('');
  const [singleResult, setSingleResult]   = useState(null);
  const [multiResult, setMultiResult]     = useState(null);
  const [compareResult, setCompareResult] = useState(null);

  // ── Per-mode independent loading states ─────────────────────────────────
  const [modeLoading, setModeLoading] = useState({ single: false, multi: false, compare: false });

  // ── Toast notifications ──────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const notifCounter = useRef(0);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

  const togglePaperExpand = (idx) => {
    setExpandedPapers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Current mode's result
  const currentResult =
    mode === 'single'  ? singleResult  :
    mode === 'multi'   ? multiResult   :
    compareResult;

  const isCurrentLoading = modeLoading[mode];

  // Active LangGraph node calculation
  const getActiveNodeIndex = () => {
    if (!isCurrentLoading || liveLogs.length === 0) return -1;
    const lastLog = liveLogs[liveLogs.length - 1] || '';
    if (lastLog.includes('[Planner') || lastLog.includes('Query strategy') || lastLog.includes('queries')) return 0;
    if (lastLog.includes('[Researcher') || lastLog.includes('arXiv') || lastLog.includes('searching')) return 1;
    if (lastLog.includes('[Reviewer') || lastLog.includes('Evaluating') || lastLog.includes('Approved') || lastLog.includes('FAISS')) return 2;
    if (lastLog.includes('[TrendAnalyst') || lastLog.includes('Clustering') || lastLog.includes('K-Means') || lastLog.includes('trends')) return 3;
    if (lastLog.includes('[Writer Draft') || lastLog.includes('Synthesizing') || lastLog.includes('draft')) return 4;
    if (lastLog.includes('[Critic') || lastLog.includes('[Writer Revision') || lastLog.includes('Revision') || lastLog.includes('complete')) return 5;
    return 1;
  };

  const activeNodeIdx = getActiveNodeIndex();

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

  const handleSearch = (e) => {
    e?.preventDefault?.();
    executeSearch();
  };

  const executeSearch = async (runTopicOverride) => {
    const runTopic = (typeof runTopicOverride === 'string' ? runTopicOverride : topic).trim();
    if (!runTopic) return;

    // Auth gate — require login to run searches
    if (!userEmail) {
      onRequestLogin?.();
      return;
    }

    const runMode = mode;

    // Smart Compare: if both already cached, combine instantly
    if (runMode === 'compare' && singleResult && multiResult && cachedTopic === runTopic) {
      setCompareResult({ comparison: true, single: singleResult, multi: multiResult, reused: true });
      return;
    }

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
        addNotif('🩷 Multi-Agent LangGraph finished — report ready!', 'multi', '#f43f5e');
      } else {
        setSingleResult(data.single);
        setMultiResult(data.multi);
        setCompareResult({ comparison: true, single: data.single, multi: data.multi, reused: false });
        addNotif('⚡ Comparison complete — both results ready!', 'compare', '#10b981');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Is the backend running?');
    } finally {
      setModeLoading(prev => ({ ...prev, [runMode]: false }));
      eventSource.close();
    }
  };

  // ── Save to MongoDB / SQLite History ──────────────────────────────────
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
      showToast("Saved to Research History!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const md = (src) => {
    let text = (src || '').replace(/^\uFEFF/, '');
    text = text.split('\n').map(line => line.replace(/^\t+/, '').replace(/^    /, '')).join('\n');
    const renderer = new marked.Renderer();
    renderer.link = ({ href, title, text }) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${text}</a>`;
    return { __html: marked.parse ? marked.parse(text, { gfm: true, breaks: false, renderer }) : marked(text) };
  };

  // ── Actions ──────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const currentRes = mode === 'single' ? singleResult : mode === 'multi' ? multiResult : null;
    if (currentRes?.report) {
      downloadReportPDF(currentRes.report, `${cachedTopic || 'Research'} Report`);
      showToast("PDF report generated!");
    } else if (compareResult) {
      const combinedText = 
        '# Single Agent Report\n\n' + (compareResult.single?.report || '') +
        '\n\n---\n\n# Multi-Agent Report\n\n' + (compareResult.multi?.report || '');
      downloadReportPDF(combinedText, `${cachedTopic || 'Research'} Comparison`);
      showToast("Comparison PDF report generated!");
    }
  };

  const handleCopyMarkdown = (reportText) => {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    showToast("Report copied to clipboard!");
  };

  const handleCopyBibTeX = (p) => {
    const paper = p.paper || p;
    const title = paper.title || 'Untitled';
    const authors = Array.isArray(paper.authors) ? paper.authors.join(' and ') : 'Unknown';
    const cleanId = title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '2026';
    const bib = `@article{${cleanId},\n  title={${title}},\n  author={${authors}},\n  url={${paper.url || ''}},\n  year={2026}\n}`;
    navigator.clipboard.writeText(bib);
    showToast("BibTeX citation copied!");
  };

  // ── Render Components ────────────────────────────────────────────────
  const renderMetrics = (metrics) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
      {Object.entries(metrics)
        .filter(([k]) => k !== 'all_scored_papers' && k !== 'ranked_papers')
        .map(([k, v]) => (
          <div key={k} className="metric-row" style={{ background: 'var(--card-2)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span className="metric-key" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
            <span className={`metric-val ${k === 'llm_enhanced' && v ? 'good' : ''}`} style={{ fontSize: '0.9rem', fontWeight: '600' }}>
              {typeof v === 'boolean' ? (v ? '✅ Yes' : '❌ No') : String(v)}
            </span>
          </div>
      ))}
    </div>
  );

  const renderSteps = (steps) => (
    <ul className="step-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
      {steps.map((s, i) => (
        <li key={i} className="step-item" style={{ fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
          <span style={{ color: 'var(--primary-light)', marginRight: '0.5rem' }}>[{i+1}]</span> {s}
        </li>
      ))}
    </ul>
  );

  const renderPaperCard = (item, idx) => {
    const p = item.paper || item;
    const score = item.score !== undefined ? item.score : null;
    const isExpanded = !!expandedPapers[idx];
    const scorePct = score !== null ? Math.round(score * 100) : null;
    const isHighScore = scorePct !== null && scorePct >= 65;

    return (
      <div key={idx} className="paper-card-v2">
        <div className="paper-card-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="paper-rank-badge">#{String(idx + 1).padStart(2, '0')}</span>
            {p.source === 'faiss_rag' ? (
              <span className="paper-rank-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' }}>
                🧠 Vector Memory
              </span>
            ) : (
              <span className="paper-rank-badge" style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' }}>
                arXiv Discovery
              </span>
            )}
          </div>
          {scorePct !== null && (
            <div className={`paper-relevance-chip ${isHighScore ? 'score-high' : 'score-med'}`}>
              <Sparkles size={12} />
              <span>{scorePct}% Relevance</span>
            </div>
          )}
        </div>

        <a 
          href={p.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="paper-title-link"
        >
          {p.title}
          <ArrowUpRight size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }} />
        </a>

        <div className="paper-meta-row">
          <span>👥 {Array.isArray(p.authors) ? p.authors.slice(0, 3).join(', ') : 'Unknown Authors'}</span>
          {p.published && <span>📅 {String(p.published).slice(0, 10)}</span>}
        </div>

        {p.summary && (
          <div className="paper-abstract-v2">
            {isExpanded ? p.summary : `${p.summary.slice(0, 220)}...`}
            <button 
              onClick={() => togglePaperExpand(idx)}
              style={{ background: 'transparent', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', marginLeft: '0.5rem' }}
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        <div className="paper-actions-bar">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="paper-action-pill">
            <ExternalLink size={12} /> View on arXiv
          </a>
          <button onClick={() => handleCopyBibTeX(item)} className="paper-action-pill">
            <Copy size={12} /> Copy BibTeX
          </button>
          {p.url && p.url.includes('abs') && (
            <a 
              href={p.url.replace('/abs/', '/pdf/') + '.pdf'} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="paper-action-pill"
              style={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}
            >
              <Download size={12} /> PDF
            </a>
          )}
        </div>
      </div>
    );
  };

  const renderColumn = (data, label, color, badgeClass) => {
    const scoredList = data.metrics?.all_scored_papers || data.metrics?.ranked_papers || [];
    
    return (
      <div className="result-col">
        {/* Report Section */}
        <div className="card" style={{ borderTop: `3px solid ${color}`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FileText size={20} color={color} />
              <h2>{label} Report</h2>
              {data.metrics?.llm_enhanced && (
                <span className="agent-badge badge-llm" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                  <Sparkles size={11} /> 27B Groq Powered
                </span>
              )}
            </div>
            
            <div className="report-toolbar">
              <button 
                className="report-tool-btn" 
                onClick={() => handleCopyMarkdown(data.report)}
                title="Copy Markdown Report"
              >
                <Copy size={13} /> Copy Markdown
              </button>
              <button 
                className="report-tool-btn" 
                onClick={handleDownloadPDF} 
                title="Download Formatted PDF"
              >
                <Download size={13} /> Export PDF
              </button>
              {userEmail && (
                <button 
                  className={`report-tool-btn ${saveStatus === 'saved' ? 'report-action-saved' : ''}`} 
                  onClick={handleSave} 
                  disabled={saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? <Loader2 size={13} className="spin" /> : saveStatus === 'saved' ? <CheckCircle size={13} color="#10b981" /> : <Save size={13} />}
                  {saveStatus === 'saved' ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
          </div>
          
          <div className="markdown-content" style={{ fontSize: '0.98rem', lineHeight: '1.7', marginTop: '1rem' }} dangerouslySetInnerHTML={md(data.report)} />
        </div>

        {/* Paper Rankings & Evaluation Section */}
        {scoredList.length > 0 && (
          <div className="card">
            <div className="card-header">
              <BarChart2 size={18} color="#10b981" />
              <h2>Ranked Research Papers</h2>
              <span className="agent-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                {scoredList.length} Papers Evaluated
              </span>
            </div>
            <div className="paper-cards-grid">
              {scoredList.map((item, idx) => renderPaperCard(item, idx))}
            </div>
          </div>
        )}

        {/* Run Metrics */}
        <div className="card">
          <div className="card-header">
            <Activity size={18} color="#34d399" />
            <h2>System Execution Metrics</h2>
          </div>
          {renderMetrics(data.metrics)}
        </div>

        {/* Execution Steps Log */}
        <div className="card">
          <div className="card-header">
            <TerminalSquare size={18} color="#fbbf24" />
            <h2>LangGraph Execution Trace</h2>
            <span className={`agent-badge ${badgeClass}`}>{data.steps?.length} steps completed</span>
          </div>
          {renderSteps(data.steps)}
        </div>
      </div>
    );
  };

  const modes = [
    { id: 'multi',   label: 'Multi-Agent (LangGraph)', icon: <Users size={15} />,      active: 'mode-active-multi', desc: '6-Node iterative pipeline with critic & trend analysis' },
    { id: 'single',  label: 'Single Agent (Linear)',  icon: <Cpu size={15} />,        active: 'mode-active-single', desc: 'Fast single-pass paper discovery' },
    { id: 'compare', label: 'Compare Both',           icon: <GitCompare size={15} />, active: 'mode-active-compare', desc: 'Side-by-side architectural benchmark' },
  ];

  const resultFor = { single: singleResult, multi: multiResult, compare: compareResult };
  const alreadyRan = !!currentResult && cachedTopic === topic.trim();
  const willReuse  = mode === 'compare' && singleResult && multiResult && cachedTopic === topic.trim() && !compareResult;
  const anyLoading = Object.values(modeLoading).some(Boolean);

  return (
    <div className="tool-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="copy-toast">
          <Check size={16} style={{ display: 'inline', marginRight: '6px' }} />
          {toastMessage}
        </div>
      )}

      {/* Hero Header */}
      <div className="tool-hero">
        <h1 className="tool-title">Agentic Research Studio</h1>
        <p className="tool-subtitle">
          Discover, evaluate, and synthesize peer-reviewed academic literature with 
          autonomous 6-node LangGraph orchestration and hybrid FAISS retrieval.
        </p>
      </div>

      {/* Search & Mode Controls Capsule */}
      <div className="search-capsule-container">
        {/* Mode Selector */}
        <div className="mode-selector">
          {modes.map(m => {
            const isLoading = modeLoading[m.id];
            const hasCached = !!resultFor[m.id] && cachedTopic === topic.trim();
            return (
              <button
                key={m.id}
                className={`mode-btn ${mode === m.id ? m.active : ''}`}
                onClick={() => { setMode(m.id); setError(null); }}
              >
                {isLoading ? <Loader2 size={14} className="spin" /> : m.icon}
                {m.label}
                {isLoading && <span className="mode-running-badge">running…</span>}
                {!isLoading && hasCached && (
                  <span className={`cache-dot ${m.id === 'single' ? 'single-dot' : m.id === 'multi' ? 'multi-dot' : ''}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Input Capsule */}
        <form onSubmit={handleSearch}>
          <div className="search-bar-v2">
            <Search size={20} color="var(--primary-light)" style={{ flexShrink: 0, marginLeft: '4px' }} />
            <input
              className="search-input-v2"
              value={topic}
              onChange={handleTopicChange}
              placeholder="Enter research topic (e.g. LLM Reasoning, Diffusion Models in Medical Imaging)"
              disabled={modeLoading[mode]}
            />
            
            <span className="kbd-badge">↵ Enter</span>

            <button 
              type="button" 
              className="paper-action-pill" 
              style={{ background: showFilters ? 'var(--primary)' : 'rgba(255,255,255,0.06)', color: showFilters ? 'white' : 'var(--text-2)', marginRight: '0.5rem' }}
              onClick={() => setShowFilters(!showFilters)}
              title="Search Filters"
            >
              <Sliders size={15} />
            </button>

            <button
              className="search-btn"
              type="submit"
              disabled={modeLoading[mode] || !topic.trim()}
              style={{ padding: '0.75rem 1.6rem', borderRadius: '12px' }}
            >
              {modeLoading[mode] ? (
                <><Loader2 size={16} className="spin" /> Synthesizing…</>
              ) : alreadyRan ? (
                <><RefreshCw size={16} /> Re-run</>
              ) : (
                <><Sparkles size={16} /> Run Research</>
              )}
            </button>
          </div>
          
          {/* Advanced Filter Drawer */}
          {showFilters && (
            <div className="filters-panel" style={{ marginTop: '1rem', padding: '1.25rem 1.5rem', background: 'var(--card)', borderRadius: '16px', display: 'flex', gap: '2rem', flexWrap: 'wrap', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: '600' }}>
                  Relevance Threshold: <span style={{ color: 'var(--primary-light)' }}>{minScore}</span>
                </label>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={minScore} 
                  onChange={(e) => setMinScore(parseFloat(e.target.value))} 
                  style={{ width: '160px', accentColor: 'var(--primary)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: '600' }}>Max Papers Count</label>
                <input 
                  type="number" min="1" max="20" 
                  value={maxPapers} 
                  onChange={(e) => setMaxPapers(parseInt(e.target.value) || 5)} 
                  style={{ width: '100px', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: '600' }}>Publication Date</label>
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}
                >
                  <option value="any">Any Time</option>
                  <option value="1y">Last 1 Year</option>
                  <option value="3y">Last 3 Years</option>
                </select>
              </div>
            </div>
          )}
        </form>

        {/* User Research Interests Quick Tags */}
        {userEmail && userInterests.length > 0 && (
          <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Sparkles size={12} color="var(--primary-light)" /> Quick Search My Interests
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {userInterests.map((interest, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    setTopic(interest);
                    executeSearch(interest);
                  }}
                  className="paper-action-pill"
                  style={{ 
                    background: topic === interest ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: topic === interest ? '#fff' : 'var(--text-2)',
                    borderColor: topic === interest ? 'var(--primary)' : 'var(--border)'
                  }}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comparison Helper Banner */}
        {mode === 'compare' && !modeLoading.compare && !compareResult && (
          <div className="compare-banner" style={{ marginTop: '1.25rem' }}>
            <GitCompare size={16} color="var(--primary-light)" />
            <span>Runs <strong>Single Agent</strong> and <strong>LangGraph Multi-Agent</strong> side-by-side for architectural comparison.</span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-box" style={{ maxWidth: '860px', marginTop: '1.5rem' }}>
          <AlertCircle size={18} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Interactive LangGraph 6-Node Tracker (Active during execution) ── */}
      {isCurrentLoading && (
        <div className="langgraph-tracker">
          <div className="tracker-header">
            <span className="tracker-title">
              <Layers size={16} color="var(--primary-light)" /> LangGraph 6-Node Workflow Stream
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Loader2 size={12} className="spin" /> Node {activeNodeIdx + 1} of 6 executing
            </span>
          </div>

          <div className="tracker-nodes">
            {LANGGRAPH_NODES.map((node, i) => {
              const Icon = node.icon;
              const isActive = activeNodeIdx === i;
              const isDone = activeNodeIdx > i;
              return (
                <div key={node.id} className={`tracker-node ${isActive ? 'node-active' : isDone ? 'node-done' : ''}`}>
                  <div className="node-icon-box">
                    <Icon size={18} />
                  </div>
                  <span className="node-label">{node.label}</span>
                  <span className="node-status-chip">
                    {isActive ? 'Processing' : isDone ? 'Completed' : 'Queued'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Live streaming trace terminal */}
          {liveLogs.length > 0 && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', border: '1px solid var(--border)', height: '180px', overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: 'var(--text-2)', textAlign: 'left' }}>
              {liveLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '0.4rem', opacity: idx === liveLogs.length - 1 ? 1 : 0.65 }}>
                  <span style={{ color: 'var(--primary-light)', marginRight: '0.5rem' }}>&gt;</span> {log}
                </div>
              ))}
              <div ref={(el) => el && el.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          )}
        </div>
      )}

      {/* ── Results Area ── */}
      <div className="results-area" ref={resultsRef} style={{ marginTop: '2rem' }}>
        {currentResult && !isCurrentLoading ? (
          mode === 'compare' && compareResult ? (
            <div className="results-grid">
              {renderColumn(compareResult.single, 'Single Agent', '#0ea5e9', 'badge-single')}
              {renderColumn(compareResult.multi,  'Multi-Agent (LangGraph)', '#f43f5e', 'badge-multi')}
            </div>
          ) : (
            <div className="results-grid single-col">
              {renderColumn(
                currentResult,
                mode === 'multi' ? 'LangGraph Multi-Agent' : 'Single Agent',
                mode === 'multi' ? '#f43f5e' : '#0ea5e9',
                mode === 'multi' ? 'badge-multi' : 'badge-single'
              )}
            </div>
          )
        ) : null}
      </div>

      {/* Toast Notifications */}
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
