import React, { useState } from 'react';
import { Send, Smartphone, Loader2 } from 'lucide-react';
import WhatsAppIcon from '../Shared/WhatsAppIcon';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';
import { currentPosition } from '../../utils/sitePhotos';

/** "I'm on the way — reaching in about 20 min": one tap to WhatsApp / SMS the customer */
export default function TellCustomer({ caseId, notified }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const prepare = async () => {
    setBusy(true);
    let gps = null;
    try { gps = await Promise.race([currentPosition(), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 6000))]); } catch { /* no GPS: message without the time */ }
    try {
      const r = await fetch(`${API_BASE_URL}/api/cases/${caseId}/on-the-way`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: gps?.lat, lng: gps?.lng }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not prepare the message.');
      setMsg(d);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const digits = (msg?.phone || '').replace(/\D/g, '');
  const wa = digits ? (digits.length === 10 ? `91${digits}` : digits) : '';

  return (
    <div className="tcu">
      {!msg ? (
        <button type="button" className="tcu-main" onClick={prepare} disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          <span>Tell customer I'm coming<small>{notified?.at ? `Last told ${new Date(notified.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : 'Sends your arrival time'}</small></span>
        </button>
      ) : (
        <>
          <div className="tcu-preview">{msg.text}</div>
          {msg.etaMin && <div className="tcu-eta">About {msg.distanceKm} km · {msg.etaMin} min away</div>}
          <div className="tcu-row">
            <a className="tcu-btn wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(msg.text)}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={17} /> WhatsApp</a>
            {digits && <a className="tcu-btn" href={`sms:${digits}?body=${encodeURIComponent(msg.text)}`}><Smartphone size={17} /> SMS</a>}
          </div>
          {!digits && <div className="tcu-eta">No customer number on this case — choose the contact in WhatsApp.</div>}
        </>
      )}
      <style>{`
        .tcu { margin-top: 12px; }
        .tcu-main { width: 100%; display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-radius: 14px; border: 1px solid #bbf7d0; background: #f0fdf4; color: #166534; font-size: 15px; font-weight: 700; cursor: pointer; text-align: left; font-family: inherit; }
        .tcu-main span { display: flex; flex-direction: column; }
        .tcu-main small { font-size: 12px; font-weight: 500; color: #4b5563; margin-top: 1px; }
        .tcu-preview { white-space: pre-line; font-size: 13px; line-height: 1.45; color: #0f172a; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
        .tcu-eta { font-size: 12px; color: #475569; margin-top: 6px; }
        .tcu-row { display: flex; gap: 8px; margin-top: 8px; }
        .tcu-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border-radius: 12px; background: #fff; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 700; font-size: 14px; text-decoration: none; }
        .tcu-btn.wa { background: #16a34a; border-color: #16a34a; color: #fff; }
        body.dark-theme .tcu-main { background: #1c1c1e; border-color: #3a3a3c; color: #4ade80; }
        body.dark-theme .tcu-preview { background: #1c1c1e; border-color: #3a3a3c; color: #fff; }
        body.dark-theme .tcu-btn:not(.wa) { background: #2c2c2e; border-color: #3a3a3c; color: #fff; }
      `}</style>
    </div>
  );
}
