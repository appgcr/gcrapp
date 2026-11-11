import React, { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';

/**
 * Extra details the bank's own report format asks for (APGB for now).
 * Saved in propertyDetails.report — each key is a field of the report template
 * (see ValuationBackend/services/reports/apgb.py). Anything left empty uses the
 * valuer's standard wording, so nothing here is required.
 */

export const isApgb = (bank = '') => /grameena|apgb|andhra\s*prag/i.test(bank);

export function reportFormatFor(propertyType = '') {
  const t = propertyType.toLowerCase();
  if (t.includes('industr') || t.includes('shed') || t.includes('factory')) return 'industrial';
  if (t.includes('apartment') || t.includes('flat')) return 'apartment';
  if (t.includes('agri')) return 'agriculture';
  if (t.includes('site') || t.includes('plot') || t.includes('land')) return 'open_site';
  return 'house';
}

const SIDES = ['East', 'West', 'North', 'South'];
const dims = (prefix, label, hint) => SIDES.map(s => ({ key: `${prefix}${s}`, label: `${label} – ${s}`, hint }));

const LOCATION = {
  title: 'Location wording',
  fields: [
    { key: 'village', label: 'Village', hint: 'Chemmumiahpeta' },
    { key: 'wardNo', label: 'Ward No', hint: '44' },
    { key: 'landmark', label: 'Area / landmark', hint: 'Prakruthi Nagar' },
    { key: 'localBodyName', label: 'Municipality / Panchayat', hint: 'Kadapa Municipal Corporation' },
    { key: 'nearBy', label: 'Near / opposite', hint: 'Opp Toyato Show Room' },
    { key: 'ownerPhone', label: 'Owner cell no', hint: '9912768181' },
  ],
};

const GROUPS = {
  house: [
    LOCATION,
    {
      title: 'Land',
      fields: [
        { key: 'extentDeedRaw', label: 'Extent as per deed', hint: '3.08 Cents or 149 Sqyds' },
        { key: 'netExtentPlanRaw', label: 'Net extent as per plan', hint: '2.83 Cents' },
        { key: 'marketRatePerCent', label: 'Market rate per cent (Rs)', hint: '14,25,000', num: true },
        { key: 'guidelineRatePerSqyd', label: 'Guideline rate per Sqyd (Rs)', hint: '8,500', num: true },
        ...dims('dimDeed', 'Size as per deed', '33.33 Links (or) 6.70 m'),
        ...dims('dimActual', 'Size actual', 'same as deed if empty'),
      ],
    },
    {
      title: 'Building',
      fields: [
        { key: 'constructionRate', label: 'Construction rate per Sqft (Rs)', hint: '2,500', num: true },
        { key: 'yearOfConstruction', label: 'Year of construction', hint: '2021' },
        { key: 'carpetArea', label: 'Carpet area', hint: '620 Sqft' },
        { key: 'floorHeight', label: 'Floor height', hint: '10’' },
        { key: 'totalLife', label: 'Total life (years)', hint: '60', num: true },
        { key: 'bookValue', label: 'Book value (Rs)', hint: '5,77,000', num: true },
      ],
    },
    {
      title: 'Extra items, amenities & services (Rs)',
      fields: [
        { key: 'ex_portico', label: 'Portico', num: true }, { key: 'ex_frontDoor', label: 'Ornamental front door', num: true },
        { key: 'ex_sitOut', label: 'Sit out / verandah', num: true }, { key: 'ex_ohTank', label: 'Overhead water tank', num: true },
        { key: 'ex_gates', label: 'Steel / collapsible gates', num: true }, { key: 'am_wardrobes', label: 'Wardrobes', num: true },
        { key: 'am_glazedTiles', label: 'Glazed tiles', num: true }, { key: 'am_marble', label: 'Marble / ceramic flooring', num: true },
        { key: 'am_interior', label: 'Interior decorations', num: true }, { key: 'am_falseCeiling', label: 'False ceiling', num: true },
        { key: 'am_parking', label: 'Car parking', num: true }, { key: 'mi_sump', label: 'Water tank / sump', num: true },
        { key: 'mi_trees', label: 'Trees, gardening', num: true }, { key: 'sv_water', label: 'Water supply', num: true },
        { key: 'sv_drainage', label: 'Drainage', num: true }, { key: 'sv_compoundWall', label: 'Compound wall', num: true },
        { key: 'sv_pavement', label: 'Pavement', num: true },
      ],
    },
  ],
  apartment: [
    {
      title: 'Apartment',
      fields: [
        { key: 'aptName', label: 'Apartment name', hint: 'Sri Satya Sai Apartment' },
        { key: 'floorsDesc', label: 'Floors (front page)', hint: 'Stilt, Ground Floor + 4 Upper Floors' },
        { key: 'floorsShort', label: 'Floors (short)', hint: 'Stilt + GF + 4 Upper Floors' },
        { key: 'dwellingUnits', label: 'Number of flats', hint: '10', num: true },
        { key: 'partnerRelation', label: 'Managing partner S/o', hint: 'S/o Sri P. Sathar Khan' },
        { key: 'buildingStatus', label: 'Building status', options: ['Finished', 'Semi Finished'] },
        { key: 'yearOfConstruction', label: 'Year of construction', hint: 'Under Construction' },
        { key: 'deedLabel', label: 'Deed type', hint: 'Sale Deed No / G.P.A. Deed No' },
        { key: 'deedExecutant', label: 'Sale deed executed by', hint: 'Managing Partner : A. Yugandhar Reddy' },
        { key: 'deedExecutantRelation', label: 'Executant S/o', hint: 'S/o A. Venkata Subba Reddy' },
      ],
    },
    LOCATION,
    {
      title: 'Land share (UDS)',
      fields: [
        { key: 'parentExtentDeedRaw', label: 'Whole site – as per deed', hint: '9.18 Cents or 4000 Sqft' },
        { key: 'parentExtentPlanRaw', label: 'Whole site – as per plan', hint: '8.29 Cents' },
        { key: 'udsDeedRaw', label: 'Flat’s share – as per deed', hint: '0.91 Cents' },
        { key: 'udsPlanRaw', label: 'Flat’s share – as per plan', hint: '0.82 Cents' },
        { key: 'landRatePerSqyd', label: 'Land rate per Sqyd (Rs)', hint: '47,520', num: true },
        ...dims('dimDeed', 'Site size', '50’0” (or) 15.25 m'),
      ],
    },
    {
      title: 'Flat',
      fields: [
        { key: 'plinthArea', label: 'Plinth area', hint: '1475 Sqft' },
        { key: 'carpetArea', label: 'Carpet area', hint: '85% of plinth if empty' },
        { key: 'constructionRate', label: 'Construction rate per Sqft (Rs)', hint: '2,250', num: true },
        { key: 'carParkingValue', label: 'Car parking value (Rs)', hint: '1,00,000', num: true },
        { key: 'fbNorth', label: 'Flat boundary – North', hint: 'Open to Sky' },
        { key: 'fbSouth', label: 'Flat boundary – South', hint: 'Open to Sky' },
        { key: 'fbEast', label: 'Flat boundary – East', hint: 'Corridor & Flat No 401' },
        { key: 'fbWest', label: 'Flat boundary – West', hint: 'Open to Sky' },
        { key: 'taxPaidName', label: 'House tax paid in the name of', hint: 'owner if empty' },
        { key: 'taxAmount', label: 'House tax amount (Rs)', hint: '3,807', num: true },
      ],
    },
  ],
  open_site: [
    LOCATION,
    {
      title: 'Site',
      fields: [
        { key: 'siteType', label: 'Report title', hint: 'Residential Vacant Site' },
        { key: 'pinCode', label: 'Pin code', hint: '516003', num: true },
        { key: 'extentDeedRaw', label: 'Extent as per deed', hint: '115.69 Sqyds or 2.39 Cents' },
        { key: 'netExtentPlanRaw', label: 'Net extent as per plan', hint: '2.01 Cents' },
        { key: 'marketRatePerCent', label: 'Market rate per cent (Rs)', hint: '7,00,000', num: true },
        { key: 'guidelineRatePerSqyd', label: 'Guideline rate per Sqyd (Rs)', hint: '6,500', num: true },
        ...dims('dimDeed', 'Size as per deed', '41.68 Links (or) 8.39 M'),
        ...dims('dimActual', 'Size actual', 'same as deed if empty'),
      ],
    },
  ],
  agriculture: [
    LOCATION,
    {
      title: 'Land',
      fields: [
        { key: 'landType', label: 'Report title', hint: 'Agriculture Land' },
        { key: 'khathaNo', label: 'Khatha No', hint: '2267' },
        { key: 'extentDeedRaw', label: 'Extent as per deed', hint: 'Ac 1.20 Cents' },
        { key: 'netExtentPlanRaw', label: 'Extent actual', hint: 'same as deed if empty' },
        { key: 'ratePerAcre', label: 'Market rate per acre (Rs)', hint: '17,00,000', num: true },
        { key: 'guidelineRatePerAcre', label: 'Guideline rate per acre (Rs)', hint: '52,60,000', num: true },
        { key: 'bookValue', label: 'Book value (Rs)', hint: '66,000', num: true },
      ],
    },
  ],
  industrial: [
    LOCATION,
    {
      title: 'Industrial site',
      fields: [
        { key: 'shedNo', label: 'Shed No', hint: 'S-5' },
        { key: 'pinCode', label: 'Pin code', hint: '516002', num: true },
        { key: 'extentDeedRaw', label: 'Extent as per deed', hint: '3341.58 Sqyds' },
        { key: 'netExtentPlanRaw', label: 'Net extent as per plan', hint: 'same as deed if empty' },
        { key: 'landRatePerSqyd', label: 'Market rate per Sqyd (Rs)', hint: '11,500', num: true },
        { key: 'guidelineRatePerSqyd', label: 'Guideline rate per Sqyd (Rs)', hint: '10,800', num: true },
        { key: 'planAuthority', label: 'Plan issued by', hint: 'Issued By Inspectors Of Industries, Kadapa' },
        ...dims('dimDeed', 'Size as per deed', '54.30 M'),
      ],
    },
    {
      title: 'Shed / building',
      fields: [
        { key: 'shedUse', label: 'Use of the shed', hint: 'Mech. Hall' },
        { key: 'plinthPlanRaw', label: 'Plinth area as per plan', hint: '6242 Sqft' },
        { key: 'constructionRate', label: 'Construction rate per Sqft (Rs)', hint: '400', num: true },
        { key: 'depreciationPerYear', label: 'Depreciation % per year', hint: '1.5', num: true },
        { key: 'yearOfConstruction', label: 'Year of construction', hint: '2014' },
        { key: 'floorHeight', label: 'Roof height', hint: '20’' },
        { key: 'sv_compoundWall', label: 'Compound wall (Rs)', hint: '4,50,000', num: true },
        { key: 'sv_water', label: 'Water supply (Rs)', num: true }, { key: 'sv_drainage', label: 'Drainage (Rs)', num: true },
      ],
    },
  ],
};

const WORDING = {
  title: 'Site characteristics (optional wording)',
  fields: [
    { key: 'roadType', label: 'Type of road', hint: 'CC Road' },
    { key: 'roadWidth', label: 'Road width', hint: '20’0” Wide Road' },
    { key: 'landShape', label: 'Shape of land', hint: 'Rectangular' },
    { key: 'civicAmenities', label: 'Civic amenities', hint: 'At Walkable Distance' },
    { key: 'advantage1', label: 'Advantages of the site', hint: 'Medium demand locality' },
  ],
};

const FORMAT_NAMES = { house: 'Independent House', apartment: 'Apartment', open_site: 'Open Site', agriculture: 'Open Agriculture Land', industrial: 'Industrial Unit' };

const S = {
  card: { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', flexShrink: 0 },
  head: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'linear-gradient(180deg,#f8fbff,#eef5ff)', borderBottom: '1px solid #e5e7eb' },
  groupBtn: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', fontSize: 13, fontWeight: 600, color: '#0f172a', cursor: 'pointer', textAlign: 'left' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '4px 14px 14px' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 },
  input: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' },
};

export default function BankReportDetails({ bankName, propertyDetails = {}, setPropertyDetails }) {
  const fmt = reportFormatFor(propertyDetails.propertyType || '');
  const groups = [...(GROUPS[fmt] || []), WORDING];
  const [open, setOpen] = useState(() => new Set([groups[0]?.title]));
  const report = propertyDetails.report || {};
  const filled = Object.values(report).filter(v => v !== '' && v != null).length;

  const set = (key, value) => setPropertyDetails({ ...propertyDetails, report: { ...report, [key]: value } });
  const toggle = title => setOpen(prev => {
    const next = new Set(prev);
    next.has(title) ? next.delete(title) : next.add(title);
    return next;
  });

  return (
    <div style={S.card} data-testid="bank-report-details">
      <div style={S.head}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#2563eb', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <FileText size={17} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{bankName || 'Bank'} report details</div>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>
            {FORMAT_NAMES[fmt]} format · {filled ? `${filled} filled` : 'empty fields use the standard wording'}
          </div>
        </div>
      </div>
      {groups.map(g => {
        const isOpen = open.has(g.title);
        return (
          <div key={g.title}>
            <button type="button" style={S.groupBtn} onClick={() => toggle(g.title)} aria-expanded={isOpen}>
              <span>{g.title}</span>
              <ChevronDown size={16} color="#94a3b8" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {isOpen && (
              <div style={S.grid}>
                {g.fields.map(f => (
                  <div key={f.key} style={{ minWidth: 0 }}>
                    <label style={S.label} htmlFor={`rep-${f.key}`}>{f.label}</label>
                    {f.options ? (
                      <select id={`rep-${f.key}`} style={S.input} value={report[f.key] || ''} onChange={e => set(f.key, e.target.value)}>
                        <option value="">Standard</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        id={`rep-${f.key}`}
                        style={S.input}
                        inputMode={f.num ? 'decimal' : undefined}
                        value={report[f.key] || ''}
                        placeholder={!f.hint ? '' : /^[a-z]/.test(f.hint) ? f.hint : `e.g. ${f.hint}`}
                        onChange={e => set(f.key, f.num ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
