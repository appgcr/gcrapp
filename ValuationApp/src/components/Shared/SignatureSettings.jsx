import React, { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config/api';

/** The valuer's digital signature (admins): drawn or uploaded once, saved on the account,
 *  printed on every report they approve. */
export default function SignatureSettings({ onSaved } = {}) {
  const [saved, setSaved] = useState('');
  const [mode, setMode] = useState('draw');
  const [upload, setUpload] = useState('');
  const [busy, setBusy] = useState(false);
  const pad = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : {})).then(d => setSaved(d?.user?.savedSignature || '')).catch(() => {});
  }, []);

  const readUpload = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { toast.error('Upload a PNG or JPG image of your signature.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('The image is too large. Use one under 2 MB.'); return; }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      setUpload(c.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const save = async () => {
    let dataUrl = '';
    if (mode === 'draw') {
      if (!pad.current || pad.current.isEmpty()) { toast.error('Please draw your signature first.'); return; }
      // Crop to the ink (the library's getTrimmedCanvas is broken in this build)
      const src = pad.current.getCanvas();
      const { width, height } = src;
      const px = src.getContext('2d').getImageData(0, 0, width, height).data;
      let x0 = width; let y0 = height; let x1 = 0; let y1 = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (px[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(width, x1 + m); y1 = Math.min(height, y1 + m);
      const out = document.createElement('canvas');
      out.width = Math.max(1, x1 - x0); out.height = Math.max(1, y1 - y0);
      out.getContext('2d').drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      dataUrl = out.toDataURL('image/png');
    } else {
      if (!upload) { toast.error('Please choose your signature image first.'); return; }
      dataUrl = upload;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/auth/me/signature`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save the signature.');
      setSaved(dataUrl); setUpload(''); if (pad.current) pad.current.clear();
      toast.success('Signature saved. It is printed on every report you approve.');
      if (onSaved) onSaved(dataUrl);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    await fetch(`${API_BASE_URL}/api/auth/me/signature`, { method: 'DELETE' }).catch(() => {});
    setSaved('');
    toast.success('Signature removed.');
  };

  const box = { border: '2px dashed #cbd5e1', borderRadius: 12, background: '#fff', height: 160, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const tab = (on) => ({ flex: 1, padding: 9, fontSize: 13, fontWeight: 600, borderRadius: 9, border: on ? '2px solid #007aff' : '1px solid #d1d5db', background: on ? 'rgba(0,122,255,.06)' : '#fff', color: on ? '#007aff' : '#6b7280', cursor: 'pointer' });

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="signature-settings">
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Saved signature</div>
        <div style={{ ...box, borderStyle: 'solid', background: '#f8fafc' }}>
          {saved ? <img src={saved} alt="Saved signature" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
            : <span style={{ color: '#9ca3af', fontSize: 13 }}>No signature saved yet</span>}
        </div>
        {saved && <button type="button" onClick={remove} style={{ marginTop: 8, background: 'none', border: 0, color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: 0 }}>Remove saved signature</button>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{saved ? 'Replace it' : 'Add your signature'}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" style={tab(mode === 'draw')} onClick={() => setMode('draw')}>Draw</button>
        <button type="button" style={tab(mode === 'upload')} onClick={() => setMode('upload')}>Upload image</button>
      </div>
      {mode === 'draw' ? (
        <div style={box}>
          <SignatureCanvas ref={pad} penColor="#0b1f4d" canvasProps={{ style: { width: '100%', height: '100%', borderRadius: 12 } }} />
          <button type="button" onClick={() => pad.current && pad.current.clear()} style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Clear</button>
        </div>
      ) : (
        <label style={{ ...box, cursor: 'pointer' }}>
          <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => readUpload(e.target.files && e.target.files[0])} />
          {upload ? <img src={upload} alt="New signature" style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }} />
            : <span style={{ color: '#6b7280', fontSize: 13, fontWeight: 600 }}>Tap to choose a signature image (white background)</span>}
        </label>
      )}
      <button type="button" className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save signature'}</button>
      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.45 }}>
        When you approve a case, this signature is printed on the bank report as the valuer’s signature.
      </p>
    </div>
  );
}
