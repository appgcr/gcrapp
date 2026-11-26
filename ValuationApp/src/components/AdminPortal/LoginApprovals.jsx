import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Loader2 } from 'lucide-react';
import GcrLogo from '../Shared/GcrLogo';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';

const when = (t) => new Date(t).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * Super Admin: engineers / branch admins signing in on a new device wait here for approval.
 * Checks every 8 seconds (and when the app comes back to the front); one card per request.
 */
export default function LoginApprovals() {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => {
    fetch(`${API_BASE_URL}/api/auth/login-requests`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.requests)) setList(d.requests); }).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    const onFront = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onFront);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onFront); };
  }, [load]);

  const answer = async (r, approve) => {
    setBusy(r.id + (approve ? 'a' : 'd'));
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login-requests/${encodeURIComponent(r.id)}/${approve ? 'approve' : 'deny'}`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not answer.');
      toast.success(approve ? `${r.userName} can sign in on this device` : `${r.userName}’s sign-in was denied`);
    } catch (e) { toast.error(e.message); }
    setBusy('');
    load();
  };

  if (!list.length) return null;
  return createPortal(
    <div className="la-wrap" role="region" aria-label="Sign-in approvals">
      {list.slice(0, 3).map((r) => (
        <div className="la-card" key={r.id} role="alertdialog" aria-label={`Approve sign-in for ${r.userName}`}>
          <div className="la-head"><span className="la-ic"><GcrLogo size={32} /></span><b>Approve sign-in?</b><small>{when(r.createdAt)}</small></div>
          <div className="la-who"><b>{r.userName}</b> · {r.role === 'ADMIN' ? 'Branch admin' : 'Engineer'}{r.branchName ? ` · ${r.branchName}` : ''}</div>
          <div className="la-dev"><Smartphone size={14} /> {r.device || 'Unknown device'}{r.ip ? ` · IP ${r.ip}` : ''}</div>
          <div className="la-btns">
            <button type="button" className="la-deny" disabled={!!busy} onClick={() => answer(r, false)}>{busy === r.id + 'd' ? <Loader2 size={15} className="spin" /> : 'Deny'}</button>
            <button type="button" className="la-ok" disabled={!!busy} onClick={() => answer(r, true)}>{busy === r.id + 'a' ? <Loader2 size={15} className="spin" /> : 'Approve'}</button>
          </div>
        </div>
      ))}
      {list.length > 3 && <div className="la-more">+{list.length - 3} more waiting</div>}
      <style>{`
        .la-wrap { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 12px); left: 50%; transform: translateX(-50%); z-index: 10050; width: min(420px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 10px; }
        .la-card { background: #fff; border-radius: 16px; box-shadow: 0 12px 40px rgba(15,23,42,.22); padding: 14px 16px; border: 1px solid #e2e8f0; animation: laIn .25s ease-out; }
        @keyframes laIn { from { transform: translateY(-12px); opacity: 0; } to { transform: none; opacity: 1; } }
        .la-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .la-head b { flex: 1; font-size: 15.5px; color: #0f172a; }
        .la-head small { color: #94a3b8; font-size: 12px; }
        .la-ic { width: 32px; height: 32px; flex-shrink: 0; display: grid; place-items: center; border-radius: 9px; overflow: hidden; }
        .la-who { font-size: 14.5px; color: #334155; margin-bottom: 4px; }
        .la-dev { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; margin-bottom: 12px; }
        .la-btns { display: flex; gap: 8px; }
        .la-btns button { flex: 1; border: 0; border-radius: 10px; padding: 10px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; }
        .la-deny { background: #f1f5f9; color: #dc2626; }
        .la-ok { background: #2563eb; color: #fff; }
        .la-btns button:disabled { opacity: .6; }
        .la-more { text-align: center; font-size: 12.5px; color: #fff; background: rgba(15,23,42,.7); border-radius: 999px; padding: 4px 10px; align-self: center; }
        body.dark-theme .la-card { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .la-head b, body.dark-theme .la-who b { color: #fff; } body.dark-theme .la-who { color: #d4d4d8; }
        body.dark-theme .la-deny { background: #2c2c2e; }
      `}</style>
    </div>,
    document.body,
  );
}
