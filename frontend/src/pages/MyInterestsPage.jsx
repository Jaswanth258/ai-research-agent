import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked';
import { downloadReportPDF } from '../pdfExport';
import {
  Sparkles, AlertCircle, Loader2, Star, Trash2, X, Plus,
  FileText, Activity, TerminalSquare, RefreshCw, Cpu, Users, Download
} from 'lucide-react';

import { API_AUTH, API_HISTORY, API_RESEARCH } from '../api';

export default function MyInterestsPage({ userEmail }) {
  const [interests, setInterests] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [generatingFor, setGeneratingFor] = useState(null); // track which topic is being generated
  const [generateLogs, setGenerateLogs] = useState({});

  const token = localStorage.getItem('agentic_token');

  const fetchData = async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      // Fetch Profile
      const profileRes = await axios.get(`${API_AUTH}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let fetchedInterests = [];
      if (profileRes.data.research_interests) {
        fetchedInterests = profileRes.data.research_interests
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
      setInterests(fetchedInterests);

      // Fetch History
      const historyRes = await axios.get(`${API_HISTORY}/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoryItems(historyRes.data.items || []);
    } catch (err) {
      setError('Failed to load interests and history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveInterestsToBackend = async (newInterests) => {
    try {
      await axios.put(`${API_AUTH}/me/interests`, {
        research_interests: newInterests.join(', ')
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      setError('Failed to save updated interests.');
    }
  };

  const addInterest = () => {
    const newInterests = [...interests, ''];
    setInterests(newInterests);
  };

  const removeInterest = (index) => {
    const newInterests = interests.filter((_, i) => i !== index);
    setInterests(newInterests);
    saveInterestsToBackend(newInterests);
  };

  const updateInterest = (index, value) => {
    const newInterests = [...interests];
    newInterests[index] = value;
    setInterests(newInterests);
  };

  const handleInterestBlur = () => {
    // Save on blur so user doesn't have to hit a save button
    const cleanInterests = interests.map(i => i.trim()).filter(Boolean);
    saveInterestsToBackend(cleanInterests);
    
    // Set strictly the cleaned unique ones back (optional, prevents dups)
    if (JSON.stringify(cleanInterests) !== JSON.stringify(interests)) {
       setInterests(cleanInterests);
    }
  };

  // Agent Generate and Save flow
  const handleGenerate = async (topic) => {
    if (!topic || !token) return;
    setGeneratingFor(topic);
    setGenerateLogs(prev => ({ ...prev, [topic]: [] }));

    try {
      // 1. Run Research (Single Agent for speed, could be configurable)
      const { data } = await axios.post(API_RESEARCH, {
        topic: topic,
        mode: 'single',
        min_score: 0.30,
        max_papers: 5,
        date_range: null
      });

      // 2. Save to History explicitly
      try {
        await axios.post(`${API_HISTORY}/save`, {
            mode: 'single',
            topic: topic,
            result: data
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        // Warning: Failed to save to history, but we got the data.
        console.warn("Failed to persist to history");
      }

      // Refresh to pull the new history
      await fetchData();

    } catch (err) {
      setError(err.response?.data?.detail || `Failed to generate report for ${topic}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  const md = (src) => {
    const renderer = new marked.Renderer();
    renderer.link = ({ href, title, text }) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${text}</a>`;
    return { __html: marked(src || '', { renderer }) };
  };

  const modeLabel = (m) => m === 'single' ? 'Single Agent' : m === 'multi' ? 'Multi-Agent' : 'Comparison';
  const modeColor = (m) => m === 'single' ? '#818cf8' : m === 'multi' ? '#f472b6' : '#34d399';

  if (!token) {
    return (
      <div className="history-empty">
        <Star size={48} color="var(--text-3)" />
        <h2>Login Required</h2>
        <p>Sign in to view your research interests.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="history-empty">
        <Loader2 size={32} className="spin" color="var(--primary)" />
        <p>Loading My Interests…</p>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="history-title"><Star size={28} color="#eab308" /> My Interests</h1>
          <p className="history-subtitle">Manage topics you care about and instantly view AI literature reports for them.</p>
        </div>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={16} color="#f87171" />
          <span>{error}</span>
        </div>
      )}

      {/* Interests Manager */}
      <div className="card" style={{ marginBottom: '3rem', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-1)'}}>Edit Topics</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px' }}>
          {interests.map((interest, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <div className="input-wrapper" style={{ flex: 1, margin: 0 }}>
                <Star size={16} className="input-icon" color="#eab308" />
                <input
                  type="text"
                  placeholder="e.g., Computer Vision"
                  value={interest}
                  onChange={(e) => updateInterest(index, e.target.value)}
                  onBlur={handleInterestBlur}
                />
              </div>
              <button
                type="button"
                onClick={() => removeInterest(index)}
                className="icon-btn"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border-color)', borderRadius: '8px', minWidth: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', cursor: 'pointer' }}
                title="Remove Interest"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={addInterest}
            style={{
               alignSelf: 'flex-start',
               background: 'transparent',
               border: '1px dashed var(--border-color)',
               color: 'var(--text-2)',
               padding: '0.5rem 1rem',
               borderRadius: '8px',
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               gap: '0.5rem',
               transition: 'all 0.2s ease',
               fontSize: '0.9rem'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--text-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            <Plus size={16} /> Add Another Topic
          </button>
        </div>
      </div>

      {/* Reports View */}
      <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: 'var(--text-1)' }}>
        Interests Reports
      </h2>

      {interests.filter(i => i.trim() !== '').length === 0 ? (
        <p style={{ color: 'var(--text-3)' }}>Add some research interests above to track reports here.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {interests.filter(i => i.trim() !== '').map((topic, i) => {
            const cleanTopic = topic.trim();
            // Find the most recent history item matching the topic
            const historyItem = historyItems.find(h => h.topic.toLowerCase() === cleanTopic.toLowerCase());
            
            return (
              <div key={i} className="interest-report-block">
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} /> {cleanTopic}
                </h3>
                
                {historyItem ? (
                  // Show the report card
                  <div className="history-item-body" style={{ background: 'var(--bg-2)', borderRadius: '12px', padding: '1.5rem', borderLeft: `4px solid ${modeColor(historyItem.mode)}` }}>
                    <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={16} color={modeColor(historyItem.mode)} />
                        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{modeLabel(historyItem.mode)} Report for '{cleanTopic}'</h2>
                      </div>
                      <span className="history-date" style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>Saved on: new Date({historyItem.saved_at}).toLocaleDateString()</span>
                    </div>
                    
                    {historyItem.mode === 'compare' ? (
                      <div className="markdown-content">
                        {/* Simplistic render for Compare mode */}
                        <div dangerouslySetInnerHTML={md(historyItem.result.single?.report)} />
                        <hr style={{ margin: '2rem 0', borderColor: 'var(--border-color)'}} />
                        <div dangerouslySetInnerHTML={md(historyItem.result.multi?.report)} />
                      </div>
                    ) : (
                      <div className="markdown-content" dangerouslySetInnerHTML={md(historyItem.result.report)} />
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1.5rem' }}>
                        <button className="download-btn" onClick={() => {
                             const isCompare = historyItem.mode === 'compare';
                             if (isCompare) {
                               const combinedText = '# Single Agent\n\n' + (historyItem.result.single?.report || '') + '\n\n# Multi-Agent\n\n' + (historyItem.result.multi?.report || '');
                               downloadReportPDF(combinedText, `${cleanTopic} Comparison`);
                             } else {
                               downloadReportPDF(historyItem.result.report || '', `${cleanTopic} Report`);
                             }
                        }}>
                          <Download size={14} /> Download PDF
                        </button>
                    </div>
                  </div>
                ) : (
                  // No report exists, show Generate prompt
                  <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-2)', border: '1px dashed var(--border-color)' }}>
                    {generatingFor === cleanTopic ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Loader2 size={32} className="spin" color="var(--primary)" />
                        <p style={{ color: 'var(--text-2)' }}>Agents are actively researching <strong>{cleanTopic}</strong>...</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Star size={32} color="var(--text-3)" />
                        <p style={{ color: 'var(--text-2)' }}>You haven't generated an AI report for <strong>{cleanTopic}</strong> yet.</p>
                        <button 
                          className="run-btn" 
                          onClick={() => handleGenerate(cleanTopic)}
                          disabled={generatingFor !== null}
                          style={{ maxWidth: '200px' }}
                        >
                          <Sparkles size={16} /> Generate AI Report
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
