// Building age rules (the same as the bank reports, services/reports/apgb.py → dep_percent):
// no depreciation for the first 3 completed years; from the 4th year the age in percent (4 → 4 %, 5 → 5 % … 30 → 30 %).
// A building over 30 years old is not eligible for valuation.
export const MAX_BUILDING_AGE = 30;

/** "12", "12 years", "12 yrs" → 12 (NaN when no number) */
export const ageYears = (v) => { const m = String(v ?? '').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; };

/** Depreciation % for a building of this age */
export const depPercentFor = (v) => { const a = ageYears(v); return !(a > 3) ? 0 : Math.min(a, MAX_BUILDING_AGE); };

export const tooOldText = (a) => `The building is ${a} years old. Buildings over ${MAX_BUILDING_AGE} years are not eligible for valuation.`;

/** The oldest building age on a case: the age typed, the year of construction, or each building part's year */
export function oldestBuildingAge(pd = {}) {
  const now = new Date().getFullYear();
  const rep = pd.report || {};
  const ages = [ageYears(pd.buildingAge), ageYears(pd.sheet?.buildingAge)];
  const yr = ageYears(rep.yearOfConstruction);
  if (yr > 1900 && yr <= now) ages.push(now - yr);
  (Array.isArray(rep.buildings) ? rep.buildings : []).forEach((b) => { const y = ageYears(b && b.year); if (y > 1900 && y <= now) ages.push(now - y); });
  const ok = ages.filter((a) => Number.isFinite(a));
  return ok.length ? Math.max(...ok) : NaN;
}
