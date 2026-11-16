import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Mail, MessageCircle, Copy, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';

/**
 * Approved report → bank branch. Shows whether it was emailed automatically, and lets the admin
 * send it by email or WhatsApp (a 30-day download link, no login needed) or copy the link.
 */
export default function SendToBank({ c }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState(null);
  const sent = c.delivery?.status === 'emailed';

  const prepare = async () => {
    setOpen(true); setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/cases/${c.id}/deliver`, { method: 'POST', headers: authHeaders() });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not prepare the report link.');
      setD(j);
    } catch (err) { toast.error(err.message); setOpen(false); } finally { setBusy(false); }
  };

  const phone = (d?.phone || '').replace(/\D/g, '');
  const wa = phone ? (phone.length === 10 ? `91${phone}` : phone) : '';
  const msg = d?.message;
  const mailto = msg ? `mailto:${encodeURIComponent(d.email || '')}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.text)}` : '#';
  const whatsapp = msg ? `https://wa.me/${wa}?text=${encodeURIComponent(`${msg.subject}\n\n${msg.text}`)}` : '#';

  return (
    <>
      <button className="cs-btn cs-ghost" onClick={prepare}>
        <Send size={15} /> {sent ? 'Emailed to bank' : 'Send to bank'}
      </button>
      {open && createPortal(
        <div className="stb-bg" onClick={() => setOpen(false)}>
          <div className="stb" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Send report to bank">
            <div className="stb-h"><b>Send report to the bank</b><button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button></div>
            <div className="stb-sub">{c.fileNumber || `#${c.id}`} · {c.clientName} · {c.bankName}{c.bankBranch ? ` – ${c.bankBranch}` : ''}</div>
            {busy || !d ? <div className="stb-load"><Loader2 size={20} className="spin" /> Preparing the link…</div> : (
              <>
                {d.status === 'emailed' && <div className="stb-note ok">Emailed automatically to {d.email}.</div>}
                {d.status === 'failed' && <div className="stb-note bad">Automatic email failed: {d.error}</div>}
                {!d.email && !d.phone && <div className="stb-note">No email or WhatsApp saved for this branch. Add it in Settings → Banks → Report delivery, or type it in your mail / WhatsApp.</div>}
                <a className="stb-opt" href={mailto} onClick={() => setTimeout(() => setOpen(false), 300)}><Mail size={18} /> Email{d.email ? <small>{d.email}</small> : null}</a>
                <a className="stb-opt" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp{d.phone ? <small>{d.phone}</small> : <small>choose contact</small>}</a>
                <button type="button" className="stb-opt" onClick={() => { navigator.clipboard?.writeText(d.link).then(() => toast.success('Link copied')).catch(() => toast.error('Could not copy')); }}><Copy size={18} /> Copy download link<small>works 30 days, no login</small></button>
              </>
            )}
          </div>
          <style>{`
            .stb-bg { position: fixed; inset: 0; z-index: 3000; background: rgba(15,23,42,.45); display: flex; align-items: flex-end; justify-content: center; }
            .stb { width: 100%; max-width: 480px; background: #fff; border-radius: 18px 18px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }
            .stb-h { display: flex; justify-content: space-between; align-items: center; font-size: 16px; color: #0f172a; }
            .stb-h button { border: 0; background: #f1f5f9; border-radius: 50%; width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer; }
            .stb-sub { font-size: 12.5px; color: #64748b; margin: 2px 0 12px; }
            .stb-load { display: flex; gap: 8px; align-items: center; justify-content: center; padding: 24px; color: #475569; }
            .stb-note { font-size: 12.5px; padding: 8px 10px; border-radius: 10px; background: #f1f5f9; color: #334155; margin-bottom: 10px; }
            .stb-note.ok { background: #f0fdf4; color: #166534; font-weight: 700; }
            .stb-note.bad { background: #fef2f2; color: #b91c1c; }
            .stb-opt { width: 100%; display: flex; align-items: center; gap: 10px; padding: 13px 14px; margin-top: 8px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; font-size: 15px; font-weight: 700; text-decoration: none; cursor: pointer; font-family: inherit; }
            .stb-opt small { margin-left: auto; font-size: 12px; font-weight: 500; color: #64748b; }
            body.dark-theme .stb { background: #1c1c1e; }
            body.dark-theme .stb-h, body.dark-theme .stb-opt { color: #fff; }
            body.dark-theme .stb-opt { background: #2c2c2e; border-color: #3a3a3c; }
          `}</style>
        </div>, document.body)}
    </>
  );
}
