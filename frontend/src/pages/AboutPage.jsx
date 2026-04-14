import React from 'react';
import { Info, Target, Cpu, CheckCircle } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="dashboard" style={{ paddingTop: '2rem' }}>
      <section className="dash-hero">
        <div className="dash-badge">🤖 About the Tool</div>
        <h1 className="dash-title">AI Agentic Research Helper</h1>
        <p className="dash-subtitle">
          An advanced academic search engine that leverages Semantic Embeddings, LLMs, and autonomous agents to retrieve, evaluate, and synthesize research papers automatically.
        </p>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title"><Target size={20} /> Project Mission</h2>
        <div className="card">
          <p style={{ color: 'var(--text-2)', lineHeight: '1.7' }}>
            The sheer volume of new research papers published daily makes it impossible for humans to read everything. 
            The <strong>Agentic Research Helper</strong> is designed to automate the discovery phase of the scientific process. 
            It accepts a broad natural language topic, formulates diverse queries, fetches papers via the arXiv API, 
            semantically ranks them against your intent, and uses large language models (LLMs) to write a comprehensive synthesis report.
          </p>
        </div>
      </section>

      <div className="findings-grid">
        <div className="finding-card finding-neutral">
          <div className="finding-icon">⚡</div>
          <h3>Local Search & Filtering</h3>
          <p>We use <strong>all-MiniLM-L6-v2</strong> to generate embeddings locally, meaning high-speed relevance calculation with zero external API costs. Only the top-scoring papers are sent to the LLM for deep synthesis.</p>
        </div>
        <div className="finding-card finding-llm">
          <div className="finding-icon">🧠</div>
          <h3>Featherless AI Integration</h3>
          <p>We utilize Featherless AI (a scalable OpenAI-compatible API) to power the reasoning and synthesis. The LLM translates dense academic abstracts into readable executive summaries and identifies critical research gaps.</p>
        </div>
        <div className="finding-card finding-single">
          <div className="finding-icon">🔬</div>
          <h3>Research Framework</h3>
          <p>This application was heavily developed as a testing framework to measure the cost-benefit trade-offs of monolithic (Single Agent) vs specialized (Multi-Agent) AI pipelines. Read our Comparative Analysis tab for real-world metrics.</p>
        </div>
        <div className="finding-card finding-multi">
          <div className="finding-icon">🌐</div>
          <h3>Open Access Data</h3>
          <p>All data is sourced directly from arXiv through the feedparser API in real-time, meaning your synthesized reports reflect state-of-the-art advances up to the very present moment.</p>
        </div>
      </div>
    </div>
  );
}
