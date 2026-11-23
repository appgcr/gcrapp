import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FileUp, Camera, Loader2, FileText, CheckCircle2, RefreshCw, ArrowRight, Eye, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../../config/api';
import { authHeaders } from '../../Shared/authHeaders';
import { uploadDocumentFile, resolveDocUrl, formatMB } from '../../../utils/docFiles';
import { ListMessage } from '../../Shared/AppToaster';
import VoiceSheetFill from './VoiceSheetFill';

// The filled GOURU VALUATION – OFFICE sheet: upload it (Word / PDF / photo), Gouru AI reads it, the
// engineer checks every value here, then goes on to the site photos.

export const EMPTY_SHEET = {
  dealType: '', ownerName: '', ownerRelation: '', ownerAddress: '', applicantName: '', applicantRelation: '', applicantAddress: '', bank: '', engineerNames: '', inspectionDate: '',
  deedNo: '', deedDate: '', surveyNo: '', doorNo: '', wardNo: '', plotNo: '', address: '', extentDocument: '', extentPlan: '',
  measurements: { east: '', west: '', north: '', south: '' }, boundaries: { east: '', west: '', north: '', south: '' },
  netExtentPlan: '', roadAffectedArea: '', baNumber: '', baDate: '', floorsArea: '', guidelineRate: '', assessmentNo: '', taxAmount: '',
  taxName: '', propertyType: '', structureType: '', buildingAge: '', marketRatePerCent: '', constructionRate: '', roadWidth: '',
  roadType: '', flooringType: '', comments: '', extras: '',
};
const PROPERTY = ['Independent House', 'Open Site', 'Apartment', 'Open Agriculture Land', 'Industrial Unit'];
const PROPERTY_LABEL = { 'Independent House': 'House', 'Open Site': 'Open', 'Apartment': 'Apartment', 'Open Agriculture Land': 'Agri', 'Industrial Unit': 'Industrial' };
const STRUCTURE = ['RCC Framed structure', 'Load bearing', 'PEB structure'];
const ROAD = ['CC Road', 'BT Road', 'Metal Road'];
const FLOORING = ['Tiles', 'Granite', 'Marble', 'Kadapa slab', 'Betham cherla'];
const SIDES = ['east', 'west', 'north', 'south'];
export const isBuilt = (t = '') => !/open|agri|site|plot|land/i.test(t);

/** What must be filled before going on → list of names (empty = ready) */
export function sheetMissing(s) {
  const m = [];
  if (!s.dealType) m.push('Mortgage or Purchase');
  if (s.dealType === 'Purchase') { if (!s.applicantName) m.push('Applicant name'); if (!s.ownerName) m.push('Owner name'); }
  else if (!s.ownerName) m.push('Owner name');
  if (!s.deedNo) m.push('Deed no');
  if (!s.surveyNo && !s.doorNo) m.push('Survey no or Door no');
  if (!s.extentDocument) m.push('Extent as per document');
  const noSides = SIDES.filter((k) => !String(s.boundaries?.[k] || '').trim());
  if (noSides.length) m.push(noSides.length === 4 ? 'Boundaries (all 4)' : `Boundary ${noSides.map((k) => k[0].toUpperCase() + k.slice(1)).join(', ')}`);
  if (!s.propertyType) m.push('Type of property');
  if (!s.marketRatePerCent) m.push('Market rate per cent');
  else if (Number(String(s.marketRatePerCent).replace(/,/g, '').replace(/[^\d.]/g, '')) < 1000 && !/lakh|lac|crore|\bcr\b/i.test(s.marketRatePerCent)) m.push('Market rate per cent (looks too small — write e.g. 14,25,000 or 14.25 lakhs)');
  if (!s.roadWidth) m.push('Road width');
  if (isBuilt(s.propertyType)) {
    if (!s.structureType) m.push('Type of structure');
    if (!s.buildingAge) m.push('Age of the building');
    if (!s.floorsArea) m.push('GF area & other floors');
    if (!s.constructionRate) m.push('Construction rate per sqft');
  }
  return m;
}

export default function OfficeSheetStep({ voiceKey, sheet, setSheet, sheetFiles = [], setSheetFiles, locked = {}, onNext, onPreview }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [voiceKeys, setVoiceKeys] = useState(() => new Set()); // fields just filled by voice (highlighted)
  const s = { ...EMPTY_SHEET, ...sheet, measurements: { ...EMPTY_SHEET.measurements, ...(sheet?.measurements || {}) }, boundaries: { ...EMPTY_SHEET.boundaries, ...(sheet?.boundaries || {}) } };
  const unmark = (k) => setVoiceKeys((prev) => { if (!prev.has(k)) return prev; const n = new Set(prev); n.delete(k); return n; });
  const set = (k, v) => { unmark(k); setSheet((prev) => ({ ...EMPTY_SHEET, ...prev, [k]: v })); };
  const setSide = (group, side, v) => unmark(`${group}.${side}`) || setSheet((prev) => ({ ...EMPTY_SHEET, ...prev, [group]: { ...EMPTY_SHEET[group], ...(prev?.[group] || {}), [side]: v } }));

  // One or more pages of the sheet (photos, PDF, Word): uploaded, then read together as one sheet
  const meta = (file, url) => {
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    const isWord = /\.docx?$/i.test(file.name) || /word/i.test(file.type);
    return { id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: file.name, url, isPdf, isWord, size: file.size,
      sizeFormatted: file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : formatMB(file.size),
      extension: (file.name.split('.').pop() || '').toUpperCase(), uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) };
  };
  const readAll = async (list) => {
    if (!list.length) return;
    setBusy(list.length > 1 ? `Gouru AI is reading the ${list.length} pages…` : 'Gouru AI is reading the sheet…');
    try {
      const r = await fetch(`${API_BASE_URL}/api/extract/office-sheet`, { method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ files: list.map((f) => ({ url: f.url, name: f.name })) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'The sheet could not be read. Type the details below.');
      // Keep anything the engineer already typed; fill the rest from the sheet
      setSheet((prev) => {
        const p = { ...EMPTY_SHEET, ...prev };
        const f = j.fields || {};
        const out = { ...p };
        Object.keys(EMPTY_SHEET).forEach((k) => {
          if (k === 'measurements' || k === 'boundaries') out[k] = Object.fromEntries(SIDES.map((sd) => [sd, String(p[k]?.[sd] || '').trim() || f[k]?.[sd] || '']));
          else out[k] = String(p[k] || '').trim() || f[k] || '';
        });
        out.corrections = Array.isArray(f.corrections) ? f.corrections : [];
        return out;
      });
      toast.success(`Read ${j.filled || 0} details from the sheet. Please check them below.`, { duration: 5000 });
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally { setBusy(''); }
  };
  const add = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const big = files.find((f) => f.size > 25 * 1024 * 1024);
    if (big) { toast.error(`${big.name} is over 25 MB. Please upload a smaller copy.`); return; }
    if (sheetFiles.length + files.length > 10) { toast.error('Up to 10 pages for one sheet.'); return; }
    setBusy(files.length > 1 ? `Uploading ${files.length} files…` : 'Uploading the sheet…');
    let added = [];
    try {
      added = await Promise.all(files.map(async (f) => meta(f, await uploadDocumentFile(f))));
    } catch (err) {
      setBusy(''); toast.error(err.message || 'Upload failed. Please try again.'); return;
    }
    const list = [...sheetFiles, ...added];
    setSheetFiles(list);
    await readAll(list);
  };
  const remove = (id) => setSheetFiles(sheetFiles.filter((f) => f.id !== id));

  const next = () => {
    if (!sheetFiles.length) { toast.error('Please upload the filled office sheet first.'); return; }
    const missing = sheetMissing(s);
    if (missing.length) {
      toast.error(<ListMessage title={`Fill ${missing.length === 1 ? 'this' : `these ${missing.length}`} to continue`} items={missing} />, { id: 'sheet-missing', duration: 7000 });
      return;
    }
    onNext(s);
  };

  const p = { s, set, hl: voiceKeys };
  const built = isBuilt(s.propertyType);

  return (
    <div className="os">
      <input ref={fileRef} type="file" hidden multiple accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; add(fs); }} />
      <input ref={camRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; add(fs); }} />

      <div className={`os-up ${sheetFiles.length ? 'done' : ''}`}>
        {busy ? (
          <div className="os-busy"><Loader2 size={20} className="spin" /> {busy}</div>
        ) : sheetFiles.length ? (
          <>
            {sheetFiles.map((f, i) => (
              <div className="os-file" key={f.id || i}>
                <span className="os-ico">{f.isPdf || f.isWord ? <FileText size={20} /> : <CheckCircle2 size={20} />}</span>
                <span className="os-fn"><b>{sheetFiles.length > 1 ? `Page ${i + 1} · ` : ''}{f.name}</b><small>{[f.extension, f.sizeFormatted].filter(Boolean).join(' · ')} · uploaded</small></span>
                {!f.isWord && <button type="button" className="os-mini" onClick={() => onPreview && onPreview({ ...f, url: resolveDocUrl(f.url) })} aria-label={`View ${f.name}`}><Eye size={16} /></button>}
                <button type="button" className="os-mini" onClick={() => remove(f.id)} aria-label={`Remove ${f.name}`}><Trash2 size={16} /></button>
              </div>
            ))}
            <div className="os-more">
              <button type="button" onClick={() => fileRef.current?.click()}><Plus size={15} /> Add page / file</button>
              <button type="button" onClick={() => camRef.current?.click()}><Camera size={15} /> Photo</button>
              <button type="button" onClick={() => readAll(sheetFiles)}><RefreshCw size={15} /> Read again</button>
            </div>
          </>
        ) : (
          <>
            <div className="os-up-t">Upload the filled office sheet</div>
            <div className="os-up-s">GOURU VALUATION – OFFICE sheet: Word (.docx), PDF or clear photos — choose all the pages together. Gouru AI fills the details below.</div>
            <div className="os-up-b">
              <button type="button" onClick={() => fileRef.current?.click()}><FileUp size={17} /> Choose files</button>
              <button type="button" onClick={() => camRef.current?.click()}><Camera size={17} /> Take photo</button>
            </div>
          </>
        )}
      </div>

      <VoiceSheetFill storeKey={voiceKey} setSheet={setSheet} emptySheet={EMPTY_SHEET} onFilled={(keys) => setVoiceKeys(new Set(keys))} />

      {Array.isArray(s.corrections) && s.corrections.length > 0 && (
        <div className="os-fix">
          <b>Gouru AI corrected these spellings / formats — please check</b>
          <ul>{s.corrections.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}

      <div className="os-sec">Mortgage or Purchase</div>
      <div className="os-seg">
        {['Mortgage', 'Purchase'].map((d) => <button type="button" key={d} className={s.dealType === d ? 'on' : ''} onClick={() => set('dealType', d)}>{d}</button>)}
      </div>
      <div className="os-grid">
        {s.dealType === 'Purchase' ? (<>
          <Field {...p} k="applicantName" label="Applicant (buyer) name" ph="As on the agreement" />
          <Field {...p} k="applicantRelation" label="Applicant S/o · W/o · D/o" ph="W/o K. Ramesh" />
          <Field {...p} k="applicantAddress" label="Applicant address" />
          <Field {...p} k="ownerName" label="Owner (seller) name" ph="Present owner" />
          <Field {...p} k="ownerRelation" label="Owner S/o · W/o · D/o" ph="S/o …" />
          <Field {...p} k="ownerAddress" label="Owner address" />
        </>) : (<>
          <Field {...p} k="ownerName" label="Owner name" ph="As on the sale deed" />
          <Field {...p} k="ownerRelation" label="Owner S/o · W/o · D/o" ph="S/o …" />
          <Field {...p} k="ownerAddress" label="Owner address" />
        </>)}
        <Field {...p} k="engineerNames" label="Engineer names" ph="All engineers who inspected" />
        <Field {...p} k="inspectionDate" label="Inspection & valuation date" ph="dd-mm-yyyy" />
      </div>

      <div className="os-sec">Property</div>
      <div className="os-grid">
        <Field {...p} k="deedNo" label="Deed no" ph="1234/2024" />
        <Field {...p} k="deedDate" label="Deed date" ph="dd-mm-yyyy" />
        <Field {...p} k="surveyNo" label="Survey no" />
        <Field {...p} k="doorNo" label="Door no" />
        <Field {...p} k="wardNo" label="Ward no" />
        <Field {...p} k="plotNo" label="Plot no" />
        <Field {...p} k="address" label="Detail address" wide area />
      </div>

      <div className="os-sec">Extent</div>
      <div className="os-grid">
        <Field {...p} k="extentDocument" label="As per document" ph="200 Sq.yds" />
        <Field {...p} k="extentPlan" label="As per plan" ph="190 Sq.yds" />
        <Field {...p} k="netExtentPlan" label="Net extent as per plan" />
        <Field {...p} k="roadAffectedArea" label="Road affected area" ph="0 if none" />
      </div>
      <div className="os-sides">
        <div className="os-sides-h"><span /> <span>Measurement</span><span>Boundary</span></div>
        {SIDES.map((sd) => (
          <div key={sd} className="os-side">
            <b>{sd.toUpperCase()}</b>
            <input className={voiceKeys.has(`measurements.${sd}`) ? 'os-hl' : ''} value={s.measurements[sd]} placeholder="40 ft" onChange={(e) => setSide('measurements', sd, e.target.value)} aria-label={`${sd} measurement`} />
            <input className={voiceKeys.has(`boundaries.${sd}`) ? 'os-hl' : ''} value={s.boundaries[sd]} placeholder="Road / Plot no / House of…" onChange={(e) => setSide('boundaries', sd, e.target.value)} aria-label={`${sd} boundary`} />
          </div>
        ))}
      </div>

      <div className="os-sec">Plan, tax & value</div>
      <div className="os-grid">
        <Field {...p} k="baNumber" label="Plan approval B.A. number" />
        <Field {...p} k="baDate" label="B.A. date" />
        <Field {...p} k="floorsArea" label="GF area & other floors" ph="GF 1200 sft, FF 1100 sft" wide />
        <Field {...p} k="guidelineRate" label="Govt market value · unit rate per Sq.yd" num />
        <Field {...p} k="assessmentNo" label="Property tax · assessment no" />
        <Field {...p} k="taxAmount" label="Property tax · amount (Rs)" num />
        <Field {...p} k="taxName" label="Property tax · in the name of" />
      </div>

      <div className="os-sec">Type of property</div>
      <Chips {...p} k="propertyType" options={PROPERTY} labels={PROPERTY_LABEL} />
      {built && (<>
        <div className="os-sec">Type of structure</div>
        <Chips {...p} k="structureType" options={STRUCTURE} labels={{ 'RCC Framed structure': 'R.C.C Framed', 'PEB structure': 'PEB structure' }} />
      </>)}
      <div className="os-grid">
        {built && <Field {...p} k="buildingAge" label="Age of the building" ph="8 years" />}
        <Field {...p} k="marketRatePerCent" label="Market rate per cent (Rs)" num ph="14,25,000" />
        {built && <Field {...p} k="constructionRate" label="Construction rate per sqft (Rs)" num ph="2,500" />}
        <Field {...p} k="roadWidth" label="Road width (ft)" num ph="30" />
      </div>
      <div className="os-sec">Type of road</div>
      <Chips {...p} k="roadType" options={ROAD} />
      {built && (<>
        <div className="os-sec">Type of flooring</div>
        <Chips {...p} k="flooringType" options={FLOORING} />
      </>)}
      <div className="os-grid">
        <Field {...p} k="comments" label="Any other comments / note" wide area />
        <Field {...p} k="extras" label="Extras (compound wall, sump …)" wide area />
      </div>

      <button type="button" className="btn-primary os-next" onClick={next} disabled={!!busy}>Next: Site photos &amp; selfie <ArrowRight size={18} /></button>

      <style>{`
        .os { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 10px; padding: 0 2px 12px; }
        .os > * { flex-shrink: 0; }
        .os-up { border: 2px dashed #93c5fd; background: #eff6ff; border-radius: 14px; padding: 16px; }
        .os-up.done { border-style: solid; border-color: #bbf7d0; background: #f0fdf4; padding: 10px 12px; }
        .os-up-t { font-weight: 800; font-size: 15.5px; color: #1e3a8a; }
        .os-up-s { font-size: 12.5px; color: #475569; margin-top: 3px; line-height: 1.4; }
        .os-up-b { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .os-up-b button { flex: 1; min-width: 130px; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 11px; border-radius: 11px; border: 0; background: #2563eb; color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; font-family: inherit; }
        .os-up-b button + button { background: #fff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .os-up.done .os-file + .os-file { margin-top: 8px; padding-top: 8px; border-top: 1px solid #dcfce7; }
        .os-more { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
        .os-more button { flex: 1; min-width: 96px; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 9px 8px; border-radius: 10px; border: 1px solid #bbf7d0; background: #fff; color: #15803d; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }
        body.dark-theme .os-more button { background: #1c1c1e; border-color: #2f4f3a; color: #4ade80; }
        .os-busy { display: flex; align-items: center; gap: 10px; font-weight: 700; color: #1d4ed8; padding: 6px 2px; }
        .os-file { display: flex; align-items: center; gap: 10px; }
        .os-ico { width: 38px; height: 38px; border-radius: 10px; background: #dcfce7; color: #16a34a; display: grid; place-items: center; flex-shrink: 0; }
        .os-fn { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .os-fn b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .os-fn small { font-size: 12px; color: #64748b; }
        .os-mini { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #cbd5e1; background: #fff; color: #334155; display: grid; place-items: center; cursor: pointer; flex-shrink: 0; }
        .os-fix { border: 1px solid #fde68a; background: #fffbeb; border-radius: 12px; padding: 10px 12px; font-size: 13px; color: #78350f; }
        .os-fix b { display: block; margin-bottom: 4px; }
        .os-fix ul { margin: 0; padding-left: 18px; } .os-fix li { margin: 2px 0; }
        .os-sec { margin-top: 8px; font-size: 12px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; color: #64748b; }
        .os-seg { display: flex; background: #e2e8f0; border-radius: 11px; padding: 3px; }
        .os-seg button { flex: 1; border: 0; background: none; padding: 10px; border-radius: 9px; font-weight: 800; font-size: 14.5px; color: #334155; cursor: pointer; font-family: inherit; }
        .os-seg button.on { background: #fff; color: #1d4ed8; box-shadow: 0 1px 4px rgba(15,23,42,.12); }
        .os-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .os-f { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .os-f.wide { grid-column: 1 / -1; }
        .os-f span { font-size: 12px; font-weight: 700; color: #475569; }
        .os-f input, .os-f textarea, .os-side input { width: 100%; box-sizing: border-box; min-width: 0; padding: 10px 11px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; font-size: 15px; font-family: inherit; color: #0f172a; }
        .os-f textarea { resize: vertical; }
        .os-f.hl input, .os-f.hl textarea, .os-side input.os-hl { border-color: #6366f1; background: #eef2ff; box-shadow: 0 0 0 2px rgba(99,102,241,.18); }
        .os-f.hl span::after { content: ' · by voice'; color: #4f46e5; font-weight: 700; }
        .os-chips.hl button.on { box-shadow: 0 0 0 3px rgba(99,102,241,.35); }
        body.dark-theme .os-f.hl input, body.dark-theme .os-f.hl textarea, body.dark-theme .os-side input.os-hl { background: #23234a; border-color: #6366f1; }
        .os-sides { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
        .os-sides-h, .os-side { display: grid; grid-template-columns: 52px 0.8fr 1.4fr; gap: 6px; align-items: center; }
        .os-sides-h span { font-size: 11.5px; font-weight: 700; color: #64748b; }
        .os-side b { font-size: 12px; color: #334155; }
        .os-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .os-chips button { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 999px; padding: 8px 13px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .os-chips button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
        .os-next { margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        body.dark-theme .os-f input, body.dark-theme .os-f textarea, body.dark-theme .os-side input, body.dark-theme .os-sides, body.dark-theme .os-chips button { background: #1c1c1e; color: #fff; border-color: #3a3a3c; }
        body.dark-theme .os-seg { background: #2c2c2e; } body.dark-theme .os-seg button { color: #d1d5db; } body.dark-theme .os-seg button.on { background: #3a3a3c; color: #fff; }
      `}</style>
    </div>
  );
}

function Field({ s, set, hl, k, label, ph, wide, num, area }) {
  return (
    <label className={`os-f ${wide ? 'wide' : ''} ${hl && hl.has(k) ? 'hl' : ''}`}>
      <span>{label}</span>
      {area ? <textarea rows={2} value={s[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} />
        : <input value={s[k]} placeholder={ph} inputMode={num ? 'decimal' : undefined} onChange={(e) => set(k, e.target.value)} />}
    </label>
  );
}
function Chips({ s, set, hl, k, options, labels }) {
  return (
    <div className={`os-chips ${hl && hl.has(k) ? 'hl' : ''}`}>
      {options.map((o) => <button type="button" key={o} className={s[k] === o ? 'on' : ''} onClick={() => set(k, s[k] === o ? '' : o)}>{labels?.[o] || o}</button>)}
    </div>
  );
}

/** Office sheet → the case's own fields (the bank report reads these) */
export function sheetToCase(s, prev = {}) {
  const num = (v) => String(v || '').replace(/[^\d.]/g, '');
  // Money as written by hand: "14.25 lakhs" → 1425000, "Rs.2,500/-" → 2500
  const amt = (v) => {
    const t = String(v || '').replace(/,/g, '').toLowerCase();
    const m = /(\d+(?:\.\d+)?)/.exec(t);
    if (!m) return '';
    let n = parseFloat(m[1]);
    const after = t.slice(m.index + m[1].length, m.index + m[1].length + 9);
    if (/\b(lakh|lakhs|lac|lacs|lks?|l)\b/.test(after)) n *= 100000; else if (/\b(crore|crores|cr|crs)\b/.test(after)) n *= 10000000;
    return String(Math.round(n));
  };
  const floors = String(s.floorsArea || '');
  const areaOf = (re) => { const m = re.exec(floors); return m ? m[1] : ''; };
  const gf = areaOf(/\bG\.?\s*F\.?\b\D{0,12}?([\d,.]+)/i);
  const ff = areaOf(/\bF\.?\s*F\.?\b\D{0,12}?([\d,.]+)/i);
  const sf = areaOf(/\bS\.?\s*F\.?\b\D{0,12}?([\d,.]+)/i);
  const floorRows = [['gf', 'Ground Floor (GF)', gf], ['ff', 'First Floor (FF)', ff], ['sf', 'Second Floor (SF)', sf]].filter(([, , v], i) => i === 0 || v)
    .map(([id, label, v]) => ({ id, label, value: num(v) }));
  const age = (String(s.buildingAge || '').match(/\d+/) || [''])[0];
  // Village / area for the report's address line: the first part of the detail address that isn't a number
  const addrParts = String(s.address || '').split(/,|\n/).map((x) => x.trim()).filter(Boolean);
  const placeParts = addrParts.filter((x) => !/^(d\.?\s*no|door|h\.?\s*no|plot|flat|sy|s\.?\s*no)\b/i.test(x) && !/^\d[\d\s/-]*$/.test(x));
  // "…, Akkayapalli Village Field At …" → Akkayapalli: the word(s) written before "Village"
  const named = /([A-Za-z][A-Za-z.\s]{1,40}?)\s+village\b/i.exec(String(s.address || ''));
  const village = (named ? named[1].split(',').pop() : (placeParts[0] || '')).replace(/\s*\d{6}$/, '').trim();
  return {
    ...prev,
    entryMode: 'sheet',
    dealType: s.dealType,
    sheet: s,
    deedNo: s.deedNo, deedDate: s.deedDate, deedYear: (String(s.deedDate || '').match(/(19|20)\d{2}/) || [prev.deedYear || ''])[0],
    surveyNo: s.surveyNo, doorNo: s.doorNo, wardNo: s.wardNo, plotNo: s.plotNo,
    netExtent: s.extentDocument,
    boundariesDoc: { ...s.boundaries }, boundariesActual: { ...s.boundaries },
    dimensionsDoc: { ...s.measurements }, dimensionsActual: { ...s.measurements },
    approvalPlanNo: s.baNumber, approvalPlanDate: s.baDate,
    assessmentNo: s.assessmentNo,
    propertyType: s.propertyType || prev.propertyType,
    structureType: s.structureType, flooringType: s.flooringType, roadType: s.roadType,
    buildingAge: age, roadWidth: num(s.roadWidth),
    guidelineRate: amt(s.guidelineRate),
    siteValue: isBuilt(s.propertyType) && gf ? { plinthArea: num(gf), floors: floorRows } : (prev.siteValue || { plinthArea: '', floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }] }),
    village: prev.village || village,
    report: {
      ...(prev.report || {}),
      village: prev.report?.village || village,
      wardNo: s.wardNo || prev.report?.wardNo || '',
      marketRatePerCent: amt(s.marketRatePerCent),
      constructionRate: amt(s.constructionRate),
      taxAmount: amt(s.taxAmount),
      // Extents: the formats value the least of deed and plan (net of any road widening)
      extentDeedRaw: s.extentDocument || '',
      netExtentPlanRaw: s.netExtentPlan || s.extentPlan || '',
      roadAffected: s.roadAffectedArea || prev.report?.roadAffected || '',
      taxPaidName: s.taxName || prev.report?.taxPaidName || '',
      // Purchase: the buyer is the applicant; the report's owner is the present owner (seller)
      ...(s.dealType === 'Purchase'
        ? { applicantName: s.applicantName, applicantAddr: s.applicantAddress }
        : { applicantName: '', applicantAddr: '' }),
    },
    constructionRate: amt(s.constructionRate),
  };
}
