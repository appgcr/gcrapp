import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone, Monitor, Tablet, Loader2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import askConfirm from '../Shared/askConfirm';

// India time, whatever the phone's own clock setting
const IST = { timeZone: 'Asia/Kolkata' };
const when = (t) => new Date(t).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
function ago(t) {
  const mins = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  if (mins < 2) return 'Active now';
  if (mins < 60) return `Active ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Active ${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  return `Last active ${when(t)}`;
}
const iconFor = (s) => (/iPad|tablet/i.test(s.device) ? Tablet : s.platform === 'web' && !s.app ? Monitor : Smartphone);

/**
 * Signed-in devices of one person (like Google's "Your devices"), in the staff profile sheet.
 * The Super Admin sees anyone's; signing a device out ends its login and its notifications at once.
 */
export default function DevicesSection({ userId, name }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => {
    fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/sessions`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not load devices.'); return j; })
      .then(setData).catch((e) => setData({ error: e.message, sessions: [] }));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const signOut = async (s) => {
    const ok = await askConfirm({ title: `Sign out ${s.device.split(' · ')[0]}?`, message: `${name} will be signed out on this device right away and must sign in again to use it.`, confirmText: 'Sign out', tone: 'danger' });
    if (!ok) return;
    setBusy(s.sid);
    try {
      const r = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/sessions/${s.sid}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 404) throw new Error((await r.json().catch(() => ({}))).error || 'Could not sign out.');
      toast.success('Signed out');
      if (s.current) window.dispatchEvent(new CustomEvent('gcr_signed_out', { detail: { self: true } }));
      else load();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const signOutAll = async () => {
    const ok = await askConfirm({ title: `Sign ${name} out everywhere?`, message: 'Every phone, tablet and computer is signed out right away, including older sign-ins not listed here.', confirmText: 'Sign out all', tone: 'danger' });
    if (!ok) return;
    setBusy('all');
    try {
      const r = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/sessions/sign-out-all`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not sign out.');
      toast.success(`${name} is signed out on all devices`);
      if (j.selfSignedOut) window.dispatchEvent(new CustomEvent('gcr_signed_out', { detail: { self: true } }));
      else load();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  const list = data?.sessions || [];
  return (
    <>
      <div className="pf-section">Signed-in devices{list.length ? ` (${list.length})` : ''}</div>
      <div className="pf-group">
        {!data ? (
          <div className="pf-row" style={{ justifyContent: 'center' }}><Loader2 size={18} className="spin" /></div>
        ) : data.error ? (
          <div className="pf-row"><span className="pf-muted">{data.error}</span></div>
        ) : list.length === 0 ? (
          <div className="pf-row"><span className="pf-muted">No devices signed in</span></div>
        ) : list.map((s) => {
          const Icon = iconFor(s);
          return (
            <div className="pf-row dv-row" key={s.sid}>
              <span className="dv-ic"><Icon size={18} /></span>
              <span className="dv-t">
                <b>{s.device || 'Unknown device'}{s.current && <em>This device</em>}</b>
                <small className={/now/.test(ago(s.lastSeenAt)) ? 'dv-live' : ''}>{ago(s.lastSeenAt)}</small>
                <small>Signed in {when(s.createdAt)}{s.ip ? ` · IP ${s.ip}` : ''}</small>
              </span>
              <button type="button" className="dv-out" disabled={!!busy} onClick={() => signOut(s)} aria-label={`Sign out ${s.device}`}>
                {busy === s.sid ? <Loader2 size={14} className="spin" /> : 'Sign out'}
              </button>
            </div>
          );
        })}
      </div>
      {data && !data.error && (
        <div className="pf-group" style={{ marginTop: 8 }}>
          <button type="button" className="pf-row pf-action pf-danger" disabled={!!busy} onClick={signOutAll}>
            {busy === 'all' ? <Loader2 size={16} className="spin" /> : <LogOut size={16} />} Sign out of all devices
          </button>
        </div>
      )}
      <p className="pf-foot">Times are India time. Signing out ends that device’s login and its notifications at once, and the device needs your approval to sign in again.</p>
      <style>{`
        .dv-row { justify-content: flex-start; align-items: flex-start; gap: 12px; padding-top: 12px; padding-bottom: 12px; }
        .dv-ic { width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; background: #eef2ff; color: #4f46e5; display: grid; place-items: center; }
        .dv-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .dv-t b { font-size: 15px; font-weight: 600; color: #000; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .dv-t em { font-style: normal; font-size: 11.5px; font-weight: 700; color: #16a34a; background: #dcfce7; border-radius: 999px; padding: 1px 8px; }
        .dv-t small { font-size: 12.5px; color: #6d6d72; }
        .dv-t small.dv-live { color: #16a34a; font-weight: 600; }
        .dv-out { flex-shrink: 0; align-self: center; border: 1px solid #fecaca; background: #fff; color: #dc2626; border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
        .dv-out:disabled { opacity: .5; }
        body.dark-theme .dv-t b { color: #fff; } body.dark-theme .dv-ic { background: #1e1b4b; color: #a5b4fc; }
        body.dark-theme .dv-out { background: #2c2c2e; border-color: #7f1d1d; }
      `}</style>
    </>
  );
}
