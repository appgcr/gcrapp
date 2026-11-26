import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL } from '../../config/api';
import { PUSH_READY } from './PushRegistration';

// "Send test notification": tells in plain words why phone notifications do or don't arrive, then sends a real one
// after 10 seconds (close the app meanwhile — it should appear in the phone's notification panel).
export default function TestPushCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { tone: 'ok' | 'bad' | 'info', text }
  const [last, setLast] = useState(null);
  const native = Capacitor.isNativePlatform?.();

  useEffect(() => { fetch(`${API_BASE_URL}/api/notifications/test-push`).then((r) => (r.ok ? r.json() : null)).then(setLast).catch(() => {}); }, []);

  const test = async () => {
    setBusy(true); setMsg(null);
    try {
      // This phone first
      if (!native) { setMsg({ tone: 'bad', text: 'Phone notifications need the Gouru app on an Android phone. In a browser you only see alerts in the bell while the page is open.' }); return; }
      if (!PUSH_READY) { setMsg({ tone: 'bad', text: Capacitor.getPlatform() === 'ios' ? 'iPhone notifications are not set up yet (needs the Apple push key). You see every alert inside the app.' : 'This build of the app has phone notifications switched off. Install the latest app.' }); return; }
      const perm = await PushNotifications.checkPermissions().catch(() => ({ receive: 'unknown' }));
      if (perm.receive !== 'granted') { setMsg({ tone: 'bad', text: 'Notifications are not allowed for Gouru on this phone. Open phone Settings → Apps → Gouru Valuations → Notifications → turn on, then open the app again.' }); return; }
      // Then the server
      const r = await fetch(`${API_BASE_URL}/api/notifications/test-push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delaySeconds: 10 }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not run the test.');
      if (d.problem === 'server') setMsg({ tone: 'bad', text: `The server cannot send phone notifications yet: ${d.detail}.` });
      else if (d.problem === 'no-device') setMsg({ tone: 'bad', text: 'This phone is not registered yet. Close the app fully, open it again (stay signed in), wait a minute, then test again.' });
      else setMsg({ tone: 'ok', text: `Sending in ${d.delaySeconds} seconds to ${d.devices} phone${d.devices === 1 ? '' : 's'}. Close the app now (swipe it away) and watch the notification panel.` });
    } catch (e) { setMsg({ tone: 'bad', text: e.message }); } finally { setBusy(false); }
  };

  return (
    <div className="tp-card">
      <button type="button" className="tp-btn" onClick={test} disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : <BellRing size={17} />} Send test notification</button>
      {msg && <div className={`tp-msg ${msg.tone}`}>{msg.tone === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}<span>{msg.text}</span></div>}
      {!msg && last && (
        <div className={`tp-msg ${last.sent ? 'ok' : 'bad'}`}>
          {last.sent ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>Last test ({new Date(last.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}): {last.sent ? `delivered to ${last.sent} phone${last.sent === 1 ? '' : 's'}.` : `not delivered${(last.errors || []).length ? ` — ${last.errors.join(', ')}` : ''}${last.reason ? ` (${last.reason})` : ''}.`}</span>
        </div>
      )}
      <style>{`
        .tp-card { margin: 0 0 14px; }
        .tp-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 12px; padding: 12px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .tp-btn:disabled { opacity: .6; }
        .tp-msg { margin-top: 8px; display: flex; gap: 8px; align-items: flex-start; border-radius: 12px; padding: 10px 12px; font-size: 13.5px; line-height: 1.45; }
        .tp-msg svg { flex-shrink: 0; margin-top: 2px; }
        .tp-msg.ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .tp-msg.bad { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
      `}</style>
    </div>
  );
}
