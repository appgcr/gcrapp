const express = require('express');
const router = express.Router();
const Bank = require('../models/Bank');
const ValuationCase = require('../models/ValuationCase');
const { authenticateToken, requireRole } = require('../middleware/auth');
const banks = require('../services/banks');

const SLOTS = ['house', 'apartment', 'openSite', 'agriculture', 'industrial'];
const pct = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.min(100, Math.max(0, Number(v))));

function clean(body = {}) {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.shortName !== undefined) out.shortName = String(body.shortName).trim();
  if (body.aliases !== undefined) {
    const list = Array.isArray(body.aliases) ? body.aliases : String(body.aliases).split(',');
    out.aliases = [...new Set(list.map((a) => String(a).trim()).filter(Boolean))];
  }
  if (body.branches !== undefined) {
    const list = Array.isArray(body.branches) ? body.branches : String(body.branches).split(/[\n,]/);
    const seen = new Set();
    out.branches = list.map((b) => String(b).trim().replace(/\s+/g, ' ').slice(0, 80)).filter((b) => {
      const k = b.toLowerCase();
      if (!b || seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0, 300);
  }
  const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  if (body.email !== undefined) {
    const e = String(body.email || '').trim().toLowerCase();
    if (e && !okEmail(e)) throw new Error('The bank email does not look right.');
    out.email = e;
  }
  if (body.autoSend !== undefined) out.autoSend = !!body.autoSend;
  if (body.fees) {
    out.fees = {};
    for (const k of ['house', 'apartment', 'openSite', 'agriculture', 'industrial']) {
      const v = body.fees[k];
      const n = v === '' || v == null ? null : Math.round(Number(String(v).replace(/[^\d.]/g, '')));
      if (n != null && (!Number.isFinite(n) || n < 0 || n > 10000000)) throw new Error('Enter the fee in rupees.');
      out.fees[k] = n;
    }
  }
  if (body.contacts !== undefined) {
    // "ITI Road | itiroad@sbi.co.in | 98765 43210" per line, or [{ branch, email, phone }]
    const rows = Array.isArray(body.contacts) ? body.contacts : String(body.contacts || '').split('\n').map((l) => {
      const [branch, ...rest] = l.split('|').map((x) => x.trim());
      const email = rest.find((x) => x.includes('@')) || '';
      const phone = (rest.find((x) => /\d{6,}/.test(x.replace(/\D/g, ''))) || '').replace(/[^\d+]/g, '');
      return { branch, email, phone };
    });
    out.contacts = rows.filter((r) => r && r.branch && (r.email || r.phone)).map((r) => {
      const email = String(r.email || '').trim().toLowerCase();
      if (email && !okEmail(email)) throw new Error(`Email for ${r.branch} does not look right.`);
      return { branch: String(r.branch).trim().slice(0, 80), email, phone: String(r.phone || '').replace(/[^\d+]/g, '').slice(0, 15) };
    }).slice(0, 300);
  }
  if (body.format !== undefined) {
    if (!banks.FORMATS.some((f) => f.key === body.format)) throw new Error('Unknown report format.');
    out.format = body.format;
  }
  if (body.status !== undefined) out.status = body.status === 'Inactive' ? 'Inactive' : 'Active';
  if (body.policies) {
    out.policies = {};
    for (const s of SLOTS) {
      const p = body.policies[s] || {};
      const realizable = pct(p.realizable);
      const distress = pct(p.distress);
      if (realizable != null && distress != null && distress > realizable) {
        throw new Error('Distress value % can’t be more than the realizable value %.');
      }
      out.policies[s] = { realizable, distress };
    }
  }
  return out;
}

// Another bank already uses this name / short name / other spelling?
async function clash(fields, selfId) {
  const names = [fields.name, fields.shortName, ...(fields.aliases || [])].filter(Boolean);
  for (const n of names) {
    const other = await banks.findBank(n);
    if (other && other.id !== selfId && banks.norm(n) && [other.name, other.shortName, ...(other.aliases || [])].some((x) => x && banks.norm(x) === banks.norm(n))) {
      return `“${n}” is already used by ${other.name}.`;
    }
  }
  return null;
}

async function withCaseCounts(list) {
  const counts = await ValuationCase.aggregate([{ $group: { _id: '$bankId', n: { $sum: 1 } } }]);
  const by = new Map(counts.map((c) => [c._id, c.n]));
  return list.map((b) => ({ ...b, caseCount: by.get(b.id) || 0 }));
}

// GET /api/banks — active banks for pickers; ?all=1 (Super Admin) includes inactive ones and case counts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const list = await banks.allBanks();
    const superAdmin = req.user.role === 'SUPER_ADMIN';
    if (req.query.all && superAdmin) {
      return res.json({ banks: await withCaseCounts(list), formats: banks.FORMATS });
    }
    res.json({ banks: list.filter((b) => b.status !== 'Inactive'), formats: banks.FORMATS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/banks — add a bank (Super Admin)
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const fields = clean(req.body);
    if (!fields.name) return res.status(400).json({ error: 'Bank name is required.' });
    const problem = await clash(fields);
    if (problem) return res.status(409).json({ error: problem });
    const bank = await Bank.create({ id: await banks.nextBankId(), ...fields });
    banks.clearCache();
    await banks.syncConfigList();
    res.status(201).json(bank);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/banks/:id — rename / edit (Super Admin). A rename updates every case of this bank.
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const bank = await Bank.findOne({ id: req.params.id });
    if (!bank) return res.status(404).json({ error: 'Bank not found.' });
    const fields = clean(req.body);
    if (fields.name === '') return res.status(400).json({ error: 'Bank name is required.' });
    const problem = await clash(fields, bank.id);
    if (problem) return res.status(409).json({ error: problem });

    const oldNames = [bank.name, bank.shortName, ...(bank.aliases || [])].filter(Boolean);
    const renamed = fields.name && fields.name !== bank.name;
    // Keep the old name as another spelling so old documents and searches still find the bank
    if (renamed) fields.aliases = [...new Set([...(fields.aliases || bank.aliases || []), bank.name])].filter((a) => banks.norm(a) !== banks.norm(fields.name));
    Object.assign(bank, fields, { updatedAt: new Date() });
    await bank.save();
    banks.clearCache();
    await banks.syncConfigList();

    // Every case of this bank shows the new name and uses the new report format
    const fmt = await banks.reportFormatFor(bank.name);
    const result = await ValuationCase.updateMany(
      { $or: [{ bankId: bank.id }, { bankName: { $in: oldNames } }] },
      { $set: { bankId: bank.id, bankName: bank.name, reportFormat: fmt } }
    );
    res.json({ bank, casesUpdated: result.modifiedCount || 0 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
