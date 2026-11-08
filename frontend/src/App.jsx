import React, { useState, useEffect } from 'react';
import ResearchTool from './components/ResearchTool';
import AnalysisDashboard from './components/AnalysisDashboard';
import SingleAgentPage from './pages/SingleAgentPage';
import MultiAgentPage from './pages/MultiAgentPage';
import AboutPage from './pages/AboutPage';
import AuthPage from './pages/AuthPage';
import HistoryPage from './pages/HistoryPage';
import MyInterestsPage from './pages/MyInterestsPage';
import PaperAnalysisPage from './pages/PaperAnalysisPage';
import LandingPage from './pages/LandingPage';
import { 
  Search, BarChart2, Info, LogIn, LogOut, Cpu, Users, 
  Clock, FileUp, Star, Sparkles, Plus, FlaskConical 
} from 'lucide-react';
import './index.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    // Check if user has an existing session
    const savedEmail = localStorage.getItem('agentic_email');
    const savedToken = localStorage.getItem('agentic_token');
    if (savedEmail && savedToken) {
      setUserEmail(savedEmail);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('agentic_token');
    localStorage.removeItem('agentic_email');
    setUserEmail(null);
    setActiveTab('landing');
  };

  const handleRequestLogin = () => {
    setActiveTab('auth');
  };

  return (
    <div className="app-root">
      {/* SaaS Top Navigation */}
      {activeTab !== 'landing' && (
        <nav className="top-nav">
          <div 
            className="nav-brand" 
            onClick={() => setActiveTab('landing')}
            style={{ cursor: 'pointer' }}
          >
            <div className="brand-icon-wrap">
              <FlaskConical size={18} />
            </div>
            <div className="brand-info">
              <span className="brand-name">Agentic Research</span>
              <span className="brand-badge">
                <span className="pulse-dot" /> LangGraph 6-Node Active
              </span>
            </div>
          </div>

          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'research' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('research')}
            >
              <Search size={14} /> Studio
            </button>
            <button
              className={`nav-tab ${activeTab === 'analysis' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              <BarChart2 size={14} /> Benchmarks
            </button>
            <button
              className={`nav-tab ${activeTab === 'multi' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('multi')}
            >
              <Users size={14} /> Multi-Agent
            </button>
            <button
              className={`nav-tab ${activeTab === 'single' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('single')}
            >
              <Cpu size={14} /> Single-Agent
            </button>
            <button
              className={`nav-tab ${activeTab === 'paper' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('paper')}
            >
              <FileUp size={14} /> Paper Analyzer
            </button>
            <button
              className={`nav-tab ${activeTab === 'about' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <Info size={14} /> About
            </button>
            {userEmail && (
              <>
                <button
                  className={`nav-tab ${activeTab === 'interests' ? 'nav-tab-active' : ''}`}
                  onClick={() => setActiveTab('interests')}
                >
                  <Star size={14} /> Interests
                </button>
                <button
                  className={`nav-tab ${activeTab === 'history' ? 'nav-tab-active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  <Clock size={14} /> History
                </button>
              </>
            )}
          </div>

          <div className="nav-right-actions">
            {activeTab !== 'research' && (
              <button 
                className="nav-action-btn nav-login-btn"
                onClick={() => setActiveTab('research')}
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', border: 'none', color: '#fff' }}
              >
                <Plus size={14} /> New Research
              </button>
            )}

            {userEmail ? (
              <div className="nav-user-chip">
                <div className="user-avatar-gradient" />
                <span>{userEmail.split('@')[0]}</span>
                <button 
                  onClick={handleLogout} 
                  className="nav-action-btn nav-logout-btn"
                  title="Sign out"
                  style={{ padding: '0.2rem 0.4rem', border: 'none' }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                className="nav-action-btn nav-login-btn"
                onClick={() => setActiveTab('auth')}
              >
                <LogIn size={14} /> Sign In
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Pages Container */}
      <div style={{ flex: 1 }}>
        {/* Landing page */}
        {activeTab === 'landing' && (
          <LandingPage 
            onGetStarted={() => setActiveTab(userEmail ? 'research' : 'auth')}
            onLogin={() => setActiveTab('auth')}
            isLoggedIn={!!userEmail}
            userEmail={userEmail}
          />
        )}

        {/* Research tool stays mounted so its cache isn't destroyed when switching tabs */}
        <div style={{ display: activeTab === 'research' ? 'block' : 'none' }}>
          <ResearchTool 
            userEmail={userEmail} 
            onRequestLogin={handleRequestLogin} 
            onNavigate={setActiveTab}
          />
        </div>

        {/* Paper analysis stays mounted to preserve upload/analysis state */}
        <div style={{ display: activeTab === 'paper' ? 'block' : 'none' }}>
          <PaperAnalysisPage 
            userEmail={userEmail} 
            onRequestLogin={handleRequestLogin} 
          />
        </div>
        
        {activeTab === 'analysis' && <AnalysisDashboard />}
        {activeTab === 'single' && <SingleAgentPage />}
        {activeTab === 'multi' && <MultiAgentPage />}
        {activeTab === 'about' && <AboutPage />}
        {activeTab === 'history' && <HistoryPage />}
        {activeTab === 'interests' && <MyInterestsPage userEmail={userEmail} />}
        
        {activeTab === 'auth' && (
          <AuthPage onLogin={(email) => {
            setUserEmail(email);
            localStorage.setItem('agentic_email', email);
            setActiveTab('research');
          }} />
        )}
      </div>
    </div>
  );
}
