// Checks on what Gouru AI heard, before it goes on the form. Safe fixes are made (bank short name → full name,
// branch spelled the way the bank list has it); everything doubtful is returned as a check for the engineer.
const { amount } = require('./officeSheet');

const n = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const num = (x) => { const m = /-?\d+(?:\.\d+)?/.exec(String(x || '').replace(/,/g, '')); return m ? Number(m[0]) : NaN; };

// A length as said ("10.67 meters", "40 ft", "40'6\"", "60 links") → metres
function metres(v) {
  const s = String(v || '').toLowerCase().replace(/,/g, '');
  const fi = /(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(\d+(?:\.\d+)?)\s*(?:"|in|inch)/.exec(s);
  if (fi) return Number(fi[1]) * 0.3048 + Number(fi[2]) * 0.0254;
  const x = num(s);
  if (!Number.isFinite(x) || x <= 0) return NaN;
  if (/link/.test(s)) return x * 0.201168;
  if (/ft|feet|foot|'/.test(s)) return x * 0.3048;
  if (/yard|yd/.test(s)) return x * 0.9144;
  return x; // metres, or no unit said
}
// An area as said ("215.63 sq yards", "4 cents 455 square links", "1800 sft", "180 sq m") → square metres
function sqm(v) {
  const s = String(v || '').toLowerCase().replace(/,/g, '');
  let total = 0; let any = false;
  const re = /(\d+(?:\.\d+)?)\s*(acres?|ac\b|cents?|sq\.?\s*(?:uare\s*)?(?:yards?|yds?)|sq\.?\s*(?:uare\s*)?(?:feet|foot|ft)|sft|sq\.?\s*(?:uare\s*)?(?:metres?|meters?|mts?|m\b)|sq\.?\s*(?:uare\s*)?links?|guntas?)/g;
  let m;
  while ((m = re.exec(s))) {
    const x = Number(m[1]); const u = m[2];
    any = true;
    if (/acre|ac\b/.test(u)) total += x * 4046.86;
    else if (/cent/.test(u)) total += x * 40.4686;
    else if (/gunta/.test(u)) total += x * 101.17;
    else if (/link/.test(u)) total += x * 0.040469;
    else if (/yard|yd/.test(u)) total += x * 0.836127;
    else if (/feet|foot|ft|sft/.test(u)) total += x * 0.092903;
    else total += x;
  }
  return any ? total : NaN;
}
function parseDate(v) {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(String(v || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? d : 'bad';
}

/**
 * fields: what Gouru AI heard (sheet keys + bankBranch, district, mobile); banks: the bank list.
 * → { fields (with safe fixes), fixes: ["SBI → State Bank of India"], checks: [{ field, text }] }
 */
function checkVoice(fields, banks = []) {
  const f = { ...fields };
  const fixes = [];
  const checks = [];
  const check = (field, text) => checks.push({ field, text });

  // Bank: short names and other spellings → the name in the bank list; branch → that bank's own spelling
  let bank = null;
  if (f.bank) {
    const said = n(f.bank);
    bank = banks.find((b) => n(b.name) === said || n(b.shortName) === said || (b.aliases || []).some((a) => n(a) === said))
      || banks.find((b) => said.length >= 4 && (n(b.name).startsWith(said) || said.startsWith(n(b.name))));
    if (bank && bank.name !== f.bank) { fixes.push(`${f.bank} → ${bank.name}`); f.bank = bank.name; }
  }
  if (bank && f.bankBranch && Array.isArray(bank.branches)) {
    const said = n(f.bankBranch);
    const br = bank.branches.find((b) => n(b) === said) || bank.branches.find((b) => said.length >= 4 && (n(b).includes(said) || said.includes(n(b))));
    if (br && br !== f.bankBranch) { fixes.push(`Branch ${f.bankBranch} → ${br}`); f.bankBranch = br; }
  }

  // Dates
  const today = new Date();
  for (const [k, label] of [['deedDate', 'Deed date'], ['inspectionDate', 'Inspection date'], ['baDate', 'B.A. date']]) {
    if (!f[k]) continue;
    const d = parseDate(f[k]);
    if (d === 'bad') check(k, `${label} "${f[k]}" is not a real date — please check.`);
    else if (d && k !== 'inspectionDate' && d > today) check(k, `${label} ${f[k]} is in the future — please check.`);
    else if (d && k === 'inspectionDate' && d - today > 2 * 86400000) check(k, `Inspection date ${f[k]} is in the future — please check.`);
  }

  // Measurements against the extent: the 4 sides should make (about) the extent said
  const ms = f.measurements || {};
  const e = metres(ms.east); const w = metres(ms.west); const no = metres(ms.north); const so = metres(ms.south);
  const side1 = [e, w].filter(Number.isFinite); const side2 = [no, so].filter(Number.isFinite);
  if (side1.length && side2.length) {
    const area = (side1.reduce((a, b) => a + b, 0) / side1.length) * (side2.reduce((a, b) => a + b, 0) / side2.length);
    const ext = sqm(f.extentDocument) || sqm(f.extentPlan);
    if (Number.isFinite(ext) && ext > 0) {
      const diff = Math.abs(area - ext) / ext;
      if (diff > 0.12) check('extentDocument', `The 4 sides make about ${(area / 0.836127).toFixed(1)} sq yds (${area.toFixed(1)} sq m), but the extent said is ${f.extentDocument || f.extentPlan}. Please check the measurements or the extent.`);
    }
    if (Number.isFinite(e) && Number.isFinite(w) && Math.abs(e - w) / Math.max(e, w) > 0.5) check('measurements.east', `East (${ms.east}) and west (${ms.west}) are very different — please check.`);
    if (Number.isFinite(no) && Number.isFinite(so) && Math.abs(no - so) / Math.max(no, so) > 0.5) check('measurements.north', `North (${ms.north}) and south (${ms.south}) are very different — please check.`);
  }

  // Boundaries: a plot / house / site on a side should say whose it is
  for (const [side, v] of Object.entries(f.boundaries || {})) {
    const s = String(v || '');
    if (/plot|site|house|land|property|building|illu|sthalam/i.test(s) && !/road|street|lane|canal|drain|nala|govt|government|panchayat|municipal|park|temple|school/i.test(s) && !/\b(of|gari|garu)\b|'s\b/i.test(s)) {
      check(`boundaries.${side}`, `${side[0].toUpperCase() + side.slice(1)} boundary "${s}" has no owner name — say or type whose it is (e.g. "${s} of Ramesh").`);
    }
  }

  // Numbers that look wrong
  if (f.mobile) {
    const d = String(f.mobile).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (d.length === 10) f.mobile = d; else check('mobile', `Mobile "${f.mobile}" is not 10 digits — please check.`);
  }
  if (f.constructionRate) { const r = amount(f.constructionRate); if (r && (r < 800 || r > 6000)) check('constructionRate', `Construction rate Rs ${r} per sq ft looks unusual — please check.`); }
  if (f.buildingAge) { const a = num(f.buildingAge); if (a > 30) check('buildingAge', `Building age ${f.buildingAge} years: buildings over 30 years are not eligible for valuation. Please check the age.`); }
  if (f.guidelineRate) { const g = amount(f.guidelineRate); if (g && g < 100) check('guidelineRate', `Govt rate Rs ${g} looks too small — please check the unit.`); }

  return { fields: f, fixes, checks };
}

module.exports = { checkVoice, metres, sqm };
