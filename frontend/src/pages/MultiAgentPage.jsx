import React from 'react';
import { Users, Layers, Activity, GitCommit } from 'lucide-react';

export default function MultiAgentPage() {
  return (
    <div className="dashboard" style={{ paddingTop: '2rem' }}>
      <section className="dash-hero">
        <div className="dash-badge" style={{ borderColor: 'rgba(244,114,182,0.3)', color: '#f472b6', background: 'rgba(244,114,182,0.1)' }}>
          🩷 Multi-Agent Pipeline
        </div>
        <h1 className="dash-title">The Orchestrator Approach</h1>
        <p className="dash-subtitle">
          A distributed pipeline of four specialized AI agents working sequentially. Each agent is responsible for a specific cognitive task, ensuring deep coverage and high quality checking.
        </p>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title"><Layers size={20} /> Agent Roster</h2>
        <div className="card">
          <p style={{ color: 'var(--text-2)', lineHeight: '1.7', marginBottom: '2rem' }}>
            Rather than relying on heuristics, the Multi-Agent system invokes LLM reasoning multiple times throughout its lifecycle to guarantee the depth and breadth of the research is fully explored.
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
            <p>Acts as the quality gatekeeper. Uses the MiniLM model to encode vector similarities, applying a 0.30 relevance threshold (equalized with single-agent). Only the most relevant papers survive this semantic gate.</p>
          </div>
          
          <div className="finding-card" style={{ borderTopColor: '#fb923c', borderTopWidth: '3px', borderTopStyle: 'solid' }}>
            <h3 style={{color: '#fb923c'}}>4. The Writer Agent</h3>
            <p>Uses a highly specialized LLM prompt. Instead of a basic summary, it writes an executive summary, conducts cross-paper advanced gap analysis, and synthesizes critical future research questions.</p>
          </div>
        </div>
      </section>

      <div className="findings-grid">
        <div className="finding-card finding-multi">
          <div className="finding-icon">🎯</div>
          <h3>LLM-Driven Research Depth</h3>
          <p>With equalized retrieval budgets (4q × 5p/q, θ=0.30), the multi-agent's advantage is purely architectural: LLM-diversified queries surface papers that heuristic expansion misses entirely.</p>
        </div>
        <div className="finding-card finding-llm">
          <div className="finding-icon">🧠</div>
          <h3>Modular Upgradability</h3>
          <p>Because the logic is separated, developers can easily swap the Planner's model to a cheaper 8B model while upgrading the Writer's model to a massive 70B reasoning model.</p>
        </div>
      </div>
    </div>
  );
}
