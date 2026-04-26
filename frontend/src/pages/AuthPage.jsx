import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle,
  User, Building2, GraduationCap, Sparkles, ArrowLeft,
  Eye, EyeOff, KeyRound, ShieldCheck, Chrome, Plus, X
} from 'lucide-react';

import { API_AUTH } from '../api';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Password-strength meter                                                  */
/* ────────────────────────────────────────────────────────────────────────── */
function getPasswordStrength(pw) {
  if (!pw) return { label: '', pct: 0, cls: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { label: 'Weak', pct: 20, cls: 'strength-weak' };
  if (score === 2) return { label: 'Fair', pct: 40, cls: 'strength-fair' };
  if (score === 3) return { label: 'Good', pct: 65, cls: 'strength-good' };
  if (score === 4) return { label: 'Strong', pct: 85, cls: 'strength-strong' };
  return { label: 'Very Strong', pct: 100, cls: 'strength-very-strong' };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main Component                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
export default function AuthPage({ onLogin }) {
  // Views: 'login' | 'signup' | 'forgot' | 'otp' | 'reset-success'
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Signup fields
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [role, setRole] = useState('');
  const [researchInterests, setResearchInterests] = useState(['']);

  // Forgot password / OTP
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const otpRefs = useRef([]);
  const googleBtnRef = useRef(null);

  // Clear messages on view change
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [view]);

  /* ── Google Sign-In setup ──────────────────────────────────────────────── */
  const handleGoogleResponse = useCallback(async (response) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_AUTH}/google`, {
        credential: response.credential,
      });
      localStorage.setItem('agentic_token', data.token);
      localStorage.setItem('agentic_email', data.email);
      setSuccess('Signed in with Google!');
      setTimeout(() => onLogin(data.email), 800);
    } catch (err) {
      setError(err.response?.data?.detail || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  }, [onLogin]);

  useEffect(() => {
    // Initialize Google Sign-In when the GSI library loads
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: window.__GOOGLE_CLIENT_ID || '',
          callback: handleGoogleResponse,
        });
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: 340,
          });
        }
      }
    };

    // Fetch client ID from backend config endpoint or use embedded value
    const fetchClientId = async () => {
      try {
        const { data } = await axios.get(`${API_AUTH}/google-client-id`);
        window.__GOOGLE_CLIENT_ID = data.client_id;
      } catch {
        // If endpoint doesn't exist, Google button won't work — that's OK
      }
      initGoogle();
    };

    // Wait for GSI library to load
    if (window.google?.accounts?.id) {
      fetchClientId();
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          fetchClientId();
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [handleGoogleResponse]);

  /* ── Login Handler ─────────────────────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return setError('Please fill in all fields');
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_AUTH}/login`, {
        email: loginEmail,
        password: loginPassword,
      });
      localStorage.setItem('agentic_token', data.token);
      localStorage.setItem('agentic_email', data.email);
      setSuccess('Login successful!');
      setTimeout(() => onLogin(data.email), 800);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Signup Handler ────────────────────────────────────────────────────── */
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword || !fullName) {
      return setError('Name, email and password are required');
    }
    if (signupPassword.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (signupPassword !== signupConfirm) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_AUTH}/signup`, {
        email: signupEmail,
        password: signupPassword,
        full_name: fullName,
        institution,
        role,
        research_interests: researchInterests.filter(i => i.trim() !== '').join(', '),
      });
      localStorage.setItem('agentic_token', data.token);
      localStorage.setItem('agentic_email', data.email);
      setSuccess('Account created! Logging you in…');
      setTimeout(() => onLogin(data.email), 800);
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Forgot Password Handler ───────────────────────────────────────────── */
  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return setError('Please enter your email');
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_AUTH}/forgot-password`, { email: forgotEmail });
      setSuccess('OTP sent! Check your email inbox.');
      setTimeout(() => {
        setView('otp');
        setSuccess('');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  /* ── OTP Input Handling ────────────────────────────────────────────────── */
  const handleOtpChange = (idx, val) => {
    if (val.length > 1) val = val.slice(-1);
    if (val && !/^\d$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val;
    setOtpDigits(next);
    // Auto-advance
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      setOtpDigits(paste.split(''));
      otpRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  /* ── Verify OTP ────────────────────────────────────────────────────────── */
  const handleVerifyOTP = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) return setError('Please enter the full 6-digit OTP');
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_AUTH}/verify-otp`, { email: forgotEmail, otp });
      setOtpVerified(true);
      setSuccess('OTP verified! Set your new password.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset Password ────────────────────────────────────────────────────── */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return setError('New password must be at least 6 characters');
    }
    if (newPassword !== confirmNewPw) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_AUTH}/reset-password`, {
        email: forgotEmail,
        new_password: newPassword,
      });
      setView('reset-success');
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(
    view === 'signup' ? signupPassword : newPassword
  );

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="auth-page">
      {/* Animated background orbs */}
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className={`auth-card ${view === 'signup' ? 'auth-card-wide' : ''}`}>
        {/* Animated gradient border */}
        <div className="auth-card-border" />

        {/* ── Alert Messages ── */}
        {error && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="auth-alert auth-alert-success">
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* ═══════════ LOGIN VIEW ═══════════ */}
        {view === 'login' && (
          <div className="auth-view auth-view-enter">
            <div className="auth-header">
              <div className="auth-logo">
                <span className="auth-logo-emoji">⚗️</span>
              </div>
              <h2>Welcome Back</h2>
              <p>Sign in to continue your research</p>
            </div>

            {/* Google Sign-In Button */}
            <div className="google-signin-wrap">
              <div ref={googleBtnRef} className="google-btn-container" />
              <button
                type="button"
                className="google-btn-fallback"
                onClick={() => {
                  if (window.google?.accounts?.id) {
                    window.google.accounts.id.prompt();
                  } else {
                    setError('Google Sign-In is not available');
                  }
                }}
                disabled={loading}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    onClick={() => setShowLoginPw(!showLoginPw)}
                    tabIndex={-1}
                  >
                    {showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="auth-actions-row">
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => setView('forgot')}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="btn-spinner" />
                ) : (
                  <>
                    <LogIn size={18} /> Sign In
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              Don't have an account?{' '}
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => setView('signup')}
              >
                Create one
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ SIGNUP VIEW ═══════════ */}
        {view === 'signup' && (
          <div className="auth-view auth-view-enter">
            <div className="auth-header">
              <div className="auth-logo">
                <Sparkles size={28} className="auth-logo-icon" />
              </div>
              <h2>Create Your Account</h2>
              <p>Join the Agentic Research platform</p>
            </div>

            <form onSubmit={handleSignup} className="auth-form">
              {/* Row: Name + Email */}
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <div className="input-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <div className="input-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                </div>
              </div>

              {/* Row: Password + Confirm */}
              <div className="form-row">
                <div className="form-group">
                  <label>Password *</label>
                  <div className="input-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showSignupPw ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowSignupPw(!showSignupPw)}
                      tabIndex={-1}
                    >
                      {showSignupPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {signupPassword && (
                    <div className="password-strength-wrap">
                      <div className="password-strength-bar">
                        <div
                          className={`password-strength-fill ${strength.cls}`}
                          style={{ width: `${strength.pct}%` }}
                        />
                      </div>
                      <span className={`password-strength-label ${strength.cls}`}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <div className="input-wrapper">
                    <ShieldCheck size={16} className="input-icon" />
                    <input
                      type="password"
                      placeholder="Re-enter password"
                      value={signupConfirm}
                      onChange={(e) => setSignupConfirm(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div className="auth-section-divider">
                <span>Profile Details</span>
              </div>

              {/* Row: Institution + Role */}
              <div className="form-row">
                <div className="form-group">
                  <label>Institution / University</label>
                  <div className="input-wrapper">
                    <Building2 size={16} className="input-icon" />
                    <input
                      type="text"
                      placeholder="MIT, Stanford, etc."
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <div className="input-wrapper">
                    <GraduationCap size={16} className="input-icon" />
                    <select
                      className="auth-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select your role…</option>
                      <option value="Student">Student</option>
                      <option value="Researcher">Researcher</option>
                      <option value="PhD Scholar">PhD Scholar</option>
                      <option value="Professor">Professor</option>
                      <option value="Industry Professional">Industry Professional</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Research Interests */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Research Interests</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {researchInterests.map((interest, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                      <div className="input-wrapper" style={{ flex: 1, margin: 0 }}>
                        <Sparkles size={16} className="input-icon" />
                        <input
                          type="text"
                          placeholder="e.g., Machine Learning"
                          value={interest}
                          onChange={(e) => {
                            const newInterests = [...researchInterests];
                            newInterests[index] = e.target.value;
                            setResearchInterests(newInterests);
                          }}
                          disabled={loading}
                        />
                      </div>
                      {researchInterests.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newInterests = researchInterests.filter((_, i) => i !== index);
                            setResearchInterests(newInterests);
                          }}
                          style={{
                            background: 'var(--bg-2)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            minWidth: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-2)',
                            cursor: 'pointer'
                          }}
                          disabled={loading}
                        >
                          <X size={16} />
                        </button>
                      )}
                      {index === researchInterests.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setResearchInterests([...researchInterests, ''])}
                          style={{
                            background: 'var(--primary)',
                            border: 'none',
                            borderRadius: '8px',
                            minWidth: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: 'pointer'
                          }}
                          disabled={loading}
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="btn-spinner" />
                ) : (
                  <>
                    <UserPlus size={18} /> Create Account
                  </>
                )}
              </button>
            </form>

            <div className="auth-footer">
              Already have an account?{' '}
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => setView('login')}
              >
                Sign in
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ FORGOT PASSWORD VIEW ═══════════ */}
        {view === 'forgot' && (
          <div className="auth-view auth-view-enter">
            <button className="auth-back-btn" onClick={() => setView('login')}>
              <ArrowLeft size={16} /> Back to login
            </button>
            <div className="auth-header" style={{ marginTop: '0.5rem' }}>
              <div className="auth-logo">
                <KeyRound size={28} className="auth-logo-icon" />
              </div>
              <h2>Reset Password</h2>
              <p>Enter your email and we'll send a 6-digit OTP code</p>
            </div>
            <form onSubmit={handleForgot} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Send OTP'}
              </button>
            </form>
          </div>
        )}

        {/* ═══════════ OTP + NEW PASSWORD VIEW ═══════════ */}
        {view === 'otp' && (
          <div className="auth-view auth-view-enter">
            <button className="auth-back-btn" onClick={() => { setView('forgot'); setOtpVerified(false); setOtpDigits(['','','','','','']); }}>
              <ArrowLeft size={16} /> Back
            </button>
            <div className="auth-header" style={{ marginTop: '0.5rem' }}>
              <div className="auth-logo">
                <ShieldCheck size={28} className="auth-logo-icon" />
              </div>
              <h2>{otpVerified ? 'Set New Password' : 'Enter OTP'}</h2>
              <p>
                {otpVerified
                  ? 'Create a new password for your account'
                  : `We sent a 6-digit code to ${forgotEmail}`}
              </p>
            </div>

            {!otpVerified ? (
              <>
                <div className="otp-input-group" onPaste={handleOtpPaste}>
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`otp-box ${d ? 'otp-box-filled' : ''}`}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                      disabled={loading}
                    />
                  ))}
                </div>
                <button
                  className="auth-submit-btn"
                  onClick={handleVerifyOTP}
                  disabled={loading || otpDigits.join('').length < 6}
                  style={{ marginTop: '1.5rem' }}
                >
                  {loading ? <span className="btn-spinner" /> : 'Verify OTP'}
                </button>

                <div className="auth-footer" style={{ marginTop: '1rem' }}>
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    className="auth-switch-btn"
                    onClick={() => setView('forgot')}
                  >
                    Resend
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleResetPassword} className="auth-form">
                <div className="form-group">
                  <label>New Password</label>
                  <div className="input-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowNewPw(!showNewPw)}
                      tabIndex={-1}
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="password-strength-wrap">
                      <div className="password-strength-bar">
                        <div
                          className={`password-strength-fill ${strength.cls}`}
                          style={{ width: `${strength.pct}%` }}
                        />
                      </div>
                      <span className={`password-strength-label ${strength.cls}`}>{strength.label}</span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="input-wrapper">
                    <ShieldCheck size={16} className="input-icon" />
                    <input
                      type="password"
                      placeholder="Re-enter new password"
                      value={confirmNewPw}
                      onChange={(e) => setConfirmNewPw(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? <span className="btn-spinner" /> : 'Reset Password'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ═══════════ RESET SUCCESS VIEW ═══════════ */}
        {view === 'reset-success' && (
          <div className="auth-view auth-view-enter" style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="reset-success-icon">
              <CheckCircle size={48} />
            </div>
            <h2 style={{ color: 'var(--text-1)', marginTop: '1rem' }}>Password Reset!</h2>
            <p style={{ color: 'var(--text-2)', marginBottom: '2rem' }}>
              Your password has been updated successfully.
            </p>
            <button
              className="auth-submit-btn"
              onClick={() => setView('login')}
            >
              <LogIn size={18} /> Sign In Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
