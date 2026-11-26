// The one bank list for the whole app. Pickers, case creation, valuation percentages and
// the report format all come from here, so a Super Admin change shows up everywhere.
const Bank = require('../models/Bank');

// Report layouts that are installed (services/reports). Others print the standard report.
const FORMATS = [
  { key: 'standard', label: 'Standard Gouru report' },
  { key: 'apgb', label: 'APGB (bank’s own format)' },
  { key: 'bob', label: 'Bank of Baroda (bank’s own format)' },
  { key: 'boi', label: 'Bank of India (bank’s own format)' },
  { key: 'canara', label: 'Canara Bank (bank’s own format)' },
  { key: 'union', label: 'Union Bank of India (bank’s own format)' },
  { key: 'pnb', label: 'Punjab National Bank (bank’s own format)' },
  { key: 'iob', label: 'Indian Overseas Bank (bank’s own format)' },
  { key: 'cbi', label: 'Central Bank of India (bank’s own format)' },
  { key: 'uco', label: 'UCO Bank (bank’s own format)' },
  { key: 'karnataka', label: 'Karnataka Bank (bank’s own format)' },
  { key: 'indian', label: 'Indian Bank (bank’s own format)' },
  { key: 'sbi', label: 'State Bank of India (bank’s own format)' },
  { key: 'bom', label: 'Bank of Maharashtra (bank’s own format)' },
  { key: 'shriram', label: 'Shriram Finance (lender’s own format)' },
];

// Property types → policy slot
const CATEGORY_SLOT = {
  'Independent House': 'house', 'Residential Building': 'house',
  'Apartment': 'apartment',
  'Open Site': 'openSite',
  'Open Agriculture Land': 'agriculture', 'Agricultural Land': 'agriculture',
  'Industrial Unit': 'industrial', 'Industrial Building': 'industrial', 'Industrial Building / Shed': 'industrial',
};
const INSURABLE = { house: 'STRUCTURE_PLUS_AMENITIES', apartment: 'FLAT_STRUCTURE_ONLY', openSite: 'NOT_APPLICABLE', agriculture: 'NOT_APPLICABLE',
  industrial: 'STRUCTURE_PLUS_AMENITIES' };

const p = (realizable, distress) => ({ realizable, distress });
// The banks the valuer works with — each has its own report format (bank's demo samples in
// services/reports/<bank>_source). Only these appear in bank lists; the Super Admin can add more.
const SEED = [
  { name: 'Andhra Pradesh Grameena Bank', shortName: 'APGB', aliases: ['Andhra Pragathi Grameena Bank', 'A.P.G.B', 'AP Grameena Bank'],
    format: 'apgb', policies: { house: p(90, 80), apartment: p(85, 75), openSite: p(90, 80), agriculture: p(85, 75) } },
  { name: 'Bank of Baroda', shortName: 'BOB', format: 'bob',
    policies: { house: p(90, 80), apartment: p(90, 80), openSite: p(90, 80), agriculture: p(90, 80) } },
  { name: 'Bank of India', shortName: 'BOI', format: 'boi',
    policies: { house: p(95, 90), apartment: p(95, 90), openSite: p(90, 80), agriculture: p(90, 80) } },
  { name: 'Canara Bank', format: 'canara', policies: { house: p(95, 90), apartment: p(95, 90), openSite: p(90, 80), agriculture: p(90, 80) } },
  { name: 'Union Bank of India', shortName: 'UBI', format: 'union',
    policies: { house: p(90, 80), apartment: p(90, 80), openSite: p(90, 80), agriculture: p(90, 80), industrial: p(90, 80) } },
  { name: 'Punjab National Bank', shortName: 'PNB', aliases: ['Punjab National Bank (PNB)', 'Panjab National Bank'], format: 'pnb',
    policies: { house: p(90, 80), apartment: p(95, 90), openSite: p(90, 80) } },
  { name: 'Indian Overseas Bank', shortName: 'IOB', format: 'iob',
    policies: { house: p(90, 80), apartment: p(90, 80), openSite: p(90, 80) } },
  { name: 'Central Bank of India', shortName: 'CBI', format: 'cbi',
    policies: { house: p(90, 80), apartment: p(95, 90), openSite: p(90, 80) } },
  { name: 'UCO Bank', shortName: 'UCO', aliases: ['United Commercial Bank'], format: 'uco',
    policies: { house: p(95, 90), apartment: p(95, 90), openSite: p(90, 80) } },
  { name: 'Karnataka Bank', shortName: 'KBL', aliases: ['Karnataka Bank Ltd'], format: 'karnataka',
    policies: { house: p(90, 75), openSite: p(90, 75) } },
  { name: 'State Bank of India', shortName: 'SBI', aliases: ['State Bank of India (SBI)'], format: 'sbi',
    policies: { house: p(95, 90), apartment: p(95, 90) } },
  { name: 'Bank of Maharashtra', shortName: 'BOM', aliases: ['Bank of Maharastra'], format: 'bom',
    policies: { apartment: p(90, 80) } },
  { name: 'Indian Bank', format: 'indian', policies: { openSite: p(90, 80) } },
  { name: 'Shriram Finance Ltd', shortName: 'Shriram', aliases: ['Shriram Finance', 'Shriram Finances Ltd', 'Shriram Finance Limited'],
    format: 'shriram', policies: { openSite: p(90, 80) } },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Bank branches from the office lists (Nov 2026). Each list is added once to each bank's own list; banks with
// no branches in a list are left as they are. Spellings evened out, abbreviations without dots (SME, ITI, NGO).
// Kadapa is the home office, so its names stay plain; other towns carry the town ("Main – Proddatur"), because
// many names repeat (Main, SME, Court, Gandhi Road) and the chosen name is printed on the report.
const KADAPA_BRANCHES = {
  'State Bank of India': ['RACPC', 'SME', 'Main – 7 Roads', 'PBB', 'Court', 'RTC', 'Yerramukkapalli', 'Durgamma Colony', 'ITI',
    'Chinna Chowk', 'Krishnapuram', 'Patha Kadapa'],
  'Punjab National Bank': ['Main – 7 Roads', 'Co-operative Colony'],
  'Bank of Baroda': ['Main – 7 Roads', 'RS Road', 'Hospital Road'],
  'Indian Bank': ['Main', 'Rajiv Park'],
  'Union Bank of India': ['Main – 7 Roads', 'Koti Reddy', 'ITI', 'NGO East Face', 'NGO West Face', 'Chinna Chowk', 'Yerramukkapalli',
    'LIC', 'CMR Palle', 'Mundy Bazar'],
  'Andhra Pradesh Grameena Bank': ['Main', 'Patha Kadapa', 'Mariyapuram', 'Mochampeta', 'NESCO', 'Yerramukkapalli', 'NGO', 'RS Road'],
  'Canara Bank': ['Main – 7 Roads', 'ITI', 'Shankarapuram', 'NGO', 'Mochampeta', 'MSME Sulabh'],
};
const PRODDATUR = (names) => names.map((n) => `${n} – Proddatur`);
const PRODDATUR_BRANCHES = {
  'State Bank of India': PRODDATUR(['SME', 'Main', 'Gandhi Road', 'Court', 'Shivalayam', 'Town', 'ADB']),
  'Bank of Baroda': PRODDATUR(['Holmespeta', 'TB Road']),
  'Indian Bank': PRODDATUR(['Main', 'Mydukur Road']),
  'Union Bank of India': PRODDATUR(['Super Bazar Road', 'Gandhi Road', 'YMR Colony', 'Jinnah Road']),
  'Andhra Pradesh Grameena Bank': PRODDATUR(['Main', 'Rameswaram', 'Modampalli', 'NGO Colony', 'Gopavaram']),
  'Canara Bank': PRODDATUR(['Main', 'Jinnah Road', 'Gandhi Road']),
};
// Vempalle area: village branches keep their own name (Chakrayapeta, Nandimandalam…); generic ones carry the town
const VEMPALLE_BRANCHES = {
  'State Bank of India': ['Vempalle', 'Chakrayapeta', 'Nandimandalam'],
  'Union Bank of India': ['Vempalle', 'Nagulaguttapalle'],
  'Andhra Pradesh Grameena Bank': ['Main – Vempalle', 'Kandula Complex – Vempalle', 'Veerapunayunipalle', 'Chakrayapeta'],
  'Canara Bank': ['Vempalle'],
};
// Pulivendula area: town branches carry the town ("Main – Pulivendula"); village branches keep their own name
const PULIVENDULA_BRANCHES = {
  'State Bank of India': ['Main – Pulivendula', 'Town – Pulivendula', 'JNTU – Pulivendula', 'Kondapuram', 'Balapanur', 'Parnapalli', 'Kommanuthala'],
  'Bank of Baroda': ['Pulivendula'],
  'Union Bank of India': ['Pulivendula', 'Vemula'],
  'Andhra Pradesh Grameena Bank': ['Main – Pulivendula', 'Poola Angallu – Pulivendula', 'Nallapureddipalli', 'Lingala', 'Mallala', 'Thonduru', 'Velidandla'],
  'Canara Bank': ['Pulivendula', 'Simhadripuram'],
};
const BRANCH_IMPORTS = [
  ['branches-kadapa-2026-11', 'Kadapa', KADAPA_BRANCHES],
  ['branches-proddatur-2026-11', 'Proddatur', PRODDATUR_BRANCHES],
  ['branches-vempalle-2026-11', 'Vempalle', VEMPALLE_BRANCHES],
  ['branches-pulivendula-2026-11', 'Pulivendula', PULIVENDULA_BRANCHES],
];

/**
 * Adds each branch list once, filed under our office of that town (never removes; a branch the bank already
 * has, whatever its spaces/dots, is kept — and filed under the town if it isn't filed anywhere yet).
 */
async function importBranchLists() {
  const AppConfig = require('../models/AppConfig');
  const Branch = require('../models/Branch');
  for (const [importId, town, lists] of BRANCH_IMPORTS) {
    const cfg = await AppConfig.findOne({ key: 'global' }).select('doneImports').lean();
    if ((cfg?.doneImports || []).includes(importId)) continue;
    // The office's own spelling when it exists (e.g. "vempalle"); otherwise the town
    const offices = await Branch.find({}).select('name code').lean();
    const officeName = (offices.find((o) => norm(o.name) === norm(town)) || {}).name || town;
    let added = 0;
    for (const [name, list] of Object.entries(lists)) {
      const found = await findBank(name);
      const bank = found && await Bank.findOne({ id: found.id }).select('id branches officeBranches').lean();   // fresh, not cached
      if (!bank) continue;
      const have = new Set((bank.branches || []).map(norm));
      const fresh = list.filter((b) => !have.has(norm(b)) && have.add(norm(b)));
      const groups = (bank.officeBranches || []).map((g) => ({ office: g.office, names: [...(g.names || [])] }));
      const filed = new Set(groups.flatMap((g) => g.names.map(norm)));
      let group = groups.find((g) => norm(g.office) === norm(officeName));
      if (!group) { group = { office: officeName, names: [] }; groups.push(group); }
      list.filter((b) => !filed.has(norm(b))).forEach((b) => {
        const existing = (bank.branches || []).find((x) => norm(x) === norm(b));
        group.names.push(existing || b);
      });
      await Bank.updateOne({ id: bank.id }, {
        $set: { officeBranches: groups.filter((g) => g.names.length) },
        ...(fresh.length ? { $push: { branches: { $each: fresh } } } : {}),
      });
      added += fresh.length;
    }
    await AppConfig.updateOne({ key: 'global' }, { $addToSet: { doneImports: importId } }, { upsert: true });
    clearCache();
    console.log(`🏦 ${town} branches added: ${added}`);
  }
}

let cache = null;
async function allBanks() {
  if (!cache) cache = await Bank.find({}).sort({ name: 1 }).lean();
  return cache;
}
function clearCache() { cache = null; }

async function nextBankId() {
  const rows = await Bank.find({}).select('id').lean();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ''), 10) || 0), 0);
  return `BANK-${String(max + 1).padStart(3, '0')}`;
}

// First start: create the bank list (plus any bank names already used on cases)
async function ensureBanks() {
  try {
    if (await Bank.countDocuments() === 0) {
      let n = 0;
      for (const b of SEED) {
        n += 1;
        await Bank.create({ id: `BANK-${String(n).padStart(3, '0')}`, format: 'standard', ...b });
      }
      console.log(`🏦 Bank list created (${n} banks)`);
    }
    clearCache();
    // A bank whose own format was installed later: switch it over unless the Super Admin already set it up
    for (const seed of SEED.filter((b) => b.format && b.format !== 'standard')) {
      let bank = await findBank(seed.name);
      if (!bank && (seed.aliases || []).length) {
        for (const a of seed.aliases) { bank = bank || await findBank(a); }
      }
      if (!bank) {   // a lender whose format was added later (e.g. Shriram Finance): add it to the list
        await Bank.create({ id: await nextBankId(), ...seed });
        console.log(`🏦 ${seed.name}: added with its own report format`);
        clearCache();
        continue;
      }
      const untouched = bank && bank.format === 'standard' &&
        !Object.values(bank.policies || {}).some((p) => p && p.realizable != null);
      if (untouched) {
        await Bank.updateOne({ id: bank.id }, { $set: { format: seed.format, policies: seed.policies } });
        console.log(`🏦 ${bank.name}: own report format installed`);
        clearCache();
      }
    }
    const ValuationCase = require('../models/ValuationCase');
    const AppConfig = require('../models/AppConfig');
    const used = (await ValuationCase.distinct('bankName')).filter(Boolean);
    const cfg = await AppConfig.findOne({ key: 'global' }).lean();
    for (const name of [...used, ...((cfg && cfg.banks) || [])]) {
      if (!(await findBank(name)) && !/unassigned|pending/i.test(name)) {
        await Bank.create({ id: await nextBankId(), name: name.trim(), status: 'Inactive' });
        clearCache();
      }
    }
    await importBranchLists();
    // Cases remember which bank they belong to, so a rename reaches them
    for (const b of await allBanks()) {
      const names = [b.name, b.shortName, ...(b.aliases || [])].filter(Boolean);
      await ValuationCase.updateMany(
        { bankId: { $in: [null, ''] }, bankName: { $in: names } },
        { $set: { bankId: b.id } }
      );
    }
    await syncConfigList();
  } catch (err) {
    console.warn('⚠️ Bank setup:', err.message);
  }
}

// Old screens read AppConfig.banks — keep it equal to the active bank names
async function syncConfigList() {
  const AppConfig = require('../models/AppConfig');
  const names = (await allBanks()).filter((b) => b.status !== 'Inactive').map((b) => b.name);
  await AppConfig.updateOne({ key: 'global' }, { $set: { banks: names } }, { upsert: true });
}

async function findBank(nameOrId) {
  const key = norm(nameOrId);
  if (!key) return null;
  const banks = await allBanks();
  const hit = banks.find((b) => b.id.toLowerCase() === String(nameOrId).toLowerCase()) ||
    banks.find((b) => [b.name, b.shortName, ...(b.aliases || [])].some((n) => n && norm(n) === key));
  if (hit) return hit;
  // Loose spellings of the two banks with special rules
  if (/grameena|\bapgb\b/i.test(nameOrId)) return banks.find((b) => b.format === 'apgb') || null;
  return null;
}

// Valuation-engine policy table for this bank: { 'Apartment': { realizableRate, distressRate, insurableMethod }, … }
function policyTable(bank) {
  if (!bank) return null;
  const out = {};
  for (const [category, slot] of Object.entries(CATEGORY_SLOT)) {
    const pol = bank.policies && bank.policies[slot];
    if (pol && pol.realizable != null && pol.distress != null) {
      out[category] = { realizableRate: pol.realizable / 100, distressRate: pol.distress / 100, insurableMethod: INSURABLE[slot] };
    }
  }
  return out;
}

async function policyForName(bankName) {
  const bank = await findBank(bankName);
  return bank ? policyTable(bank) : null;
}

// What a case stores about its bank's report layout
async function reportFormatFor(bankName) {
  const bank = await findBank(bankName);
  if (!bank) return bankName ? { bankKey: 'other', label: bankName, bankTemplate: false } : null;
  return { bankKey: bank.format === 'standard' ? norm(bank.shortName || bank.name) : bank.format,
    bankId: bank.id, label: bank.name, bankTemplate: bank.format !== 'standard' };
}

// Everything the report generator needs about the bank (percentages per property type, format)
async function bankInfoForReport(caseObj) {
  const bank = await findBank(caseObj.bankId || caseObj.bankName);
  if (!bank) return caseObj;
  const fmt = await reportFormatFor(bank.name);
  const out = { ...caseObj, reportFormat: fmt, bankPolicy: bank.policies || {} };
  // Office sheet, Purchase: the property still belongs to the seller — the report's owner is the seller
  // and the buyer (the case's client) is printed as the Applicant
  {
    const pdS = out.propertyDetails || {};
    const sh = pdS.sheet || {};
    // The owner's own address from the sheet (the property's address is printed in the property part)
    if (pdS.entryMode === 'sheet' && String(sh.ownerAddress || '').trim()) out.address = String(sh.ownerAddress).trim();
    // Owner's address spoken on the case form (voice fill)
    else if (String(pdS.report?.ownerAddress || '').trim()) out.address = String(pdS.report.ownerAddress).trim();
    if (pdS.entryMode === 'sheet' && pdS.dealType !== 'Purchase' && !String(out.clientFatherName || '').trim() && String(sh.ownerRelation || '').trim()) out.clientFatherName = String(sh.ownerRelation).trim();
    if (pdS.entryMode === 'sheet' && pdS.dealType === 'Purchase' && String(sh.ownerName || '').trim()) {
      const rep = { ...(pdS.report || {}) };
      if (!rep.applicantName) { rep.applicantName = sh.applicantName || out.clientName || ''; rep.applicantAddr = sh.applicantAddress || ''; }
      if (!rep.applicantRel && sh.applicantRelation) rep.applicantRel = sh.applicantRelation;
      out.clientName = String(sh.ownerName).trim();
      out.clientFatherName = String(sh.ownerRelation || '').trim();
      out.propertyDetails = { ...pdS, report: rep };
    }
  }
  // Building rate per sq.ft: always worked out from the details being reported, never a rate left over
  // from an earlier save (the engineer's preview and the submitted report must show the same money)
  {
    const pdNow = out.propertyDetails || {};
    let rate = Number(pdNow.constructionRate) || 0;
    if (!rate) {
      try {
        const { calculateValuation } = require('./valuationCalculator');
        const v = calculateValuation({ ...pdNow, bankName: out.bankName });
        rate = Number(v && v.constructionRate) || 0;
      } catch { /* fall back below */ }
    }
    if (!rate) rate = ({ 'Framed structure': 1800, 'Load bearing': 1400, 'Steel / Precast': 1600 })[pdNow.structureType] || 1800;
    out.valuation = { ...(out.valuation || {}), constructionRate: rate };
  }
  // Village / mandal read from the sale deed are kept on the property; the bank formats read report.village / mandal.
  // Area (landmark) falls back to the typed address part that isn't the plot/door, village or town.
  {
    const pd0 = out.propertyDetails || {};
    const rep0 = { ...(pd0.report || {}) };
    const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    if (!clean(rep0.village) && clean(pd0.village)) rep0.village = clean(pd0.village);
    if (!clean(rep0.mandal) && clean(pd0.mandal)) rep0.mandal = clean(pd0.mandal);
    if (!clean(rep0.landmark)) {
      // Every part of the property's detailed address that the report doesn't already print
      // (door / plot / survey / flat numbers, village, mandal, district, PIN, state) — not just the first one
      const skip = [rep0.village, rep0.mandal, pd0.district, out.bankDistrict].map((x) => clean(x).toLowerCase()).filter(Boolean);
      const sheetAddr = pd0.entryMode === 'sheet' ? clean(pd0.sheet && pd0.sheet.address) : '';
      const src = sheetAddr || clean(caseObj.address);
      const isNumberPart = (x) => /^(d\.?\s*no|door|plot|h\.?\s*no|house\s*no|sy\.?|s\.?\s*no|survey|flat|ward)\b/i.test(x) || /^[\d\s/-]+$/.test(x);
      const isRegion = (x) => /\b(dist(rict)?|dt|mandal|state|andhra\s*pradesh|a\.?\s*p\.?|india|pin(code)?)\b/i.test(x) || /\b\d{6}\b/.test(x);
      const known = (x) => skip.some((k) => x.toLowerCase() === k || x.toLowerCase().replace(/\s*(village|town|city|mandal)\b/g, '').trim() === k);
      const parts = src.split(/,|\n/).map(clean).filter(Boolean)
        .filter((x) => !isNumberPart(x) && !isRegion(x) && !known(x));
      const seen = new Set();
      const keep = parts.filter((x) => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      if (keep.length) rep0.landmark = keep.join(', ');
    }
    out.propertyDetails = { ...pd0, report: rep0 };
  }
  // Site sizes are entered once (Step 3 → Boundary Dimensions); the bank formats read them as report.dimDeed* / dimActual*
  const pd = out.propertyDetails || {};
  if (pd.dimensionsDoc || pd.dimensionsActual || pd.guidelineRate) {
    const unit = pd.dimensionUnit || 'Feet';
    const withUnit = (v) => { const t = String(v == null ? '' : v).trim(); return !t ? '' : /[a-z’'"”]/i.test(t) ? t : `${t} ${unit}`; };
    const rep = { ...(pd.report || {}) };
    for (const side of ['North', 'South', 'East', 'West']) {
      const k = side.toLowerCase();
      if (!rep[`dimDeed${side}`] && withUnit(pd.dimensionsDoc?.[k])) rep[`dimDeed${side}`] = withUnit(pd.dimensionsDoc[k]);
      if (!rep[`dimActual${side}`] && withUnit(pd.dimensionsActual?.[k])) rep[`dimActual${side}`] = withUnit(pd.dimensionsActual[k]);
    }
    out.propertyDetails = { ...pd, report: rep };
  }
  // The branch's own letterhead / valuer (Settings → Letterhead); empty = the formats' Kadapa letterhead
  if (caseObj.branchId && out.branchLetterhead === undefined) {
    const Branch = require('../models/Branch');
    const br = await Branch.findOne({ id: caseObj.branchId }).select('letterhead valuer').lean();
    out.branchLetterhead = (br && br.letterhead && br.letterhead.dataUrl) || '';
    out.branchValuer = (br && br.valuer) || {};
  }
  return out;
}

module.exports = {
  FORMATS, SEED, ensureBanks, allBanks, clearCache, findBank, policyTable, policyForName,
  reportFormatFor, bankInfoForReport, syncConfigList, nextBankId, norm, CATEGORY_SLOT,
};
