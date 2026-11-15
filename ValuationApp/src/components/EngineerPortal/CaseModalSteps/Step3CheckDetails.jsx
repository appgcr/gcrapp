import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Pencil, ChevronRight, FileText, Receipt, IndianRupee, Compass, Building2, Sparkles } from 'lucide-react';
import { toFieldValue, isBuiltProperty } from './caseModalHelpers';

/**
 * Step 3 — Check document details.
 * Everything Mahe AI read from the uploaded documents, as a short list to check.
 * Tap a row to correct it; anything the AI could not find is marked "Missing" and can be typed here.
 * Site-visit details (road, building, extra items…) come on the next screen.
 */

const isApartment = (t = '') => /apartment|flat/i.test(t);

function fieldsFor(propertyType) {
  const rows = [
    { group: 'Registration', key: 'deedNo', label: 'Deed number', required: true, hint: 'e.g. 4004/2016' },
    { group: 'Registration', key: 'deedYear', label: 'Deed date / year', hint: 'e.g. 12-02-2016' },
    { group: 'Registration', key: 'netExtent', label: 'Net extent / area', required: true, hint: 'e.g. 2.83 Cents' },
    { group: 'Registration', key: 'surveyNo', label: 'Survey number', required: true, hint: 'e.g. 343 or 347/2' },
    { group: 'Registration', key: 'plotNo', label: 'Plot number', hint: 'Optional' },
    { group: 'Registration', key: 'khathaNo', label: 'Khatha number', hint: 'Optional' },
    { group: 'Registration', key: 'village', label: 'Village / area', hint: 'e.g. Nagarajupeta' },
    { group: 'Registration', key: 'mandal', label: 'Mandal', hint: 'e.g. Kadapa' },
    { group: 'Tax & approval', key: 'assessmentNo', label: 'Property tax / assessment no', hint: 'e.g. 1013104872' },
    { group: 'Tax & approval', key: 'doorNo', label: 'Door / house number', hint: 'e.g. 58/384-2-1-2' },
  ];
  if (isBuiltProperty(propertyType)) {
    rows.push(
      { group: 'Tax & approval', key: 'approvalPlanNo', label: 'Building approval no', hint: 'e.g. 1013/0114/B/KAD' },
      { group: 'Tax & approval', key: 'approvalPlanDate', label: 'Approval date', hint: 'Optional' },
    );
  }
  if (isApartment(propertyType)) {
    rows.push(
      { group: 'Apartment', key: 'builderName', label: 'Builder / developer', required: true, hint: 'e.g. Sri Sai Constructions' },
      { group: 'Apartment', key: 'managingPartner', label: 'Managing partner', hint: 'Optional' },
      { group: 'Apartment', key: 'flatNo', label: 'Flat number', hint: 'e.g. 302' },
      { group: 'Apartment', key: 'floorNo', label: 'Floor', hint: 'e.g. 3rd Floor' },
    );
  }
  rows.push({ group: 'Rates', key: 'report.guidelineRatePerSqyd', label: 'Guideline rate per Sq.yd (₹)', hint: 'From the market value certificate', num: true });
  ['north', 'south', 'east', 'west'].forEach((d) => rows.push({
    group: 'Boundaries as per documents', key: `boundariesDoc.${d}`, label: d[0].toUpperCase() + d.slice(1), required: true, hint: 'e.g. 30 ft Road',
  }));
  return rows;
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, value) {
  const [head, ...rest] = path.split('.');
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj?.[head] || {}, rest.join('.'), value) };
}

/** Required document fields still empty (used before moving on) */
export function missingDocDetails(propertyDetails = {}) {
  return fieldsFor(toFieldValue(propertyDetails.propertyType) || '')
    .filter((f) => f.required && !String(toFieldValue(getPath(propertyDetails, f.key)) || '').trim())
    .map((f) => (f.group.startsWith('Boundaries') ? `Boundary ${f.label} (documents)` : f.label));
}

const GROUP_ICON = { Registration: FileText, 'Tax & approval': Receipt, Apartment: Building2, Rates: IndianRupee, 'Boundaries as per documents': Compass };
const fmtRate = (v) => (/^\d+(\.\d+)?$/.test(v) ? `₹${Number(v).toLocaleString('en-IN')} / Sq.yd` : v);

export default function Step3CheckDetails({ propertyDetails = {}, setPropertyDetails, setManuallyModifiedFields, onNext }) {
  const [editing, setEditing] = useState(null);
  const rows = fieldsFor(toFieldValue(propertyDetails.propertyType) || '');
  const value = (k) => String(toFieldValue(getPath(propertyDetails, k)) ?? '').trim();
  const found = rows.filter((r) => value(r.key)).length;
  const missingRequired = rows.filter((r) => r.required && !value(r.key)).length;
  const groups = [...new Set(rows.map((r) => r.group))];
  const pct = rows.length ? found / rows.length : 0;
  const R = 26, C = 2 * Math.PI * R;

  const change = (key, v) => {
    setManuallyModifiedFields && setManuallyModifiedFields((prev) => new Set(prev).add(key));
    setPropertyDetails(setPath(propertyDetails, key, v));
  };

  // A plain render function (not a component), so the input keeps focus while typing
  const renderField = (r, compact) => {
    const v = value(r.key);
    const open = editing === r.key || (!v && r.required);
    const state = v ? 'ok' : r.required ? 'miss' : 'empty';
    return (
      <div key={r.key} className={`c3-field ${state} ${compact ? 'compact' : ''} ${open ? 'open' : ''}`}>
        <button type="button" className="c3-fhead" onClick={() => setEditing(editing === r.key ? null : r.key)}>
          <span className="c3-ftext">
            <span className="c3-flabel">{r.label}</span>
            <span className="c3-fval">{v ? (r.num ? fmtRate(v) : v) : r.required ? 'Missing — tap to add' : 'Not in documents'}</span>
          </span>
          <span className="c3-ficon">{v ? <CheckCircle2 size={18} /> : r.required ? <AlertCircle size={18} /> : <Pencil size={15} />}</span>
        </button>
        {open && (
          <input
            autoFocus={editing === r.key}
            inputMode={r.num ? 'numeric' : undefined}
            value={value(r.key)}
            placeholder={r.hint}
            onChange={(e) => change(r.key, r.num ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
            onBlur={() => setEditing(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="c3" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="c3-scroll">
        <div className={`c3-hero ${missingRequired ? 'warn' : 'done'}`}>
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="6" />
            <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset .5s' }} />
            <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor">{found}/{rows.length}</text>
          </svg>
          <div className="c3-hero-text">
            <span className="c3-kicker"><Sparkles size={13} /> Read by Mahe AI</span>
            <b>{missingRequired ? `${missingRequired} required detail${missingRequired > 1 ? 's' : ''} missing` : found === rows.length ? 'All details found' : 'Required details found'}</b>
            <span>{missingRequired ? 'Add them below — the rest is ready.' : 'Check them. Tap any detail to correct it.'}</span>
          </div>
        </div>

        <div className="c3-type"><span>Report type</span><b>{toFieldValue(propertyDetails.propertyType) || 'Not chosen — go back to Step 1'}</b></div>

        {groups.map((g) => {
          const Icon = GROUP_ICON[g] || FileText;
          const gr = rows.filter((r) => r.group === g);
          const ok = gr.filter((r) => value(r.key)).length;
          const compass = g.startsWith('Boundaries');
          return (
            <section key={g} className="c3-card">
              <header className="c3-card-head">
                <span className="c3-gicon"><Icon size={16} /></span>
                <span className="c3-gtitle">{g}</span>
                <span className={`c3-count ${ok === gr.length ? 'full' : ''}`}>{ok}/{gr.length}</span>
              </header>
              <div className={compass ? 'c3-compass' : 'c3-list'}>
                {gr.map((r) => renderField(r, compass))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="c3-foot">
        <button type="button" className="c3-next" onClick={onNext}>
          {missingRequired ? 'Continue to site details' : 'Looks right — site details'} <ChevronRight size={18} />
        </button>
      </div>

      <style>{`
        .c3 { --c3-card: var(--bg-card, #fff); --c3-line: var(--border-color, #e7ebf1); --c3-text: #0f172a; --c3-sub: #64748b; --c3-ok: #16a34a; --c3-warn: #ea580c; --c3-accent: #2563eb; }
        .c3-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 12px; display: flex; flex-direction: column; gap: 12px; }
        .c3-scroll > * { flex-shrink: 0; }
        .c3-hero { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 18px; color: var(--c3-accent);
          background: linear-gradient(135deg, #eef4ff 0%, #f3fbf6 100%); border: 1px solid #dfe8f7; }
        .c3-hero.done { color: var(--c3-ok); }
        .c3-hero.warn { color: var(--c3-warn); background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%); border-color: #fde3c7; }
        .c3-hero svg { flex: none; }
        .c3-hero-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .c3-kicker { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--c3-accent); }
        .c3-hero-text b { font-size: 17px; color: var(--c3-text); letter-spacing: -.2px; }
        .c3-hero-text > span:last-child { font-size: 13px; color: var(--c3-sub); }
        .c3-type { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 14px; background: var(--c3-card); border: 1px solid var(--c3-line); font-size: 13.5px; color: var(--c3-sub); }
        .c3-type b { color: var(--c3-text); text-align: right; }
        .c3-card { background: var(--c3-card); border: 1px solid var(--c3-line); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,.03); }
        .c3-card-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px 10px; }
        .c3-gicon { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: #eef2ff; color: #4f46e5; flex: none; }
        .c3-gtitle { flex: 1; font-size: 14.5px; font-weight: 700; color: var(--c3-text); }
        .c3-count { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: #fff3e6; color: var(--c3-warn); }
        .c3-count.full { background: #e8f8ee; color: var(--c3-ok); }
        .c3-list .c3-field { border-top: 1px solid var(--c3-line); }
        .c3-fhead { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 14px; background: none; border: 0; font: inherit; text-align: left; cursor: pointer; color: inherit; -webkit-tap-highlight-color: transparent; }
        .c3-fhead:active { background: rgba(37,99,235,.05); }
        .c3-ftext { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .c3-flabel { font-size: 12px; color: var(--c3-sub); }
        .c3-fval { font-size: 16px; font-weight: 650; color: var(--c3-text); overflow-wrap: anywhere; line-height: 1.3; }
        .c3-field.miss .c3-fval { color: var(--c3-warn); font-weight: 600; font-size: 14.5px; }
        .c3-field.empty .c3-fval { color: #a0aabb; font-weight: 500; font-size: 14.5px; }
        .c3-ficon { flex: none; display: grid; place-items: center; }
        .c3-field.ok .c3-ficon { color: var(--c3-ok); }
        .c3-field.miss .c3-ficon { color: var(--c3-warn); }
        .c3-field.empty .c3-ficon { color: #a0aabb; }
        .c3-field input { display: block; width: calc(100% - 28px); margin: 0 14px 12px; padding: 11px 12px; border-radius: 10px; border: 1.5px solid #93c5fd; font-size: 16px; outline: none; box-sizing: border-box; background: #fff; color: var(--c3-text); }
        .c3-field.miss input { border-color: #fdba74; background: #fffaf5; }
        .c3-compass { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 2px 10px 12px; }
        .c3-compass .c3-field { border: 1px solid var(--c3-line); border-radius: 12px; background: #fafbfd; }
        .c3-compass .c3-field.miss { border-color: #fed7aa; background: #fffaf5; }
        .c3-compass .c3-fhead { padding: 10px 12px; align-items: flex-start; }
        .c3-compass .c3-fval { font-size: 14.5px; }
        .c3-compass .c3-field.open { grid-column: 1 / -1; }
        .c3-compass .c3-field input { width: calc(100% - 24px); margin: 0 12px 10px; }
        .c3-foot { flex: none; padding: 10px 0 calc(env(safe-area-inset-bottom, 0px) + 4px); background: linear-gradient(to top, var(--bg-app, #f8fafc) 70%, transparent); }
        .c3-next { width: 100%; height: 52px; border: 0; border-radius: 14px; background: linear-gradient(135deg, #1e40af, #2563eb); color: #fff; font: inherit; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; box-shadow: 0 6px 16px rgba(37,99,235,.28); }
        .c3-next:active { transform: scale(.99); }
      `}</style>
    </div>
  );
}
