import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle } from 'lucide-react';

const AUTH_API = 'http://127.0.0.1:8000/auth';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const endpoint = isLogin ? '/login' : '/signup';
    
    try {
      const { data } = await axios.post(`${AUTH_API}${endpoint}`, { email, password });
      setSuccess(isLogin ? 'Login successful!' : 'Account created & logged in!');
      
      // Store token
      localStorage.setItem('agentic_token', data.token);
      localStorage.setItem('agentic_email', data.email);
      
      // Notify App
      setTimeout(() => {
        onLogin(data.email);
      }, 1000);
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLogin ? 'Sign in to access your saved research.' : 'Sign up to use the Agentic Research Bot.'}</p>
        </div>

        {error && (
          <div className="error-box" style={{ margin: '0 0 1.5rem', padding: '0.8rem', fontSize: '0.85rem' }}>
            <AlertCircle size={16} color="#f87171" style={{minWidth: '16px'}} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="success-box" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', padding: '0.8rem', borderRadius: '8px', color: '#34d399', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input 
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button" 
            className="auth-switch-btn"
            onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
