import { API_BASE_URL } from '../../config/api';
import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Fingerprint, Loader2, AlertCircle, ShieldCheck, MapPin, FileCheck2, Users, X, Mail } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import GcrLogo from '../Shared/GcrLogo';
import pkg from '../../../package.json';
import './LoginScreen.css';

const REMEMBER_KEY = 'gcr_remember_username';

export default function LoginScreen({ onLogin }) {
  const remembered = (() => { try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; } })();
  const [username, setUsername] = useState(remembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(!!remembered);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(null); // 'password' | 'passkey' | null
  const [showHelp, setShowHelp] = useState(false);
  const passwordRef = useRef(null);
  const userRef = useRef(null);
  const passkeySupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  // Returning user: jump straight to the password field
  useEffect(() => { (remembered ? passwordRef : userRef).current?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (msg) => { setError(msg); setShake((n) => n + 1); };

  const finish = (data) => {
    if (data.token) localStorage.setItem('token', data.token);
    try {
      if (remember && username.trim()) localStorage.setItem(REMEMBER_KEY, username.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* storage blocked */ }
    onLogin(data.user);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setError('');
    setBusy('password');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) return finish(data);
      fail(response.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : (data.error || 'Incorrect username or password.'));
      setPassword('');
      passwordRef.current?.focus();
    } catch {
      fail('Can’t reach the server. Check your internet connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const handlePasskey = async () => {
    if (busy) return;
    setError('');
    setBusy('passkey');
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/webauthn/login-options`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const options = await resp.json();
      if (options.error) throw new Error(options.error);
      const asseResp = await startAuthentication(options);
      const verifyResp = await fetch(`${API_BASE_URL}/api/auth/webauthn/login-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: asseResp, expectedChallenge: options.challenge }),
      });
      const data = await verifyResp.json();
      if (data.success && data.user) return finish(data);
      fail(data.error || 'Face ID / fingerprint sign-in didn’t work. Use your password instead.');
    } catch (err) {
      if (err?.name === 'NotAllowedError') setError(''); // user cancelled the system sheet
      else fail('No passkey on this device yet. Sign in with your password, then turn on Face ID / fingerprint in Settings.');
    } finally {
      setBusy(null);
    }
  };

  const canSubmit = username.trim() && password && !busy;

  return (
    <div className="lg-root">
      {/* Brand panel — tablets & desktop only */}
      <aside className="lg-brand" aria-hidden="true">
        <div className="lg-brand-top">
          <GcrLogo size={44} />
          <span>Gouru Valuations</span>
        </div>
        <div className="lg-brand-body">
          <h1>From site visit to signed report — in one place.</h1>
          <ul>
            <li><span><Users size={18} /></span>Assign cases and see your field team live</li>
            <li><span><MapPin size={18} /></span>Geo-tagged attendance and site photos</li>
            <li><span><FileCheck2 size={18} /></span>Review, return and approve bank reports</li>
          </ul>
        </div>
        <div className="lg-brand-foot">Trusted valuation workflow for bank panels</div>
      </aside>

      <main className="lg-main">
        <div className="lg-form-wrap">
          <header className="lg-head">
            <div className="lg-logo"><GcrLogo size={76} /></div>
            <h2>{remembered ? 'Welcome back' : 'Sign in to Gouru'}</h2>
            <p>{remembered ? `Signing in as ${remembered}` : 'Use the login your administrator gave you.'}</p>
          </header>

          <form onSubmit={handleLoginSubmit} noValidate>
            <div key={shake} className={`lg-group ${shake ? 'lg-shake' : ''} ${error ? 'lg-group-error' : ''}`}>
              <label className="lg-field">
                <span className="lg-label">Username</span>
                <input
                  ref={userRef}
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="Username or email"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus(); } }}
                  disabled={!!busy}
                />
              </label>
              <label className="lg-field">
                <span className="lg-label">Password</span>
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  placeholder="Required"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  disabled={!!busy}
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </label>
            </div>

            <div className="lg-msg" role="alert" aria-live="polite">
              {error && <><AlertCircle size={15} /> {error}</>}
            </div>

            <div className="lg-row">
              <label className="lg-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span className="lg-switch" aria-hidden="true" />
                Remember me
              </label>
              <button type="button" className="lg-link" onClick={() => setShowHelp(true)}>Forgot password?</button>
            </div>

            <button type="submit" className="lg-primary" disabled={!canSubmit}>
              {busy === 'password' ? <><Loader2 size={18} className="spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          {passkeySupported && (
            <>
              <div className="lg-or"><span>or</span></div>
              <button type="button" className="lg-secondary" onClick={handlePasskey} disabled={!!busy}>
                {busy === 'passkey' ? <Loader2 size={18} className="spin" /> : <Fingerprint size={19} />}
                {busy === 'passkey' ? 'Waiting for Face ID / fingerprint…' : 'Sign in with Face ID or Fingerprint'}
              </button>
            </>
          )}

          <footer className="lg-foot">
            <ShieldCheck size={14} /> Secure sign-in · Version {pkg.version}
          </footer>
        </div>
      </main>

      {showHelp && (
        <div className="lg-sheet-bg" onClick={() => setShowHelp(false)}>
          <div className="lg-sheet" role="dialog" aria-modal="true" aria-labelledby="lg-help-title" onClick={(e) => e.stopPropagation()}>
            <button className="lg-sheet-x" onClick={() => setShowHelp(false)} aria-label="Close"><X size={18} /></button>
            <div className="lg-sheet-icon"><ShieldCheck size={26} /></div>
            <h3 id="lg-help-title">Forgot your password?</h3>
            <p>Your Gouru administrator issues every login. Ask them to open <b>Staff → your name</b> — they can see your password or give you a new one in seconds.</p>
            <a className="lg-primary" href="mailto:hello.happydooo@gmail.com?subject=Gouru%20Valuations%20login%20help"><Mail size={17} /> Email Support</a>
            <button className="lg-link lg-sheet-done" onClick={() => setShowHelp(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
