import React from 'react';
import { Users, Layers, Activity, GitCommit, TrendingUp, MessageSquare } from 'lucide-react';

export default function MultiAgentPage() {
  return (
    <div className="dashboard" style={{ paddingTop: '2rem' }}>
      <section className="dash-hero">
        <div className="dash-badge" style={{ borderColor: 'rgba(244,114,182,0.3)', color: '#f472b6', background: 'rgba(244,114,182,0.1)' }}>
          🩷 Enhanced Multi-Agent Pipeline
        </div>
        <h1 className="dash-title">6-Agent Collaborative System</h1>
        <p className="dash-subtitle">
          A distributed pipeline of six specialized AI agents with a peer-review feedback loop. Each agent handles a specific cognitive task — from research planning to trend analysis to quality assurance — producing publication-grade analysis.
        </p>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title"><Layers size={20} /> Agent Roster</h2>
        <div className="card">
          <p style={{ color: 'var(--text-2)', lineHeight: '1.7', marginBottom: '2rem' }}>
            The Enhanced Multi-Agent system uses up to <strong>5 LLM calls</strong> across its lifecycle. The pipeline includes a feedback loop where the Critic reviews the Writer's draft and the Writer revises — producing significantly deeper, more reliable research reports.
          </p>
          
          <div className="finding-card" style={{ marginBottom: '1rem', borderTopColor: '#a78bfa' }}>
            <h3 style={{color: '#a78bfa'}}>1. The Planner Agent</h3>
            <p>Uses Featherless AI to intelligently draft up to 4 semantically diverse, lateral search queries based on the user's initial prompt. This breaks out of heuristic limitations and finds multi-disciplinary crossover papers.</p>
          </div>
          
          <div className="finding-card" style={{ marginBottom: '1rem', borderTopColor: '#818cf8', borderTopWidth: '3px', borderTopStyle: 'solid' }}>
            <h3 style={{color: '#818cf8'}}>2. The Researcher Agent</h3>
            <p>A pure execution agent. Takes the Planner's queries and hits the arXiv API, gathering up to 20 raw candidate papers (5 per query).</p>
          </div>
          
          <div className="finding-card" style={{ marginBottom: '1rem', borderTopColor: '#f472b6', borderTopWidth: '3px', borderTopStyle: 'solid' }}>
            <h3 style={{color: '#f472b6'}}>3. The Reviewer Agent</h3>
            <p>Acts as the quality gatekeeper. Uses the MiniLM model to encode vector similarities, applying a 0.30 relevance threshold. Only the most relevant papers survive this semantic gate.</p>
          </div>

          <div className="finding-card" style={{ marginBottom: '1rem', borderTopColor: '#0ea5e9', borderTopWidth: '3px', borderTopStyle: 'solid' }}>
            <h3 style={{color: '#0ea5e9'}}>4. The TrendAnalyst Agent <span style={{fontSize: '0.7rem', background: 'rgba(14,165,233,0.15)', padding: '2px 8px', borderRadius: '8px', marginLeft: '0.5rem'}}>NEW</span></h3>
            <p>Analyzes approved papers for temporal trends, methodology clusters, research hotspots, and field maturity. Identifies what's emerging vs. established and groups papers by approach (transformer-based, reinforcement learning, hybrid, etc.).</p>
          </div>
          
          <div className="finding-card" style={{ marginBottom: '1rem', borderTopColor: '#fb923c', borderTopWidth: '3px', borderTopStyle: 'solid' }}>
            <h3 style={{color: '#fb923c'}}>5. The Writer Agent</h3>
            <p>Uses a highly specialized LLM prompt to write an executive summary, cross-paper synthesis, advanced gap analysis, and critical research questions. Produces a first draft that goes through peer review.</p>
          </div>

          <div className="finding-card" style={{ borderTopColor: '#ef4444', borderTopWidth: '3px', borderTopStyle: 'solid' }}>
            <h3 style={{color: '#ef4444'}}>6. The Critic Agent <span style={{fontSize: '0.7rem', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '8px', marginLeft: '0.5rem'}}>NEW</span></h3>
            <p>Acts as a senior peer reviewer — identifies weaknesses, missing connections, unsupported claims, and structural issues in the Writer's draft. Sends revision instructions back to the Writer for a second, polished pass with methodology comparison tables and confidence assessment.</p>
          </div>
        </div>
      </section>

      {/* Pipeline Flow Diagram */}
      <section className="dash-section">
        <h2 className="dash-section-title"><Activity size={20} /> Pipeline Flow</h2>
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600' }}>
            <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.3)' }}>Planner</span>
            <span style={{ color: 'var(--text-3)' }}>→</span>
            <span style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(129,140,248,0.3)' }}>Researcher</span>
            <span style={{ color: 'var(--text-3)' }}>→</span>
            <span style={{ background: 'rgba(244,114,182,0.15)', color: '#f472b6', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(244,114,182,0.3)' }}>Reviewer</span>
            <span style={{ color: 'var(--text-3)' }}>→</span>
            <span style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(14,165,233,0.3)' }}>TrendAnalyst</span>
            <span style={{ color: 'var(--text-3)' }}>→</span>
            <span style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(251,146,60,0.3)' }}>Writer</span>
            <span style={{ color: 'var(--text-3)' }}>→</span>
            <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>Critic</span>
            <span style={{ color: 'var(--text-3)' }}>→</span>
            <span style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(251,146,60,0.3)' }}>Writer ✍️</span>
          </div>
          <p style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginTop: '1rem' }}>
            Feedback loop: Critic reviews draft → Writer revises with critique + trend insights → Final polished report
          </p>
        </div>
      </section>

      <div className="findings-grid">
        <div className="finding-card finding-multi">
          <div className="finding-icon">🎯</div>
          <h3>LLM-Driven Research Depth</h3>
          <p>With up to 5 LLM calls across 6 agents, the system delivers publication-quality analysis. The feedback loop ensures claims are validated and connections between papers are strengthened.</p>
        </div>
        <div className="finding-card finding-llm">
          <div className="finding-icon">🔄</div>
          <h3>Peer-Review Feedback Loop</h3>
          <p>The Critic → Writer revision cycle mimics academic peer review: the Critic identifies weaknesses, and the Writer addresses them — producing reports with methodology comparisons and confidence assessments.</p>
        </div>
        <div className="finding-card" style={{ borderTop: '3px solid #0ea5e9' }}>
          <div className="finding-icon">📈</div>
          <h3>Trend Intelligence</h3>
          <p>The TrendAnalyst identifies emerging research directions, methodology clusters, and field maturity — going beyond simple paper summaries to provide strategic research intelligence.</p>
        </div>
      </div>
    </div>
  );
}
