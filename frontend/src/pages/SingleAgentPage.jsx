import React from 'react';
import { Cpu, Zap, Link, FileText, CheckCircle } from 'lucide-react';

export default function SingleAgentPage() {
  return (
    <div className="dashboard" style={{ paddingTop: '2rem' }}>
      <section className="dash-hero">
        <div className="dash-badge" style={{ borderColor: 'rgba(129,140,248,0.3)', color: '#818cf8', background: 'rgba(129,140,248,0.1)' }}>
          🔵 Single Agent Architecture
        </div>
        <h1 className="dash-title">The Monolithic Approach</h1>
        <p className="dash-subtitle">
          A centralized, low-latency agent design where a single core class handles query expansion, paper retrieval, semantic ranking, and LLM synthesis.
        </p>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title"><Cpu size={20} /> How It Works</h2>
        <div className="card">
          <p style={{ color: 'var(--text-2)', lineHeight: '1.7', marginBottom: '1.5rem' }}>
            The Single Agent architecture uses a monolithic `SingleAgent` class. It is ideal for systems where cost efficiency, speed, and simplicity are paramount over exhaustive research depth. It performs its pipeline sequentially with minimal internal context-switching.
          </p>
          <div className="arch-mono-box">
            <div className="arch-agent-mono">
              <strong>1. Heuristic Query Expansion</strong>
              <p style={{fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1rem'}}>
                Instead of using an LLM to generate search variants, it relies on static domain heuristics. For example, if it sees the word "NLP", it automatically appends "transformer". (Max queries: 4).
              </p>
              
              <strong>2. Unified arXiv Search</strong>
              <p style={{fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1rem'}}>
                Uses the generated queries to fetch the top 5 papers per query from the arXiv feedparser API.
              </p>
              
              <strong>3. Semantic Ranking Gate</strong>
              <p style={{fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1rem'}}>
                Applies all-MiniLM-L6-v2 directly to rate relevancy against the user's prompt. It uses a lenient inclusion threshold of 0.30.
              </p>
              
              <strong>4. Single LLM Synthesis Call</strong>
              <p style={{fontSize: '0.85rem', color: 'var(--text-3)'}}>
                Aggregates all passing summaries and makes exactly one API call to Featherless AI to generate the final report, keeping token costs exceptionally low.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="findings-grid">
        <div className="finding-card finding-single">
          <div className="finding-icon">⚡</div>
          <h3>Unmatched Speed</h3>
          <p>By avoiding LLM planner steps and coordination overhead, the single agent completes its runs in ~3 to 6 seconds on average, prioritizing low-latency user experiences.</p>
        </div>
        <div className="finding-card finding-neutral">
          <div className="finding-icon">📉</div>
          <h3>Fewer Failure Points</h3>
          <p>A single linear sequence means fewer things can go wrong. There are no inter-agent communication timeouts or unexpected JSON formatting errors between steps.</p>
        </div>
      </div>
    </div>
  );
}
