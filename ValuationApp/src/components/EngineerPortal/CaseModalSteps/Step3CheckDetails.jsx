import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Pencil, ChevronRight } from 'lucide-react';
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

export default function Step3CheckDetails({ propertyDetails = {}, setPropertyDetails, setManuallyModifiedFields, onNext }) {
  const [editing, setEditing] = useState(null);
  const rows = fieldsFor(toFieldValue(propertyDetails.propertyType) || '');
  const value = (k) => String(toFieldValue(getPath(propertyDetails, k)) ?? '').trim();
  const found = rows.filter((r) => value(r.key)).length;
  const missingRequired = rows.filter((r) => r.required && !value(r.key)).length;
  const groups = [...new Set(rows.map((r) => r.group))];

  const change = (key, v) => {
    setManuallyModifiedFields && setManuallyModifiedFields((prev) => new Set(prev).add(key));
    setPropertyDetails(setPath(propertyDetails, key, v));
  };

  return (
    <div className="cd3" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: 16 }}>
      <div className="cd3-summary">
        <div className="cd3-big">{found} <span>of {rows.length}</span></div>
        <div className="cd3-sum-text">
          <b>Details read by Mahe AI</b>
          <span>{missingRequired ? `${missingRequired} required detail${missingRequired > 1 ? 's' : ''} missing — add below` : 'Check them and tap any row to correct it.'}</span>
        </div>
      </div>

      <div className="cd3-type">
        <span>Report type</span><b>{toFieldValue(propertyDetails.propertyType) || 'Not chosen — go back to Step 1'}</b>
      </div>

      {groups.map((g) => (
        <div key={g} className="cd3-group">
          <div className="cd3-gtitle">{g}</div>
          <div className="cd3-card">
            {rows.filter((r) => r.group === g).map((r) => {
              const v = value(r.key);
              const open = editing === r.key || (!v && r.required);
              return (
                <div key={r.key} className={`cd3-row ${!v ? (r.required ? 'miss' : 'empty') : ''}`}>
                  <button type="button" className="cd3-head" onClick={() => setEditing(editing === r.key ? null : r.key)}>
                    {v ? <CheckCircle2 size={17} className="ok" /> : <AlertCircle size={17} className={r.required ? 'warn' : 'muted'} />}
                    <span className="cd3-label">{r.label}{r.required && <i>*</i>}</span>
                    <span className="cd3-val">{v || (r.required ? 'Missing' : 'Not found')}</span>
                    <Pencil size={14} className="cd3-pen" />
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
            })}
          </div>
        </div>
      ))}

      <button type="button" className="btn-primary" onClick={onNext} style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        Looks right — next: site details <ChevronRight size={18} />
      </button>

      <style>{`
        .cd3-summary { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #eff6ff, #f0fdf4); border: 1px solid #dbeafe; }
        .cd3-big { font-size: 30px; font-weight: 800; color: #1d4ed8; line-height: 1; white-space: nowrap; }
        .cd3-big span { font-size: 15px; font-weight: 600; color: #64748b; }
        .cd3-sum-text { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: #475569; }
        .cd3-sum-text b { font-size: 15px; color: #0f172a; }
        .cd3-type { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: var(--bg-card, #fff); border: 1px solid var(--border-color, #e2e8f0); font-size: 13.5px; color: #64748b; }
        .cd3-type b { color: #0f172a; text-align: right; }
        .cd3-group { margin-top: 14px; }
        .cd3-gtitle { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #64748b; margin: 0 4px 6px; }
        .cd3-card { background: var(--bg-card, #fff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; overflow: hidden; }
        .cd3-row + .cd3-row { border-top: 1px solid var(--border-color, #eef2f7); }
        .cd3-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: none; border: 0; font: inherit; text-align: left; cursor: pointer; color: inherit; }
        .cd3-head .ok { color: #16a34a; flex: none; }
        .cd3-head .warn { color: #ea580c; flex: none; }
        .cd3-head .muted { color: #94a3b8; flex: none; }
        .cd3-label { flex: 1; min-width: 0; font-size: 13.5px; color: #475569; }
        .cd3-label i { color: #ef4444; font-style: normal; margin-left: 2px; }
        .cd3-val { max-width: 52%; font-size: 14px; font-weight: 600; color: #0f172a; text-align: right; overflow-wrap: anywhere; }
        .cd3-row.miss .cd3-val { color: #ea580c; }
        .cd3-row.empty .cd3-val { color: #94a3b8; font-weight: 500; }
        .cd3-pen { color: #94a3b8; flex: none; }
        .cd3-row input { display: block; width: calc(100% - 28px); margin: 0 14px 12px; padding: 10px 12px; border-radius: 9px; border: 1.5px solid #93c5fd; font-size: 15px; outline: none; box-sizing: border-box; background: #fff; color: #0f172a; }
        .cd3-row.miss input { border-color: #fdba74; }
      `}</style>
    </div>
  );
}
