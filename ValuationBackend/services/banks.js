// The one bank list for the whole app. Pickers, case creation, valuation percentages and
// the report format all come from here, so a Super Admin change shows up everywhere.
const Bank = require('../models/Bank');

// Report layouts that are installed (services/reports). Others print the standard report.
const FORMATS = [
  { key: 'standard', label: 'Standard GCR report' },
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
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
      const bank = await findBank(seed.name);
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
  reportFormatFor, bankInfoForReport, syncConfigList, nextBankId, norm,
};
