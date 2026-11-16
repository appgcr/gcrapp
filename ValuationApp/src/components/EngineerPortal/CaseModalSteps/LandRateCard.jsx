import React, { useEffect } from 'react';
import { reportFormatFor } from './BankReportDetails';

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

export default function LandRateCard({ propertyDetails = {}, setPropertyDetails }) {
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

  const set = (v) => setPropertyDetails({ ...propertyDetails, report: { ...rep, [field.key]: v.replace(/[^\d.]/g, ''), landRateFromGuideline: false } });
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
        body.dark-theme .lrc { background: #1c1c1e; border-color: #3a3a3c; }
        body.dark-theme .lrc-row { background: #2c2c2e; border-color: #3a3a3c; }
        body.dark-theme .lrc-row input { color: #fff; }
      `}</style>
    </div>
  );
}
