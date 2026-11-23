// Spoken details (office-sheet shaped, from /api/assist/voice-sheet) → the case form's own fields.
// Pure: returns what to change; the case form applies it. Only what was said is changed.
import { landRateField } from './LandRateCard';

const digits = (v) => String(v ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SIDES = ['north', 'south', 'east', 'west'];
const SIDE_LABEL = (s) => s[0].toUpperCase() + s.slice(1);

// Spoken choice → the closest option in the app's list ("RCC Framed structure" → "R.C.C. Framed")
function pick(value, list = []) {
  const v = norm(value);
  if (!v) return '';
  const opts = (list || []).map((o) => (typeof o === 'string' ? o : o?.value || o?.label || '')).filter(Boolean);
  const exact = opts.find((o) => norm(o) === v);
  if (exact) return exact;
  const words = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !['structure', 'road', 'flooring', 'type'].includes(w));
  const vw = words(value);
  let best = ''; let score = 0;
  for (const o of opts) {
    const ow = words(o);
    const hit = vw.filter((w) => ow.some((x) => x.startsWith(w) || w.startsWith(x))).length;
    const sc = hit / Math.max(1, Math.max(vw.length, ow.length));
    if (hit && sc > score) { best = o; score = sc; }
  }
  return score >= 0.5 ? best : '';
}

// "GF 1200 sft, FF 1100" → site value floors
function floorsFrom(text) {
  const t = String(text || '');
  const area = (re) => { const m = re.exec(t); return m ? digits(m[1]) : ''; };
  const rows = [
    ['gf', 'Ground Floor (GF)', area(/\b(?:G\.?\s*F\.?|ground(?:\s*floor)?)\b\D{0,12}?([\d,.]+)/i)],
    ['ff', 'First Floor (FF)', area(/\b(?:F\.?\s*F\.?|first(?:\s*floor)?)\b\D{0,12}?([\d,.]+)/i)],
    ['sf', 'Second Floor (SF)', area(/\b(?:S\.?\s*F\.?|second(?:\s*floor)?)\b\D{0,12}?([\d,.]+)/i)],
  ].filter(([, , v]) => v).map(([id, label, value]) => ({ id, label, value }));
  return rows;
}

/**
 * f: spoken fields; ctx: { propertyDetails, lockedName, lists: { roadTypes, structureTypes, flooringTypes } }
 * → { name, fatherName, patch(pd) → pd, filled: [{ key, label, value }], skipped: [label] }
 */
export function voiceToCase(f = {}, ctx = {}) {
  const pd0 = ctx.propertyDetails || {};
  const filled = [];
  const skipped = [];
  const sets = []; // [path, value]
  const put = (path, value, label) => { if (String(value ?? '').trim()) { sets.push([path, String(value).trim()]); filled.push({ key: path, label, value: String(value).trim() }); } };
  const purchase = f.dealType === 'Purchase';
  let name = ''; let fatherName = '';

  // Owner (on a purchase the report's owner is the seller; the buyer is the applicant)
  if (f.ownerName) {
    if (ctx.lockedName && !purchase) skipped.push('Owner name (set by your admin)');
    else { name = f.ownerName; filled.push({ key: 'clientName', label: 'Owner name', value: f.ownerName }); }
  }
  if (f.ownerRelation) { fatherName = f.ownerRelation; filled.push({ key: 'clientFatherName', label: 'Owner S/o · W/o', value: f.ownerRelation }); }
  put('report.ownerAddress', f.ownerAddress, 'Owner address');
  if (purchase || f.applicantName) {
    put('report.applicantName', f.applicantName, 'Applicant name');
    put('report.applicantRel', f.applicantRelation, 'Applicant S/o · W/o');
    put('report.applicantAddr', f.applicantAddress, 'Applicant address');
  }
  if (f.dealType) put('dealType', f.dealType, 'Mortgage / Purchase');

  // Documents
  put('deedNo', f.deedNo, 'Deed number');
  put('deedYear', f.deedDate, 'Deed date');
  put('surveyNo', f.surveyNo, 'Survey number');
  put('plotNo', f.plotNo, 'Plot number');
  put('doorNo', f.doorNo, 'Door number');
  put('report.wardNo', f.wardNo, 'Ward number');
  put('assessmentNo', f.assessmentNo, 'Assessment number');
  put('approvalPlanNo', f.baNumber, 'Approval number');
  put('approvalPlanDate', f.baDate, 'Approval date');
  put('netExtent', f.extentDocument, 'Extent (document)');
  put('report.extentDeedRaw', f.extentDocument, 'Extent (deed)'); filled.pop(); // same value, listed once
  put('report.netExtentPlanRaw', f.netExtentPlan || f.extentPlan, 'Extent (plan)');
  put('report.roadAffected', f.roadAffectedArea, 'Road affected area');
  put('report.taxPaidName', f.taxName, 'Tax in the name of');
  if (f.taxAmount) put('report.taxAmount', digits(f.taxAmount), 'Tax amount');
  if (f.guidelineRate) put('report.guidelineRatePerSqyd', digits(f.guidelineRate), 'Guideline rate per Sq.yd');

  // Boundaries and sizes: spoken at the site = as per documents and as found (unless already different)
  SIDES.forEach((s) => {
    const b = f.boundaries?.[s];
    if (b) {
      put(`boundariesDoc.${s}`, b, `Boundary ${s} (documents)`);
      if (!String(pd0.boundariesActual?.[s] || '').trim()) { sets.push([`boundariesActual.${s}`, b]); }
      filled[filled.length - 1].label = `Boundary ${SIDE_LABEL(s)}`;
    }
    const m = f.measurements?.[s];
    if (m && digits(m)) {
      sets.push([`dimensionsDoc.${s}`, digits(m)]);
      put(`dimensionsActual.${s}`, digits(m), `Measurement ${SIDE_LABEL(s)}`);
    }
  });
  const anyM = SIDES.map((s) => f.measurements?.[s]).filter(Boolean).join(' ');
  if (anyM) sets.push(['dimensionUnit', /\bm(et(er|re)s?)?\b/i.test(anyM) ? 'Metres' : /link/i.test(anyM) ? 'Links' : 'Feet']);

  // Site
  if (f.roadWidth && digits(f.roadWidth)) put('roadWidth', digits(f.roadWidth), 'Road width (ft)');
  if (f.buildingAge && digits(f.buildingAge)) put('buildingAge', digits(f.buildingAge), 'Age (years)');
  const lists = ctx.lists || {};
  for (const [k, label, list] of [['roadType', 'Road type', lists.roadTypes], ['structureType', 'Structure', lists.structureTypes], ['flooringType', 'Flooring', lists.flooringTypes]]) {
    if (!f[k]) continue;
    const v = pick(f[k], list) || f[k];
    put(k, v, label);
  }
  if (f.propertyType) {
    if (String(pd0.propertyType || '').trim()) { if (norm(pd0.propertyType) !== norm(f.propertyType)) skipped.push(`Property type "${f.propertyType}" (change it in Step 1)`); }
    else put('propertyType', f.propertyType, 'Property type');
  }
  if (f.floorsArea) {
    const rows = floorsFrom(f.floorsArea);
    if (rows.length) {
      sets.push(['siteValue', { plinthArea: rows[0].value, floors: rows }]);
      filled.push({ key: 'siteValue', label: 'Floor areas', value: rows.map((r) => `${r.id.toUpperCase()} ${r.value}`).join(', ') });
    }
  }
  if (f.constructionRate && digits(f.constructionRate)) {
    sets.push(['constructionRate', digits(f.constructionRate)]);
    put('report.constructionRate', digits(f.constructionRate), 'Construction rate per sqft');
  }
  if (f.marketRatePerCent && Number(digits(f.marketRatePerCent)) > 0) {
    const field = landRateField(pd0.propertyType || f.propertyType || '');
    const perSqyd = Number(digits(f.marketRatePerCent)) / 48.4;
    sets.push(['report.landRateFromGuideline', false]);
    put(`report.${field.key}`, String(Math.round(perSqyd * field.perSqyd)), `Land rate ${field.unit}`);
  }

  // Said but not kept on the case form (set automatically elsewhere)
  if (f.engineerNames) skipped.push('Engineer names (taken from the assigned engineer)');
  if (f.inspectionDate) skipped.push('Inspection date (taken from the assignment)');
  if (f.bank) skipped.push('Bank (chosen in Step 1)');
  if (f.address) skipped.push('Property address (taken from the documents)');
  if (f.comments || f.extras) skipped.push('Comments / extras');

  const setPath = (obj, path, value) => {
    const [h, ...rest] = path.split('.');
    if (!rest.length) return { ...obj, [h]: value };
    return { ...obj, [h]: setPath(obj?.[h] || {}, rest.join('.'), value) };
  };
  const patch = (pd) => sets.reduce((acc, [p, v]) => setPath(acc, p, v), pd || {});
  return { name, fatherName, patch, filled, skipped, paths: sets.map(([p]) => p) };
}
