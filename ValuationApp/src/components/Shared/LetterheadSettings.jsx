import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { pdfjs } from 'react-pdf';
import { Upload, Eye, Trash2, Save, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import ReportViewer, { fetchReport } from './ReportViewer';

if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

const VALUER_FIELDS = [
  ['name', 'Valuer name', 'e.g. Gouru Neelakanta Reddy'],
  ['fatherName', 'Father’s name (for the declaration)', 'e.g. Gouru Nagi Reddy'],
  ['qualification', 'Qualification', 'e.g. B.Tech., MISTE.'],
  ['iivNo', 'Indian Institution of Valuers no.', 'e.g. F – 13622'],
  ['cell', 'Cell', '10-digit mobile'],
  ['office', 'Office phone', ''],
  ['address', 'Office address', 'Door no, street, town, district'],
];
const EMPTY_VALUER = Object.fromEntries(VALUER_FIELDS.map(([k]) => [k, '']));

/** Load a PNG/JPG, or page 1 of a PDF, into a canvas about 2000 px wide. */
async function fileToCanvas(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 2000 / base.width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { canvas: c, fromPdf: true };
  }
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) throw new Error('Upload the letterhead as a PNG, JPG or PDF file.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This file is not a readable picture.')); i.src = url; });
    const scale = Math.min(1, 2000 / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { canvas: c, fromPdf: false };
  } finally { URL.revokeObjectURL(url); }
}

/** Cut the strip between top% and bottom%, then trim plain white margins around it. */
function cropToDataUrl(src, topPct, bottomPct) {
  const y0 = Math.round(src.height * topPct / 100);
  const y1 = Math.max(y0 + 10, Math.round(src.height * bottomPct / 100));
  const strip = src.getContext('2d').getImageData(0, y0, src.width, y1 - y0);
  const { data, width, height } = strip;
  const ink = (x, y) => { const i = (y * width + x) * 4; return data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235; };
  let top = 0, bottom = height - 1, left = 0, right = width - 1;
  const rowInk = (y) => { for (let x = 0; x < width; x += 2) if (ink(x, y)) return true; return false; };
  const colInk = (x) => { for (let y = top; y <= bottom; y += 2) if (ink(x, y)) return true; return false; };
  while (top < bottom && !rowInk(top)) top++;
  while (bottom > top && !rowInk(bottom)) bottom--;
  while (left < right && !colInk(left)) left++;
  while (right > left && !colInk(right)) right--;
  const pad = 8;
  top = Math.max(0, top - pad); bottom = Math.min(height - 1, bottom + pad);
  left = Math.max(0, left - pad); right = Math.min(width - 1, right + pad);
  const out = document.createElement('canvas');
  out.width = right - left + 1; out.height = bottom - top + 1;
  out.getContext('2d').drawImage(src, left, y0 + top, out.width, out.height, 0, 0, out.width, out.height);
  let url = out.toDataURL('image/png');
  if (url.length > 2.6e6) url = out.toDataURL('image/jpeg', 0.9); // keep under the 2 MB limit
  return { url, w: out.width, h: out.height };
}

/**
 * Letterhead & valuer for one branch. Every bank report from this branch gets this letterhead at the
 * top of the page (instead of the Kadapa letterhead in the bank formats), and the valuer details
 * inside the report text. Leave everything empty to keep the Kadapa letterhead.
 */
export default function LetterheadSettings({ branchId, branchName }) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState({ letterhead: {}, valuer: EMPTY_VALUER });
  const [source, setSource] = useState(null);       // full uploaded page/picture (canvas)
  const [fileName, setFileName] = useState('');
  const [crop, setCrop] = useState([0, 100]);
  const [draft, setDraft] = useState(null);         // { url, w, h } cropped letterhead (not saved yet)
  const [otherValuer, setOtherValuer] = useState(false);
  const [valuer, setValuer] = useState(EMPTY_VALUER);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/branches/${branchId}/letterhead`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Could not load the letterhead.'))))
      .then(d => {
        const v = { ...EMPTY_VALUER, ...(d.valuer || {}) };
        setSaved({ letterhead: d.letterhead || {}, valuer: v });
        setValuer(v); setOtherValuer(!!v.name);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(() => {
    if (source) setDraft(cropToDataUrl(source, crop[0], crop[1]));
  }, [source, crop]);

  const pick = async (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error('The file is too large (max 15 MB).'); return; }
    try {
      const { canvas, fromPdf } = await fileToCanvas(file);
      setFileName(file.name);
      // A PDF / full page: start with the top quarter, where the letterhead normally is
      setCrop(fromPdf || canvas.height > canvas.width ? [0, 22] : [0, 100]);
      setSource(canvas);
    } catch (e) { toast.error(e.message || 'Could not read this file.'); }
  };

  const valuerPayload = otherValuer ? valuer : EMPTY_VALUER;
  const valuerError = () => {
    if (!otherValuer) return null;
    if (!valuer.name.trim()) return 'Enter the valuer’s name.';
    if (!valuer.fatherName.trim()) return 'Enter the valuer’s father’s name — the declaration page needs it.';
    if (!valuer.iivNo.trim()) return 'Enter the Indian Institution of Valuers number.';
    return null;
  };
  const letterheadNow = draft ? draft.url : (saved.letterhead.dataUrl || '');

  const save = async () => {
    const err = valuerError();
    if (err) { toast.error(err); return; }
    if (draft && draft.h > draft.w) { toast.error('Crop the picture to just the letterhead strip at the top of the page.'); return; }
    setBusy(true);
    try {
      const body = { valuer: valuerPayload };
      if (draft) { body.dataUrl = draft.url; body.fileName = fileName; }
      const r = await fetch(`${API_BASE_URL}/api/branches/${branchId}/letterhead`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      setSaved({ letterhead: d.letterhead || {}, valuer: { ...EMPTY_VALUER, ...(d.valuer || {}) } });
      setSource(null); setDraft(null);
      toast.success('Saved. New reports from this branch use this letterhead.');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const removeLetterhead = async () => {
    if (!window.confirm('Remove this letterhead? Reports will go back to the Kadapa letterhead.')) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/branches/${branchId}/letterhead`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: '' }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not remove it.');
      setSaved(s => ({ ...s, letterhead: {} })); setSource(null); setDraft(null);
      toast.success('Letterhead removed.');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const openPreview = () => {
    const err = valuerError();
    if (err) { toast.error(err); return; }
    setPreview({ dataUrl: letterheadNow, valuer: valuerPayload });
  };

  if (!branchId) return <p className="ios-footnote">This account is not linked to a branch.</p>;
  if (loading) return <p className="ios-footnote">Loading…</p>;

  const box = { background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, padding: 14, marginBottom: 14 };
  const input = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' };
  const btn = (primary) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
    border: primary ? 'none' : '1px solid #cbd5e1', background: primary ? 'var(--primary, #0346c8)' : '#fff', color: primary ? '#fff' : 'var(--text-primary, #0f172a)' });

  return (
    <div data-testid="letterhead-settings">
      <p className="ios-footnote" style={{ marginTop: 0 }}>
        {branchName ? <b>{branchName}: </b> : null}
        every bank report from this branch gets this letterhead at the top of the page. The bank’s own layout below it stays exactly the same.
        With nothing uploaded, reports use the Kadapa letterhead.
      </p>

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Letterhead</div>
        {letterheadNow ? (
          <div style={{ border: '1px dashed #94a3b8', borderRadius: 8, padding: 8, background: '#fff', marginBottom: 10 }}>
            <img src={letterheadNow} alt="Letterhead" style={{ width: '100%', display: 'block' }} />
          </div>
        ) : (
          <p className="ios-footnote" style={{ margin: '0 0 10px' }}>No letterhead uploaded — the Kadapa letterhead is used.</p>
        )}
        {saved.letterhead.updatedAt && !draft && (
          <p className="ios-footnote" style={{ margin: '0 0 10px' }}>
            Saved {new Date(saved.letterhead.updatedAt).toLocaleDateString('en-IN')}{saved.letterhead.updatedBy ? ` by ${saved.letterhead.updatedBy}` : ''}.
          </p>
        )}

        {source && (
          <div style={{ marginBottom: 10 }}>
            <div className="ios-footnote" style={{ margin: '0 0 6px' }}>Move the sliders so only the letterhead strip is kept. White margins are trimmed for you.</div>
            <label style={{ fontSize: 13 }}>Top edge: {crop[0]}%
              <input type="range" min="0" max="95" value={crop[0]} style={{ width: '100%' }}
                onChange={e => setCrop(([, b]) => [Math.min(+e.target.value, b - 3), b])} />
            </label>
            <label style={{ fontSize: 13 }}>Bottom edge: {crop[1]}%
              <input type="range" min="3" max="100" value={crop[1]} style={{ width: '100%' }}
                onChange={e => setCrop(([a]) => [a, Math.max(+e.target.value, a + 3)])} />
            </label>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" hidden
          onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btn(false)} onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {letterheadNow ? 'Upload a new letterhead' : 'Upload letterhead'}
          </button>
          {saved.letterhead.updatedAt && !draft && (
            <button type="button" style={{ ...btn(false), color: '#b91c1c' }} onClick={removeLetterhead} disabled={busy}>
              <Trash2 size={16} /> Remove
            </button>
          )}
        </div>
        <p className="ios-footnote" style={{ margin: '8px 0 0' }}>PNG, JPG or PDF (the first page is used). A scan or a photo of your letter paper works too.</p>
      </div>

      <div style={box}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700, cursor: 'pointer' }}>
          <input type="checkbox" checked={otherValuer} onChange={e => setOtherValuer(e.target.checked)} style={{ width: 20, height: 20 }} data-testid="other-valuer" />
          This branch’s reports are signed by a different valuer
        </label>
        <p className="ios-footnote" style={{ margin: '6px 0 0' }}>
          The bank formats name Gouru Neelakanta Reddy (IIV F – 13622) as the valuer on the declaration and signature pages.
          Tick this to put this branch’s valuer there instead.
        </p>
        {otherValuer && (
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {VALUER_FIELDS.map(([k, label, ph]) => (
              <label key={k} style={{ fontSize: 13, fontWeight: 600 }}>
                {label}{['name', 'fatherName', 'iivNo'].includes(k) ? ' *' : ''}
                {k === 'address'
                  ? <textarea rows={2} style={{ ...input, marginTop: 4 }} value={valuer[k]} placeholder={ph} onChange={e => setValuer(v => ({ ...v, [k]: e.target.value }))} />
                  : <input style={{ ...input, marginTop: 4 }} value={valuer[k]} placeholder={ph} inputMode={['cell', 'office'].includes(k) ? 'tel' : undefined}
                      onChange={e => setValuer(v => ({ ...v, [k]: e.target.value }))} data-testid={`valuer-${k}`} />}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" style={btn(false)} onClick={openPreview} disabled={busy}><Eye size={16} /> Preview a report</button>
        <button type="button" style={btn(true)} onClick={save} disabled={busy} data-testid="save-letterhead">
          {busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save
        </button>
      </div>

      {preview && (
        <ReportViewer
          title="Letterhead preview"
          subtitle="Sample Bank of Baroda report — not saved yet"
          fileName="Letterhead_Preview.docx"
          load={() => fetchReport(`${API_BASE_URL}/api/branches/${branchId}/letterhead/preview`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preview),
          })}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
