import React, { useEffect, useRef } from 'react';
import {
  Search, Cpu, Users, FileUp, BarChart2, Sparkles,
  ArrowRight, Zap, Globe, Shield, Brain, Layers, GitCompare,
  ChevronDown, BookOpen, Network, FlaskConical
} from 'lucide-react';

export default function LandingPage({ onGetStarted, onLogin, isLoggedIn, userEmail }) {
  const heroRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      heroRef.current.style.setProperty('--mx', `${x * 20}px`);
      heroRef.current.style.setProperty('--my', `${y * 20}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="landing-root">
      {/* ───── Top Bar ───── */}
      <header className="landing-topbar">
        <div className="landing-brand">
          <span className="brand-emoji">⚗️</span>
          <span className="brand-name">Agentic Research Bot</span>
        </div>
        <div className="landing-topbar-right">
          {isLoggedIn ? (
            <span className="landing-user">{userEmail}</span>
          ) : (
            <button className="landing-login-btn" onClick={onLogin}>
              Sign In
            </button>
          )}
          <button className="landing-cta-sm" onClick={onGetStarted}>
            {isLoggedIn ? 'Go to Dashboard' : 'Get Started'}
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ───── Hero Section ───── */}
      <section className="landing-hero" ref={heroRef}>
        {/* Floating 3D elements */}
        <div className="hero-float-grid">
          <div className="float-card float-card-1">
            <Brain size={24} />
            <span>LLM Synthesis</span>
          </div>
          <div className="float-card float-card-2">
            <Network size={24} />
            <span>Semantic Search</span>
          </div>
          <div className="float-card float-card-3">
            <FlaskConical size={24} />
            <span>arXiv Papers</span>
          </div>
          <div className="float-card float-card-4">
            <Layers size={24} />
            <span>Multi-Agent</span>
          </div>
        </div>

        {/* Central orb */}
        <div className="hero-orb">
          <div className="orb-ring orb-ring-1" />
          <div className="orb-ring orb-ring-2" />
          <div className="orb-ring orb-ring-3" />
          <div className="orb-core">
            <Sparkles size={32} />
          </div>
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={12} />
            AI-Powered Research Intelligence
          </div>
          <h1 className="hero-heading">
            <span className="hero-heading-line">Discover. Analyze.</span>
            <span className="hero-heading-line hero-heading-accent">Synthesize.</span>
          </h1>
          <p className="hero-desc">
            Autonomous AI agents that search, rank, and synthesize academic papers 
            in seconds — so you can focus on what matters: your research.
          </p>
          <div className="hero-actions">
            <button className="hero-primary-btn" onClick={onGetStarted}>
              <Zap size={18} />
              {isLoggedIn ? 'Open Dashboard' : 'Start Exploring'}
            </button>
            <a href="#features" className="hero-secondary-btn">
              Learn More
              <ChevronDown size={16} />
            </a>
          </div>

          {/* Stats strip */}
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-num">2M+</span>
              <span className="hero-stat-label">arXiv Papers</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-num">4</span>
              <span className="hero-stat-label">AI Agents</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-num">&lt;10s</span>
              <span className="hero-stat-label">Avg Response</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-num">∞</span>
              <span className="hero-stat-label">Topics</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features Section ───── */}
      <section className="landing-features" id="features">
        <div className="features-header">
          <span className="section-badge">
            <Globe size={12} /> Platform Capabilities
          </span>
          <h2 className="section-heading">Everything You Need for Research</h2>
          <p className="section-desc">
            From automated paper discovery to deep comparative analysis — all powered by autonomous AI agents.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card feature-card-primary">
            <div className="feature-card-inner">
              <div className="feature-icon-wrap feature-icon-indigo">
                <Search size={24} />
              </div>
              <h3>AI Research Tool</h3>
              <p>
                Enter any research topic and let AI agents fetch, rank, and synthesize 
                the most relevant papers from arXiv using semantic embeddings.
              </p>
              <div className="feature-tags">
                <span className="feature-tag">arXiv API</span>
                <span className="feature-tag">MiniLM Embeddings</span>
                <span className="feature-tag">Real-time</span>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icon-wrap feature-icon-blue">
                <Cpu size={24} />
              </div>
              <h3>Single Agent</h3>
              <p>
                A monolithic agent that handles query expansion, retrieval, ranking, 
                and synthesis in one lightning-fast pipeline.
              </p>
              <div className="feature-tags">
                <span className="feature-tag">Low Latency</span>
                <span className="feature-tag">Cost Efficient</span>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icon-wrap feature-icon-pink">
                <Users size={24} />
              </div>
              <h3>Multi-Agent Pipeline</h3>
              <p>
                Four specialized agents — Planner, Researcher, Reviewer, Writer — 
                work sequentially for deeper, more comprehensive analysis.
              </p>
              <div className="feature-tags">
                <span className="feature-tag">4 Agents</span>
                <span className="feature-tag">LLM-Powered</span>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icon-wrap feature-icon-green">
                <FileUp size={24} />
              </div>
              <h3>Paper Analysis</h3>
              <p>
                Upload any PDF research paper. AI extracts text, identifies key insights,
                methodology, limitations, and future directions.
              </p>
              <div className="feature-tags">
                <span className="feature-tag">PDF Upload</span>
                <span className="feature-tag">Gap Analysis</span>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icon-wrap feature-icon-amber">
                <GitCompare size={24} />
              </div>
              <h3>Comparative Analysis</h3>
              <p>
                Run both agents on the same topic and compare their results side-by-side.
                Analyze speed vs depth trade-offs with real metrics.
              </p>
              <div className="feature-tags">
                <span className="feature-tag">Side-by-Side</span>
                <span className="feature-tag">Metrics</span>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icon-wrap feature-icon-violet">
                <BookOpen size={24} />
              </div>
              <h3>Save & Export</h3>
              <p>
                Save drafts to your personal research history, download PDF reports, 
                and build a persistent knowledge base over time.
              </p>
              <div className="feature-tags">
                <span className="feature-tag">MongoDB</span>
                <span className="feature-tag">PDF Export</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section className="landing-how">
        <div className="features-header">
          <span className="section-badge">
            <Layers size={12} /> Architecture
          </span>
          <h2 className="section-heading">How It Works</h2>
        </div>

        <div className="how-pipeline">
          <div className="how-step">
            <div className="how-step-num">01</div>
            <div className="how-step-content">
              <h4>Enter Topic</h4>
              <p>Provide a natural language research query — as broad or specific as you like.</p>
            </div>
          </div>
          <div className="how-connector" />
          <div className="how-step">
            <div className="how-step-num">02</div>
            <div className="how-step-content">
              <h4>Agent Discovery</h4>
              <p>AI agents expand your query, search arXiv, and fetch candidate papers in parallel.</p>
            </div>
          </div>
          <div className="how-connector" />
          <div className="how-step">
            <div className="how-step-num">03</div>
            <div className="how-step-content">
              <h4>Semantic Ranking</h4>
              <p>MiniLM embeddings score each paper's relevance — only the best survive the gate.</p>
            </div>
          </div>
          <div className="how-connector" />
          <div className="how-step">
            <div className="how-step-num">04</div>
            <div className="how-step-content">
              <h4>LLM Synthesis</h4>
              <p>Featherless AI generates a structured analysis report with insights and research gaps.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="landing-cta-section">
        <div className="cta-card">
          <div className="cta-glow" />
          <h2>Ready to Supercharge Your Research?</h2>
          <p>
            Join researchers using AI agents to discover papers faster and synthesize insights automatically.
          </p>
          <button className="hero-primary-btn" onClick={onGetStarted}>
            <Zap size={18} />
            {isLoggedIn ? 'Open Dashboard' : 'Get Started Free'}
          </button>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="landing-footer">
        <div className="landing-brand">
          <span className="brand-emoji">⚗️</span>
          <span className="brand-name">Agentic Research Bot</span>
        </div>
        <p>Built with FastAPI, React, Sentence-Transformers & Featherless AI</p>
      </footer>
    </div>
  );
}
