import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Mail, Copy, Loader2, X, Building2, User } from 'lucide-react';
import WhatsAppIcon from '../Shared/WhatsAppIcon';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { authHeaders } from '../Shared/authHeaders';

/** Send an invoice to the bank branch or the customer: WhatsApp / email with a pre-filled message and the payment link */
export default function SendInvoice({ c, label = 'Send' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}><Send size={14} /> {label}</button>
      {open && createPortal(<Sheet c={c} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Sheet({ c, onClose }) {
  const [to, setTo] = useState('bank');
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    setD(null);
    fetch(`${API_BASE_URL}/api/billing/${c.id}/send?to=${to}`, { headers: authHeaders() })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not prepare the message.'); return j; })
      .then((j) => { setD(j); setPhone(j.phone || ''); setEmail(j.email || ''); setText(j.text || ''); })
      .catch((e) => { toast.error(e.message); onClose(); });
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps

  const digits = phone.replace(/\D/g, '');
  const wa = `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}`;
  const mail = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(d?.subject || '')}&body=${encodeURIComponent(text)}`;
  const emailNow = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/billing/${c.id}/email`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ email }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not send the email.');
      toast.success(`Invoice emailed to ${j.to}`);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const link = (text.match(/https?:\/\/\S+/) || [''])[0];

  return (
    <div className="si-bg" onClick={onClose}>
      <div className="si" role="dialog" aria-modal="true" aria-label="Send invoice" onClick={(e) => e.stopPropagation()}>
        <div className="si-h"><b>Send invoice</b><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="si-sub">{c.billing?.invoiceNo} · {c.fileNumber} · {c.clientName}</div>
        <div className="si-seg">
          <button type="button" className={to === 'bank' ? 'on' : ''} onClick={() => setTo('bank')}><Building2 size={15} /> Bank branch</button>
          <button type="button" className={to === 'customer' ? 'on' : ''} onClick={() => setTo('customer')}><User size={15} /> Customer</button>
        </div>
        {!d ? <div className="si-load"><Loader2 size={20} className="spin" /> Preparing…</div> : (
          <>
            <label className="si-f">WhatsApp number<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={to === 'bank' ? 'Bank branch mobile' : 'Customer mobile'} /></label>
            {to === 'bank' && <label className="si-f">Email<input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="branch email" /></label>}
            <label className="si-f">Message<textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} /></label>
            <a className="si-opt wa" href={wa} target="_blank" rel="noreferrer" onClick={() => setTimeout(onClose, 400)}><WhatsAppIcon size={18} /> Send on WhatsApp{digits ? <small>{phone}</small> : <small>choose contact</small>}</a>
            {to === 'bank' && (d.canEmail
              ? <button type="button" className="si-opt" onClick={emailNow} disabled={busy || !email}>{busy ? <Loader2 size={18} className="spin" /> : <Mail size={18} />} Email now with the PDF<small>{email}</small></button>
              : <a className="si-opt" href={mail}><Mail size={18} /> Email<small>{email || 'opens your mail app'}</small></a>)}
            <button type="button" className="si-opt" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Payment link copied')).catch(() => toast.error('Could not copy'))}><Copy size={18} /> Copy payment link<small>UPI + bank details, no login</small></button>
          </>
        )}
      </div>
      <style>{`
        .si-bg { position: fixed; inset: 0; z-index: 3000; background: rgba(15,23,42,.45); display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 640px) { .si-bg { align-items: center; } .si { border-radius: 18px !important; } }
        .si { width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; background: #fff; border-radius: 18px 18px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }
        .si-h { display: flex; justify-content: space-between; align-items: center; font-size: 16px; color: #0f172a; }
        .si-h button { border: 0; background: #f1f5f9; border-radius: 50%; width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer; }
        .si-sub { font-size: 12.5px; color: #64748b; margin: 2px 0 12px; }
        .si-seg { display: flex; background: #f1f5f9; border-radius: 11px; padding: 3px; margin-bottom: 12px; }
        .si-seg button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: none; padding: 9px; border-radius: 9px; font-weight: 700; font-size: 14px; color: #475569; cursor: pointer; font-family: inherit; }
        .si-seg button.on { background: #fff; color: #1d4ed8; box-shadow: 0 1px 4px rgba(15,23,42,.12); }
        .si-load { display: flex; gap: 8px; align-items: center; justify-content: center; padding: 24px; color: #475569; }
        .si-f { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 10px; }
        .si-f input, .si-f textarea { padding: 10px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 14px; font-family: inherit; resize: vertical; }
        .si-opt { width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 13px 14px; margin-top: 8px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; font-size: 15px; font-weight: 700; text-decoration: none; cursor: pointer; font-family: inherit; }
        .si-opt.wa { background: #16a34a; color: #fff; border-color: #16a34a; }
        .si-opt small { margin-left: auto; font-size: 12px; font-weight: 500; opacity: .8; }
        body.dark-theme .si { background: #1c1c1e; } body.dark-theme .si-h, body.dark-theme .si-opt:not(.wa) { color: #fff; }
        body.dark-theme .si-opt:not(.wa), body.dark-theme .si-f input, body.dark-theme .si-f textarea { background: #2c2c2e; border-color: #3a3a3c; color: #fff; }
      `}</style>
    </div>
  );
}
