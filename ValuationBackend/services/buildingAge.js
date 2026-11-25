// Building age rule (same as the bank reports and the app): over 30 years → not eligible for valuation.
const MAX_BUILDING_AGE = 30;
const num = (v) => { const m = /\d+(?:\.\d+)?/.exec(String(v == null ? '' : v)); return m ? Number(m[0]) : NaN; };
const isBuilt = (t = '') => !!String(t || '').trim() && !/open|agri|site|plot|land/i.test(t);

/** The oldest building age on a case's propertyDetails (age typed, year of construction, each building part) */
function oldestBuildingAge(pd = {}) {
  const now = new Date().getFullYear();
  const rep = pd.report || {};
  const ages = [num(pd.buildingAge), num(pd.sheet && pd.sheet.buildingAge)];
  const yr = num(rep.yearOfConstruction);
  if (yr > 1900 && yr <= now) ages.push(now - yr);
  (Array.isArray(rep.buildings) ? rep.buildings : []).forEach((b) => { const y = num(b && b.year); if (y > 1900 && y <= now) ages.push(now - y); });
  const ok = ages.filter(Number.isFinite);
  return ok.length ? Math.max(...ok) : NaN;
}
/** → an error message when the building is too old to value, else '' */
function tooOldError(pd = {}) {
  if (!isBuilt(pd.propertyType || (pd.sheet && pd.sheet.propertyType))) return '';
  const a = oldestBuildingAge(pd);
  return a > MAX_BUILDING_AGE ? `The building is ${a} years old. Buildings over ${MAX_BUILDING_AGE} years are not eligible for valuation.` : '';
}
module.exports = { MAX_BUILDING_AGE, oldestBuildingAge, tooOldError, isBuilt };
