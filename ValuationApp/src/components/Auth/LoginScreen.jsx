import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Fingerprint, Home, Loader2 } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import './LoginScreen.css';

export default function LoginScreen({ onLogin, users }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('https://gcr-9ys1.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Invalid Email or Password.');
      }
    } catch (err) {
      console.error(err);
      setError('Cannot connect to authentication server.');
    }
  };

  const handleBiometricAuth = async () => {
    setIsBiometricLoading(true);
    setError('');
    
    try {
      // 1. Fetch authentication options (challenge) from backend
      const resp = await fetch('https://gcr-9ys1.onrender.com/api/auth/webauthn/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const options = await resp.json();

      if (options.error) throw new Error(options.error);

      // 2. Prompt browser for biometric scan (Passkey)
      const asseResp = await startAuthentication(options);

      // 3. Verify response on backend
      const verifyResp = await fetch('https://gcr-9ys1.onrender.com/api/auth/webauthn/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: asseResp,
          expectedChallenge: options.challenge
        })
      });

      const verificationJSON = await verifyResp.json();
      
      setIsBiometricLoading(false);

      if (verificationJSON.success && verificationJSON.user) {
        onLogin(verificationJSON.user);
      } else {
        setError(verificationJSON.error || 'Biometric Auth Failed on Backend.');
      }
    } catch (err) {
      console.error(err);
      setIsBiometricLoading(false);
      setError('Biometric login failed. Have you registered your device in Settings?');
    }
  };

  return (
    <div className="ref-login-wrapper">
      <div className="ref-logo-box">
        <Home size={32} color="#111827" strokeWidth={1.5} />
      </div>
      
      <div className="ref-login-header">
        <h2>GCR App</h2>
        <p>Sign in to your account</p>
      </div>

      <div className="ref-login-card animate-fade-in">
        {error && (
          <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: '600', border: '1px solid #fecaca', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit}>
          <div className="ref-form-group">
            <div className="ref-form-label-row">
              <label className="ref-form-label" htmlFor="username">Email or Username</label>
            </div>
            <div className="ref-input-container">
              <div className="ref-input-icon-left">
                <Mail size={18} />
              </div>
              <input
                id="username"
                type="text"
                className="ref-input"
                required
                placeholder="Enter your email"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                disabled={isBiometricLoading}
              />
            </div>
          </div>

          <div className="ref-form-group">
            <div className="ref-form-label-row">
              <label className="ref-form-label" htmlFor="password">Password</label>
              <button type="button" className="ref-forgot-link">Forgot Password?</button>
            </div>
            <div className="ref-input-container">
              <div className="ref-input-icon-left">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="ref-input"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                style={{ paddingRight: '42px' }}
                disabled={isBiometricLoading}
              />
              <button
                type="button"
                className="ref-input-icon-right"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                disabled={isBiometricLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="ref-btn-primary" disabled={isBiometricLoading}>
            Sign In
          </button>
        </form>

        <div className="ref-divider">OR</div>

        <button 
          type="button" 
          className="ref-btn-secondary" 
          onClick={handleBiometricAuth}
          disabled={isBiometricLoading}
        >
          {isBiometricLoading ? (
            <Loader2 size={18} className="spin" />
          ) : (
            <Fingerprint size={18} />
          )}
          <span>{isBiometricLoading ? 'Scanning Biometrics...' : 'Use Biometrics'}</span>
        </button>
      </div>

      <div className="ref-footer">
        <p>Need help accessing the portal?</p>
        <div className="ref-footer-links">
          <a href="mailto:support@gcrvaluations.com" className="ref-footer-link">Contact Support</a>
        </div>
      </div>
    </div>
  );
}
