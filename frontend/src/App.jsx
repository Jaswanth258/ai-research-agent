import React, { useState } from 'react';
import ResearchTool from './components/ResearchTool';
import AnalysisDashboard from './components/AnalysisDashboard';
import { Search, BarChart2 } from 'lucide-react';
import './index.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('research');

  return (
    <div className="app-root">
      <nav className="top-nav">
        <div className="nav-brand">
          <span className="brand-emoji">⚗️</span>
          <span className="brand-name">Agentic Research Bot</span>
        </div>

        <div className="nav-tabs">
          <button
            id="tab-research"
            className={`nav-tab ${activeTab === 'research' ? 'nav-tab-active' : ''}`}
            onClick={() => setActiveTab('research')}
          >
            <Search size={14} /> Research Tool
          </button>
          <button
            id="tab-analysis"
            className={`nav-tab ${activeTab === 'analysis' ? 'nav-tab-active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            <BarChart2 size={14} /> Comparative Analysis
          </button>
        </div>
      </nav>

      {activeTab === 'research' ? <ResearchTool /> : <AnalysisDashboard />}
    </div>
  );
}
