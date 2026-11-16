import React, { useEffect, useState } from 'react';
import { reportFormatFor } from './BankReportDetails';
import { API_BASE_URL } from '../../../config/api';
import { currentPosition } from '../../../utils/sitePhotos';

/**
 * The market land rate — the one number the land value depends on.
 * Shown on the Site step (not tucked into the bank details) and required before photos.
 * Starts from the guideline (SRO) rate read from the market value certificate when nothing is entered.
 */
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; };

/** Which report field holds the land rate for this property, its unit, and Sq.yd → unit factor */
export function landRateField(propertyType = '') {
  const f = reportFormatFor(propertyType);
  if (f === 'agriculture') return { key: 'ratePerAcre', unit: 'per acre', perSqyd: 4840, required: true };
  if (f === 'apartment') return { key: 'landRatePerSqyd', unit: 'per Sq.yd', perSqyd: 1, required: false };
  if (f === 'industrial') return { key: 'landRatePerSqyd', unit: 'per Sq.yd', perSqyd: 1, required: true };
  return { key: 'marketRatePerCent', unit: 'per cent', perSqyd: 48.4, required: true };
}

/** Guideline rate in the same unit as the land-rate field (0 when unknown) */
export function guidelineIn(pd = {}, field) {
  const rep = pd.report || {};
  if (field.key === 'ratePerAcre' && num(rep.guidelineRatePerAcre)) return Math.round(num(rep.guidelineRatePerAcre));
  const perSqyd = num(rep.guidelineRatePerSqyd) || num(pd.guidelineRate);
  return perSqyd ? Math.round(perSqyd * field.perSqyd) : 0;
}

export function landRateMissing(pd = {}) {
  if (!pd.propertyType) return false;
  const field = landRateField(pd.propertyType);
  return field.required && !num((pd.report || {})[field.key]);
}

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

export default function LandRateCard({ propertyDetails = {}, setPropertyDetails, caseId = '' }) {
  const field = landRateField(propertyDetails.propertyType);
  const rep = propertyDetails.report || {};
  const value = rep[field.key] ?? '';
  const guide = guidelineIn(propertyDetails, field);
  const fromGuide = !!rep.landRateFromGuideline;

  // Start from the guideline rate once, when the engineer has not typed a rate
  useEffect(() => {
    if (!num(value) && guide) {
      setPropertyDetails({ ...propertyDetails, report: { ...rep, [field.key]: String(guide), landRateFromGuideline: true } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.key, guide]);

  // Rates of approved valuations near this property
  const [near, setNear] = useState(null);
  const [showNear, setShowNear] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      let gps = null;
      // Don't keep the engineer waiting for GPS: 4 s, else the server uses the deed / site address
      try { gps = await Promise.race([currentPosition(), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]); } catch { /* no GPS */ }
      try {
        const r = await fetch(`${API_BASE_URL}/api/cases/rate-guide`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, lat: gps?.lat, lng: gps?.lng, propertyType: propertyDetails.propertyType, village: propertyDetails.village }),
        });
        const d = r.ok ? await r.json() : null;
        if (alive) setNear(d && d.count ? d : null);
      } catch { /* offline */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, propertyDetails.propertyType]);
  const nearRate = near ? Math.round(near.medianPerSqyd * field.perSqyd) : 0;
  const useNear = () => setPropertyDetails({ ...propertyDetails, report: { ...rep, [field.key]: String(nearRate), landRateFromGuideline: false, landRateFromNearby: true } });

  const set = (v) => setPropertyDetails({ ...propertyDetails, report: { ...rep, [field.key]: v.replace(/[^\d.]/g, ''), landRateFromGuideline: false, landRateFromNearby: false } });
  const n = num(value);
  const empty = field.required && !n;
  const below = n && guide && n < guide;

  return (
    <div className={`lrc ${empty ? 'need' : ''}`}>
      <label className="lrc-l" htmlFor="lrc-in">
        Market land rate ({field.unit}) {field.required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <div className="lrc-row">
        <span className="lrc-rs">₹</span>
        <input id="lrc-in" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder={guide ? String(guide) : 'e.g. 7,00,000'} />
      </div>
      <div className="lrc-note">
        {empty && 'Needed for the land value — enter the rate you found at the site.'}
        {!empty && n > 0 && <>{inr(n)} {field.unit}{field.perSqyd !== 1 && <> · ≈ {inr(n / field.perSqyd)} per Sq.yd</>}</>}
        {!empty && !n && 'Optional for flats — the land share is usually valued with the flat.'}
      </div>
      {near && (
        <div className="lrc-near">
          <div className="lrc-near-top">
            <span>
              Nearby: <b>{inr(nearRate)} {field.unit}</b>
              <small> · middle of {near.count} approved case{near.count === 1 ? '' : 's'} {near.basis === 'distance' ? `within ${near.radiusKm} km` : `in ${propertyDetails.village || 'this village'}`}</small>
            </span>
            {Math.round(n) !== nearRate && <button type="button" onClick={useNear}>Use</button>}
          </div>
          {near.count > 1 && <div className="lrc-near-range">{near.minPerSqyd !== near.maxPerSqyd ? <>Range {inr(near.minPerSqyd * field.perSqyd)} – {inr(near.maxPerSqyd * field.perSqyd)} {field.unit}</> : 'All at the same rate'}
            {' '}<button type="button" className="lrc-link" onClick={() => setShowNear(!showNear)}>{showNear ? 'Hide' : 'See cases'}</button></div>}
          {showNear && (
            <ul className="lrc-list">
              {near.items.map((it) => (
                <li key={it.fileNumber}><span>{it.fileNumber}{it.area ? ` · ${it.area}` : ''}{it.distanceKm != null ? ` · ${it.distanceKm} km` : ''}</span><b>{inr(it.ratePerSqyd * field.perSqyd)}</b></li>
              ))}
            </ul>
          )}
          {n > 0 && nearRate > 0 && Math.abs(n - nearRate) / nearRate > 0.4 && (
            <div className="lrc-far">Your rate is {Math.round(Math.abs(n - nearRate) / nearRate * 100)}% {n > nearRate ? 'above' : 'below'} nearby cases. Please check.</div>
          )}
        </div>
      )}
      {guide > 0 && (
        <div className={`lrc-guide ${fromGuide ? 'from' : ''}`}>
          {fromGuide
            ? <>Filled from the guideline rate ({inr(guide)} {field.unit}). Change it if the market rate is different.</>
            : below
              ? <>Lower than the guideline rate ({inr(guide)} {field.unit}). Please check.</>
              : <>Guideline rate: {inr(guide)} {field.unit}</>}
        </div>
      )}
      <style>{`
        .lrc { padding: 12px; border-radius: 12px; background: #eff6ff; border: 1px solid #bfdbfe; }
        .lrc.need { background: #fff7ed; border-color: #fdba74; }
        .lrc-l { display: block; font-size: 13px; font-weight: 700; color: var(--primary, #1e3a8a); margin-bottom: 8px; }
        .lrc-row { display: flex; align-items: center; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 10px; }
        .lrc.need .lrc-row { border-color: #fb923c; }
        .lrc-rs { font-weight: 700; color: #475569; margin-right: 6px; }
        .lrc-row input { flex: 1; min-width: 0; border: 0; outline: none; padding: 10px 0; font-size: 16px; font-weight: 700; background: transparent; color: #0f172a; }
        .lrc-note { margin-top: 6px; font-size: 12px; color: #475569; }
        .lrc.need .lrc-note { color: #c2410c; font-weight: 600; }
        .lrc-guide { margin-top: 6px; font-size: 12px; color: #64748b; }
        .lrc-guide.from { color: #1d4ed8; font-weight: 600; }
        .lrc-near { margin-top: 10px; padding: 9px 10px; border-radius: 10px; background: #fff; border: 1px dashed #93c5fd; font-size: 12.5px; color: #0f172a; }
        .lrc-near-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .lrc-near small { color: #64748b; }
        .lrc-near-top button { flex-shrink: 0; border: 0; background: #2563eb; color: #fff; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 999px; cursor: pointer; }
        .lrc-near-range { margin-top: 4px; font-size: 11.5px; color: #64748b; }
        .lrc-link { border: 0; background: none; color: #2563eb; font-weight: 700; font-size: 11.5px; padding: 0; cursor: pointer; }
        .lrc-list { list-style: none; margin: 6px 0 0; padding: 0; }
        .lrc-list li { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #475569; }
        .lrc-far { margin-top: 6px; color: #b45309; font-weight: 700; font-size: 12px; }
        body.dark-theme .lrc-near { background: #2c2c2e; color: #fff; }
        body.dark-theme .lrc { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .lrc-row { background: #2c2c2e; border-color: #3a3a3c; }
        body.dark-theme .lrc-row input { color: #fff; }
      `}</style>
    </div>
  );
}
