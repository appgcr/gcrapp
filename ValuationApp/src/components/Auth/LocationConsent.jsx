import React, { useState } from 'react';
import { MapPin, Loader2, LogOut } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import GcrLogo from '../Shared/GcrLogo';

/**
 * First sign-in (engineers and branch admins): the always-on location policy, shown in full.
 * The app stays closed until the person ticks "I agree"; the time they agreed is saved on the server.
 */
export default function LocationConsent({ currentUser, onAgreed, onDecline }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const agree = async () => {
    if (!checked || busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${API_BASE_URL}/api/live/consent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agree: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save. Check your internet and try again.');
      onAgreed(d);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const who = currentUser?.name || currentUser?.username || '';

  return (
    <div className="lc-root" role="dialog" aria-modal="true" aria-labelledby="lc-title">
      <div className="lc-wrap">
        <div className="lc-head">
          <GcrLogo size={56} />
          <h1 id="lc-title">Location sharing policy</h1>
          <p>Please read this fully before you start using Gouru Valuations.</p>
        </div>

        <div className="lc-terms" tabIndex={0}>
          <div className="lc-terms-title"><MapPin size={18} /> Your location is shared 24/7</div>
          <ol>
            <li><b>Always on.</b> Gouru Valuations is a company work app. While you are signed in on this phone, your location is shared with the Gouru office — the Super Admin and your branch admin — <b>at all times, 24 hours a day, whether you are on duty or off duty.</b></li>
            <li><b>What is shared:</b> where you are, how accurate the position is, the time, and whether your phone’s location is on or off. <b>Not shared:</b> your calls, messages, photos, contacts or other apps.</li>
            <li><b>Why:</b> the safety of field staff, checking site visits, giving work to the nearest person, and attendance.</li>
            <li><b>No switch-off option.</b> The app has no setting to stop location sharing. If you turn off your phone’s location, remove the app’s location permission, or close the app, <b>the office is alerted immediately.</b></li>
            <li><b>Notification:</b> a notification “Gouru Valuations — Location sharing” stays on your phone while sharing is active.</li>
            <li><b>Battery:</b> the app sends your position every few minutes, and more often while you are moving or on duty. Keep your phone charged.</li>
            <li><b>Privacy:</b> your location history is used only for Gouru company records. It is never sold, and never shared with anyone outside Gouru.</li>
            <li><b>When it stops:</b> sharing stops only when you sign out of the app on this phone, or when your account is closed. To ask for your location history to be deleted, write to hello.happydooo@gmail.com.</li>
            <li><b>Your agreement:</b> by ticking the box below you confirm that you have read this, that you understand it, and that you agree to it as part of your work with Gouru Valuations. The date and time you agree are saved with your account.</li>
          </ol>
        </div>

        <label className={`lc-check ${checked ? 'on' : ''}`}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span className="lc-box" aria-hidden="true" />
          <span className="lc-check-text">
            I have read and agree. I allow Gouru Valuations to share my location with the office <b>at all times (24/7)</b>.
          </span>
        </label>

        {error && <div className="lc-error">{error}</div>}

        <button className="lc-agree" disabled={!checked || busy} onClick={agree}>
          {busy ? <Loader2 size={20} className="spin" /> : null} Agree and continue
        </button>
        <button className="lc-decline" onClick={onDecline}><LogOut size={16} /> I don’t agree — sign out</button>
        <div className="lc-sign">Signing as {who} · {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </div>

      <style>{`
        .lc-root { position: fixed; inset: 0; z-index: 99990; background: #f2f2f7; color: #0f172a; overflow-y: auto; -webkit-overflow-scrolling: touch;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', sans-serif;
          padding: calc(env(safe-area-inset-top, 0px) + 20px) 16px calc(env(safe-area-inset-bottom, 0px) + 24px); }
        .lc-wrap { max-width: 560px; margin: 0 auto; }
        .lc-head { text-align: center; margin-bottom: 16px; }
        .lc-head h1 { font-size: 26px; font-weight: 800; margin: 12px 0 4px; letter-spacing: -.3px; color: #0b1533; }
        .lc-head p { margin: 0; font-size: 15px; color: #64748b; }
        .lc-terms { background: #fff; border-radius: 18px; padding: 18px 18px 8px; box-shadow: 0 1px 3px rgba(0,0,0,.06); border: 1px solid rgba(15,23,42,.06);
          font-size: 16.5px; line-height: 1.6; }
        .lc-terms-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 800; color: #1e3a8a; margin-bottom: 8px; }
        .lc-terms ol { margin: 0; padding-left: 22px; }
        .lc-terms li { margin-bottom: 12px; }
        .lc-terms b { color: #0b1533; }
        .lc-check { display: flex; gap: 14px; align-items: flex-start; margin: 16px 0 12px; padding: 16px; background: #fff; border-radius: 16px;
          border: 2px solid rgba(30,58,138,.25); cursor: pointer; font-size: 17px; line-height: 1.5; -webkit-tap-highlight-color: transparent; }
        .lc-check.on { border-color: #16a34a; background: #f0fdf4; }
        .lc-check input { position: absolute; opacity: 0; width: 1px; height: 1px; }
        .lc-box { flex: none; width: 30px; height: 30px; border-radius: 9px; border: 2.5px solid #94a3b8; background: #fff; margin-top: 1px; position: relative; transition: all .15s; }
        .lc-check.on .lc-box { background: #16a34a; border-color: #16a34a; }
        .lc-check.on .lc-box::after { content: ''; position: absolute; left: 9px; top: 3px; width: 8px; height: 15px; border: solid #fff; border-width: 0 3.5px 3.5px 0; transform: rotate(45deg); }
        .lc-check input:focus-visible + .lc-box { outline: 3px solid #93c5fd; outline-offset: 2px; }
        .lc-error { color: #dc2626; font-size: 14px; margin: 0 4px 10px; }
        .lc-agree { width: 100%; height: 56px; border: 0; border-radius: 15px; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff;
          font: inherit; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
        .lc-agree:disabled { background: #cbd5e1; color: #f8fafc; cursor: not-allowed; }
        .lc-decline { width: 100%; height: 48px; margin-top: 10px; border: 0; background: transparent; color: #dc2626; font: inherit; font-size: 15px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
        .lc-sign { text-align: center; font-size: 12.5px; color: #94a3b8; margin-top: 6px; }
        .lc-root .spin { animation: lcspin 1s linear infinite; }
        @keyframes lcspin { to { transform: rotate(360deg); } }
        @media (prefers-color-scheme: dark) {
          .lc-root { background: #000; color: #f1f5f9; }
          .lc-head h1 { color: #fff; }
          .lc-head p, .lc-sign { color: #94a3b8; }
          .lc-terms, .lc-check { background: #1c1c1e; border-color: rgba(255,255,255,.1); }
          .lc-terms b { color: #fff; }
          .lc-terms-title { color: #93c5fd; }
          .lc-check.on { background: #052e16; }
          .lc-box { background: #1c1c1e; }
        }
      `}</style>
    </div>
  );
}
