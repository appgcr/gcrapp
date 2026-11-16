import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config/api';

/**
 * Sign right here with a finger. Saved as the engineer's signature (Settings → Digital Signature)
 * so future reports are one tick. With no signal it is used for this report and saved later.
 */
export default function DrawSignature({ onSaved, onCancel }) {
  const pad = useRef(null);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!pad.current || pad.current.isEmpty()) return;
    // Crop to the ink so the signature sits neatly on the report
    const src = pad.current.getCanvas();
    const ctx = src.getContext('2d');
    const { width, height } = src;
    const px = ctx.getImageData(0, 0, width, height).data;
    let x0 = width; let y0 = height; let x1 = 0; let y1 = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(width, x1 + m); y1 = Math.min(height, y1 + m);
    const out = document.createElement('canvas');
    out.width = Math.max(1, x1 - x0); out.height = Math.max(1, y1 - y0);
    out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    const dataUrl = out.toDataURL('image/png');
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/auth/me/signature`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw Object.assign(new Error(d.error || 'Could not save the signature.'), { server: true }); }
      toast.success('Signature saved — it is used for your next reports too.');
      onSaved(dataUrl);
    } catch (err) {
      if (err.server) { toast.error(err.message); return; }
      toast('No signal — signature used for this report. Save it in Settings later.');
      onSaved(dataUrl);
    } finally { setBusy(false); }
  };

  return (
    <div className="dsg">
      <div className="dsg-h">Sign inside the box</div>
      <div className="dsg-pad">
        <SignatureCanvas ref={pad} penColor="#0b1f4d" minWidth={1.2} maxWidth={2.8}
          canvasProps={{ className: 'dsg-canvas', 'aria-label': 'Signature pad' }}
          onEnd={() => setEmpty(pad.current.isEmpty())} />
        {empty && <span className="dsg-hint">Sign here</span>}
      </div>
      <div className="dsg-b">
        <button type="button" className="dsg-ghost" onClick={() => { pad.current?.clear(); setEmpty(true); }}>Clear</button>
        {onCancel && <button type="button" className="dsg-ghost" onClick={onCancel}>Cancel</button>}
        <button type="button" className="dsg-go" disabled={empty || busy} onClick={save}>{busy ? 'Saving…' : 'Use this signature'}</button>
      </div>
      <style>{`
        .dsg { padding: 12px; border-radius: 12px; border: 1px solid #cbd5e1; background: #f8fafc; }
        .dsg-h { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; }
        .dsg-pad { position: relative; background: #fff; border: 1.5px dashed #94a3b8; border-radius: 10px; height: 170px; touch-action: none; }
        .dsg-canvas { width: 100%; height: 100%; display: block; border-radius: 10px; }
        .dsg-hint { position: absolute; inset: 0; display: grid; place-items: center; color: #cbd5e1; font-size: 20px; font-weight: 700; pointer-events: none; }
        .dsg-b { display: flex; gap: 8px; margin-top: 10px; }
        .dsg-b button { border-radius: 10px; padding: 11px 14px; font-weight: 800; font-size: 14px; cursor: pointer; font-family: inherit; }
        .dsg-ghost { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
        .dsg-go { flex: 1; border: 0; background: #2563eb; color: #fff; }
        .dsg-go:disabled { opacity: .5; }
      `}</style>
    </div>
  );
}
