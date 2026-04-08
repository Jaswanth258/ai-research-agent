import React, { useState } from 'react';
import axios from 'axios';
import { marked } from 'marked';
import {
  Search, Loader2, FileText, Activity, TerminalSquare,
  GitCompare, Cpu, Users, Sparkles, AlertCircle
} from 'lucide-react';

const API = 'http://127.0.0.1:8000/research';

export default function ResearchTool() {
  const [topic, setTopic]     = useState('');
  const [mode, setMode]       = useState('single');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError]     = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const { data } = await axios.post(API, { topic, mode });
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const md = (src) => ({ __html: marked(src || '') });

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

  const renderColumn = (data, label, color, badgeClass) => (
    <div className="result-col">
      <div className="card" style={{ borderTop: `3px solid ${color}` }}>
        <div className="card-header">
          <FileText size={18} color={color} />
          <h2>{label} Report</h2>
          {data.metrics?.llm_enhanced && (
            <span className="agent-badge badge-llm"><Sparkles size={10} /> LLM Enhanced</span>
          )}
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
    { id: 'single',  label: 'Single Agent',     icon: <Cpu size={15} />,       active: 'mode-active-single' },
    { id: 'multi',   label: 'Multi-Agent',       icon: <Users size={15} />,     active: 'mode-active-multi'  },
    { id: 'compare', label: 'Compare Both',      icon: <GitCompare size={15} />,active: 'mode-active-compare'},
  ];

  return (
    <div className="tool-root">
      {/* Hero */}
      <div className="tool-hero">
        <h1 className="tool-title">AI Research Helper</h1>
        <p className="tool-subtitle">
          Discover and synthesize the latest academic papers using AI — powered by arXiv and semantic search.
        </p>
      </div>

      {/* Controls */}
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div className="mode-selector">
          {modes.map(m => (
            <button
              key={m.id}
              className={`mode-btn ${mode === m.id ? m.active : ''}`}
              onClick={() => setMode(m.id)}
              disabled={loading}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch}>
          <div className="search-bar-wrap">
            <input
              className="search-input"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Transformer-Based Object Detection"
              disabled={loading}
            />
            <button className="search-btn" type="submit" disabled={loading || !topic.trim()}>
              {loading ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
              {loading ? 'Searching…' : 'Explore'}
            </button>
          </div>
        </form>

        {mode === 'compare' && !loading && !results && (
          <div className="compare-banner">
            <GitCompare size={16} />
            Comparison mode runs <strong>both agents simultaneously</strong> on the same topic for a controlled experiment.
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

      {/* Loading */}
      {loading && (
        <div className="skeleton">
          <div className="skeleton-pulse" />
          <span>Running {mode === 'compare' ? 'both agents in parallel' : `${mode} agent`}…</span>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div className="results-area">
          {results.comparison ? (
            <div className="results-grid">
              {renderColumn(results.single, 'Single Agent', '#818cf8', 'badge-single')}
              {renderColumn(results.multi,  'Multi-Agent',  '#f472b6', 'badge-multi')}
            </div>
          ) : (
            <div className="results-grid single-col">
              {renderColumn(
                results,
                mode === 'multi' ? 'Multi-Agent' : 'Single Agent',
                mode === 'multi' ? '#f472b6' : '#818cf8',
                mode === 'multi' ? 'badge-multi' : 'badge-single'
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
