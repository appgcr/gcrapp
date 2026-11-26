// Checks before a valuation is submitted: things a reviewing admin would send back.
// Each check is a warning — the engineer can still submit, and the admin sees the same list.

const { parseExtentToSqYards } = require('./valuationCalculator');
const { nearbyRates, caseSpot } = require('./rateGuide');

const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0]); return Number.isFinite(n) && n > 0 ? n : 0; };
const pct = (a, b) => Math.round((Math.abs(a - b) / b) * 100);
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const isFarm = (t = '') => /agri/i.test(t);
const isFlat = (t = '') => /apart|flat/i.test(t);
const isBuilt = (t = '') => /house|apart|flat|building|commercial|industr|shed/i.test(t);

function sqyd(text) {
  try { const v = parseExtentToSqYards(String(text || '')); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
}

// Sides → area in Sq.yd (average of opposite sides)
function areaFromSides(d = {}, unit = 'Feet') {
  const ns = (num(d.north) + num(d.south)) / ((num(d.north) && num(d.south)) ? 2 : 1);
  const ew = (num(d.east) + num(d.west)) / ((num(d.east) && num(d.west)) ? 2 : 1);
  if (!ns || !ew) return 0;
  const u = String(unit || 'Feet').toLowerCase();
  const toFt = u.startsWith('m') ? 3.28084 : u.startsWith('l') ? 0.66 : 1;
  return (ns * toFt * ew * toFt) / 9;
}

const STOP = new Set(['property', 'of', 'site', 'plot', 'house', 'land', 'belongs', 'belonging', 'to', 'sri', 'smt', 'sy', 'no', 'and', 'the', 'ft', 'feet', 'wide', 'mtrs', 'width', 'by', 'in', 'side', 'others', 'other', 'vacant', 'open']);
const words = (t) => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
function similar(a, b) {
  const A = words(a); const B = words(b);
  if (!A.size || !B.size) return true;
  let hit = 0; A.forEach((w) => { if (B.has(w)) hit++; });
  // "road" vs "30 ft road": any shared word is enough
  return hit > 0;
}

/**
 * @param draft { clientName, propertyDetails, siteImages?: number, caseId?, gps? }
 * → { at, checks: [{ id, level: 'warn' | 'info', title, detail, step }] }
 */
async function runPreCheck(draft = {}, { user = null, caseDoc = null } = {}) {
  const pd = draft.propertyDetails || {};
  const rep = pd.report || {};
  const t = pd.propertyType || '';
  const checks = [];
  const add = (id, level, title, detail, step) => checks.push({ id, level, title, detail, step });

  // 1. Extent: deed vs plan
  const deedYd = sqyd(rep.extentDeedRaw) || sqyd(pd.netExtent);
  const planYd = sqyd(rep.netExtentPlanRaw);
  if (deedYd && planYd && pct(planYd, deedYd) > 10) {
    add('extent_plan', 'warn', 'Extent: deed and plan differ',
      `Deed ${Math.round(deedYd)} Sq.yd, plan ${Math.round(planYd)} Sq.yd (${pct(planYd, deedYd)}% apart). Mention the reason in the report or correct the extent.`, 'check');
  }

  // 2. Measured sides vs deed extent (not for flats / farm land)
  if (!isFlat(t) && !isFarm(t) && deedYd) {
    const actual = areaFromSides(pd.dimensionsActual, pd.dimensionUnit);
    if (actual && pct(actual, deedYd) > 15) {
      add('dims_area', 'warn', 'Measured site does not match the deed',
        `Your measurements give about ${Math.round(actual)} Sq.yd; the deed says ${Math.round(deedYd)} Sq.yd (${pct(actual, deedYd)}% apart). Check the measurements and unit (${pd.dimensionUnit || 'Feet'}).`, 'site');
    }
  }

  // 3–4. Land rate vs guideline and nearby approved cases
  const perSqyd = num(rep.landRatePerSqyd) || (num(rep.marketRatePerCent) ? num(rep.marketRatePerCent) / 48.4 : 0)
    || (num(rep.ratePerAcre) ? num(rep.ratePerAcre) / 4840 : 0) || num(pd.landRate);
  const guide = num(rep.guidelineRatePerSqyd) || num(pd.guidelineRate);
  const per = isFarm(t) ? { f: 4840, u: 'per acre' } : isFlat(t) ? { f: 1, u: 'per Sq.yd' } : { f: 48.4, u: 'per cent' };
  if (perSqyd && guide && perSqyd < guide * 0.98) {
    add('rate_guideline', 'warn', 'Land rate is below the guideline rate',
      `Market ${inr(perSqyd * per.f)} vs guideline ${inr(guide * per.f)} ${per.u}. Banks usually expect the market rate at or above the guideline.`, 'site');
  }
  if (perSqyd && !isFlat(t)) {
    try {
      const at = await caseSpot(caseDoc, draft.gps);
      const near = await nearbyRates({ at, village: pd.village || '', propertyType: t, excludeId: caseDoc ? caseDoc.id : '', branchId: user && user.role !== 'SUPER_ADMIN' ? (user.branchId || null) : null });
      if (near.count >= 2 && pct(perSqyd, near.medianPerSqyd) > 40) {
        add('rate_nearby', 'warn', `Land rate is ${pct(perSqyd, near.medianPerSqyd)}% ${perSqyd > near.medianPerSqyd ? 'above' : 'below'} nearby cases`,
          `Yours ${inr(perSqyd * per.f)} ${per.u}; ${near.count} approved cases ${near.basis === 'distance' ? `within ${near.radiusKm} km` : 'in this village'} average ${inr(near.medianPerSqyd * per.f)}.`, 'site');
      }
    } catch { /* guide unavailable: skip */ }
  }

  // 5. Building age vs permit year
  if (isBuilt(t)) {
    const age = num(pd.buildingAge);
    const permitYear = Number((/(19|20)\d{2}/.exec(String(pd.approvalPlanDate || '')) || [])[0]);
    const thisYear = new Date().getFullYear();
    if (age && permitYear && age > thisYear - permitYear + 2) {
      add('age_permit', 'warn', 'Building looks older than its permit',
        `Age ${age} years means built about ${thisYear - age}, but the permit is from ${permitYear}. Check the age or the permit.`, 'site');
    }
    // 6. Built area vs approved plan
    const plan = pd.planAreas || null;
    const planPlinth = plan ? num(plan.plinthArea) : 0;
    const built = num(pd.siteValue && pd.siteValue.plinthArea);
    if (planPlinth && built && built > planPlinth * 1.1) {
      add('plinth_plan', 'warn', 'Built area is more than the approved plan',
        `Plinth ${Math.round(built)} Sq.ft vs ${Math.round(planPlinth)} Sq.ft approved (${pct(built, planPlinth)}% more). Note the deviation in the report.`, 'site');
    }
  }

  // 7. Boundaries: documents vs site
  const bd = pd.boundariesDoc || {}; const ba = pd.boundariesActual || {};
  const off = ['north', 'south', 'east', 'west'].filter((d) => bd[d] && ba[d] && !similar(bd[d], ba[d]));
  if (off.length) {
    add('boundaries', 'info', `Boundaries differ on ${off.length} side${off.length > 1 ? 's' : ''}`,
      off.map((d) => `${d[0].toUpperCase()}${d.slice(1)}: deed "${bd[d]}", site "${ba[d]}"`).join(' · ') + '. Fine if the neighbour changed; otherwise correct it.', 'site');
  }

  // 8. Photos
  const photos = Number(draft.siteImages || 0);
  if (draft.siteImages != null && photos < 4) {
    add('photos', 'warn', 'Few site photos', `${photos} photo${photos === 1 ? '' : 's'}. Banks expect at least front, road, inside and surroundings (4+).`, 'photos');
  }

  // 9. Same property valued before (same survey no + same door / plot no, or same survey no in the same village) —
  // a second valuation of one property, often for another bank, is a common fraud pattern
  try {
    const dups = await sameProperty(pd, caseDoc && caseDoc.id);
    if (dups.length) {
      const myBank = draft.bankName || (caseDoc && caseDoc.bankName) || '';
      const otherBank = dups.some((d) => d.bankName && myBank && d.bankName !== myBank);
      add('same_property', 'warn', otherBank ? 'This property was valued before for another bank' : 'This property was valued before',
        dups.slice(0, 3).map((d) => `${d.fileNumber || `#${d.id}`} · ${d.bankName || 'no bank'} · ${d.clientName || ''} · ${d.when}${d.value ? ` · value ${inr(d.value)}` : ''}${d.engineer && !/^unknown/i.test(d.engineer) ? ` · ${d.engineer}` : ''}`).join('\n')
        + `\nCheck it is the same owner and the property was not already given as security. Tell the admin if anything looks wrong.`, 'details');
    }
  } catch (e) { /* the check is a help; never blocks */ }

  return { at: new Date(), checks };
}

// Survey / door / plot numbers in one form: "Sy.No. 123/4A" → "123/4a", "D.No: 54/108-7-1" → "54/108-7-1"
const normNo = (v) => String(v || '').toLowerCase().replace(/\b(sy|s|survey|d|door|plot|p|r\.?s|no|nos|number)\b\.?/g, ' ').replace(/[^0-9a-z/\-]/g, '').replace(/^[-/]+|[-/]+$/g, '');
const normPlace = (v) => String(v || '').toLowerCase().replace(/[^a-z]/g, '');
async function sameProperty(pd = {}, selfId = null) {
  const sy = normNo(pd.surveyNo || (pd.sheet && pd.sheet.surveyNo));
  if (!sy || sy.length < 2) return [];
  const door = normNo(pd.doorNo || (pd.sheet && pd.sheet.doorNo));
  const plot = normNo(pd.plotNo || (pd.sheet && pd.sheet.plotNo));
  const village = normPlace(pd.village);
  const ValuationCase = require('../models/ValuationCase');
  // Candidates: survey number contains the same digits (then compared exactly in the normal form)
  const core = (sy.match(/\d+/) || [''])[0];
  if (!core) return [];
  const rx = new RegExp(`(^|\\D)${core}(\\D|$)`);
  const list = await ValuationCase.find({ id: { $ne: selfId || '' }, $or: [{ 'propertyDetails.surveyNo': rx }, { 'propertyDetails.sheet.surveyNo': rx }] })
    .select('id fileNumber clientName bankName status createdAt approvedAt assignedEngineerName propertyDetails.surveyNo propertyDetails.doorNo propertyDetails.plotNo propertyDetails.village propertyDetails.sheet.surveyNo propertyDetails.sheet.doorNo propertyDetails.sheet.plotNo valuation.fairMarketValue')
    .limit(200).lean();
  return list.filter((c) => {
    const p = c.propertyDetails || {}; const sh = p.sheet || {};
    if (normNo(p.surveyNo || sh.surveyNo) !== sy) return false;
    const d2 = normNo(p.doorNo || sh.doorNo); const p2 = normNo(p.plotNo || sh.plotNo);
    if ((door && d2 && door === d2) || (plot && p2 && plot === p2)) return true;
    return !door && !plot && village && normPlace(p.village) === village; // open land: same survey no in the same village
  }).map((c) => ({
    id: c.id, fileNumber: c.fileNumber, clientName: c.clientName, bankName: c.bankName, engineer: c.assignedEngineerName,
    value: (c.valuation && c.valuation.fairMarketValue) || 0,
    when: new Date(c.approvedAt || c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
  }));
}

module.exports = { runPreCheck, areaFromSides, similar, sameProperty, normNo };
