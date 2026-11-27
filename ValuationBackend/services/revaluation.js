// Revaluation Radar: banks must re-value the properties they hold as security every few years (Settings → Banks →
// "Revalue every N years", default 3). Gouru knows every property it valued and when, so it lists the ones coming due,
// reminds admins and bank staff once a month, and turns one into a new case with a tap — the old case's customer,
// bank, property details and documents are copied, so only a fresh site visit is needed.
const ValuationCase = require('../models/ValuationCase');
const Branch = require('../models/Branch');

const DAY = 86400000;
const SOON_DAYS = 60; // listed this many days before the due date

const CASE_FIELDS = 'id fileNumber branchId clientName clientPhone clientFatherName address bankName bankId bankBranch status approvedAt createdAt valuation.fairMarketValue propertyDetails.propertyType requestedBy reval revaluationOf';

/** The bank's revaluation period in years (0 = none) */
function yearsFor(bankList, c) {
  const b = bankList.find((x) => (c.bankId && x.id === c.bankId) || (x.name && c.bankName && x.name.toLowerCase() === String(c.bankName).toLowerCase()));
  if (!b) return 3;
  const n = Number(b.revalYears);
  return Number.isFinite(n) ? n : 3;
}

/**
 * Approved cases whose revaluation is due (or due within 60 days), newest-due first.
 * filter: extra Mongo filter (branch / bank user). includeDone: also list requested / dismissed ones.
 */
async function dueList(filter = {}, { includeDone = false, now = new Date() } = {}) {
  const bankList = await require('./banks').allBanks();
  const maxYears = Math.max(0, ...bankList.map((b) => Number(b.revalYears) || 0), 3);
  // Only cases old enough to possibly be due (saves loading the whole database)
  const oldest = new Date(now.getTime() - (365 * 1 - SOON_DAYS) * DAY);
  const rows = await ValuationCase.find({
    ...filter, status: 'Approved',
    $or: [{ approvedAt: { $lte: oldest } }, { approvedAt: null, createdAt: { $lte: oldest } }],
  }).select(CASE_FIELDS).lean();
  // A newer case already made from it (even before this feature) counts as requested
  const made = new Set((await ValuationCase.find({ revaluationOf: { $in: rows.map((r) => r.id) } }).select('revaluationOf').lean()).map((r) => r.revaluationOf));
  const branchNames = Object.fromEntries((await Branch.find({}).select('id name').lean()).map((b) => [b.id, b.name]));
  const out = [];
  for (const c of rows) {
    const years = yearsFor(bankList, c);
    if (!years || years > maxYears) continue;
    const base = new Date(c.approvedAt || c.createdAt);
    const due = new Date(base.getTime());
    due.setFullYear(due.getFullYear() + years);
    const daysLeft = Math.ceil((due - now) / DAY);
    if (daysLeft > SOON_DAYS) continue;
    const state = (c.reval && c.reval.state) || (made.has(c.id) ? 'requested' : '');
    if (state && !includeDone) continue;
    out.push({
      id: c.id, fileNumber: c.fileNumber || c.id, clientName: c.clientName || '', clientPhone: c.clientPhone || '',
      address: c.address || '', propertyType: (c.propertyDetails && c.propertyDetails.propertyType) || '',
      bankName: c.bankName || '', bankBranch: c.bankBranch || '', branchId: c.branchId || '', branchName: branchNames[c.branchId] || '',
      value: (c.valuation && Number(c.valuation.fairMarketValue)) || 0,
      valuedOn: base.toISOString(), dueOn: due.toISOString(), daysLeft, years,
      state, reval: c.reval || null, requestedBy: c.requestedBy ? { id: c.requestedBy.id, name: c.requestedBy.name } : null,
    });
  }
  out.sort((a, b) => a.daysLeft - b.daysLeft);
  return out;
}

const totals = (list) => ({
  count: list.length,
  overdue: list.filter((r) => r.daysLeft < 0).length,
  soon: list.filter((r) => r.daysLeft >= 0).length,
  value: list.reduce((n, r) => n + (r.value || 0), 0),
});

/** New case for a fresh valuation of the same property. actor = the user asking (admin or bank staff). */
async function createRevaluationCase(oldId, actor, note = '') {
  const old = await ValuationCase.findOne({ id: oldId }).lean();
  if (!old) throw Object.assign(new Error('Case not found.'), { status: 404 });
  if (old.status !== 'Approved') throw Object.assign(new Error('Only an approved valuation can be revalued.'), { status: 400 });
  if (old.reval && old.reval.state === 'requested') throw Object.assign(new Error(`Already requested as ${old.reval.newFileNumber || 'a new case'}.`), { status: 409 });
  const already = await ValuationCase.findOne({ revaluationOf: old.id }).select('fileNumber').lean();
  if (already) throw Object.assign(new Error(`Already requested as ${already.fileNumber}.`), { status: 409 });
  const branch = await Branch.findOne({ id: old.branchId }).lean();
  if (!branch) throw Object.assign(new Error('The branch of this case no longer exists.'), { status: 400 });

  const { nextCaseId, nextFileNumber } = require('./fileNumber');
  const today = new Date();
  const fromBank = actor.role === 'BANK';
  const valuedOn = new Date(old.approvedAt || old.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const value = old.valuation && old.valuation.fairMarketValue ? `₹${Number(old.valuation.fairMarketValue).toLocaleString('en-IN')}` : '';
  const pd = { ...(old.propertyDetails || {}) };
  delete pd.entryMode; delete pd.sheet; delete pd.sheetSource; // a fresh visit, filled the normal way

  const created = await ValuationCase.create({
    id: await nextCaseId(today),
    fileNumber: await nextFileNumber(branch.code, today),
    branchId: old.branchId,
    source: 'REVALUATION',
    status: 'Pending',
    assignedEngineerId: 'UNASSIGNED',
    revaluationOf: old.id,
    clientName: old.clientName, clientPhone: old.clientPhone || '', clientFatherName: old.clientFatherName || '',
    address: old.address || '', locationData: old.locationData || '',
    bankName: old.bankName || '', bankId: old.bankId || null, bankBranch: old.bankBranch || '', bankDistrict: old.bankDistrict || '',
    reportFormat: old.reportFormat,
    propertyDetails: pd,
    documents: old.documents || {}, // the same sale deed / tax receipt / plans (checked again at the visit)
    requestedAt: today,
    requestedBy: fromBank
      ? { id: actor.id, name: actor.name, phone: actor.phone, email: actor.email, bankName: old.bankName, bankBranch: actor.bankBranch, designation: actor.designation }
      : (old.requestedBy || undefined),
    requestDetails: {
      ...(old.requestDetails || {}),
      notes: [`Revaluation of ${old.fileNumber || old.id}, valued on ${valuedOn}${value ? ` at ${value}` : ''}.`, String(note || '').slice(0, 500)].filter(Boolean).join(' '),
      urgency: 'Normal',
    },
  });
  await ValuationCase.updateOne({ id: old.id }, { $set: { reval: {
    state: 'requested', at: today, by: actor.id, byName: actor.name || actor.username || '', newCaseId: created.id, newFileNumber: created.fileNumber,
  } } });
  const { notifyLater } = require('./notify');
  notifyLater({
    to: 'ADMIN', branchId: created.branchId, type: 'case_created', caseId: created.id, priority: 'normal',
    title: `Revaluation requested${fromBank ? ` by ${old.bankName}` : ''}`,
    message: `${created.fileNumber} · ${created.clientName} — revaluation of ${old.fileNumber}${value ? ` (${value})` : ''}. Assign an engineer.`,
  });
  return created.toObject();
}

async function setState(oldId, actor, state, reason = '') {
  const set = state ? { reval: { state, at: new Date(), by: actor.id, byName: actor.name || actor.username || '', reason: String(reason || '').slice(0, 200) } } : { reval: null };
  await ValuationCase.updateOne({ id: oldId, status: 'Approved' }, { $set: set });
}

module.exports = { dueList, totals, createRevaluationCase, setState, SOON_DAYS };
