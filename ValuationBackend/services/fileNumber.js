// File numbers: GOURU/<BRANCH>/<YYYY>/<MM>/<NNNN>, e.g. GOURU/KDP/2026/11/0001 (cases before 13 Nov 2026 keep GCR/).
// The running number restarts at 0001 every month, separately for each branch (IST calendar).
const Counter = require('../models/Counter');
const { istParts } = require('./istTime');

const PREFIX = 'GOURU';

async function nextFileNumber(branchCode, date = new Date()) {
  const code = String(branchCode || 'GEN').toUpperCase();
  const [yyyy, mm] = istParts(date).ymd.split('-');
  const key = `file:${code}:${yyyy}-${mm}`;
  const { seq } = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `${PREFIX}/${code}/${yyyy}/${mm}/${String(seq).padStart(4, '0')}`;
}

/**
 * Case id YYYYMM + running number (2026111 → 20261121…). Taken from a counter so a number is
 * never handed out twice — not even after a case is deleted (a phone may still hold a draft for it).
 */
async function nextCaseId(date = new Date()) {
  const ValuationCase = require('../models/ValuationCase');
  const prefix = date.getFullYear().toString() + (date.getMonth() + 1).toString().padStart(2, '0');
  const key = `caseid:${prefix}`;
  if (!(await Counter.exists({ key }))) {
    // First use this month: start above the highest number already used
    const rows = await ValuationCase.find({ id: new RegExp(`^${prefix}\\d+$`) }).select('id').lean();
    const max = rows.reduce((m, r) => Math.max(m, Number(r.id.slice(prefix.length)) || 0), 0);
    await Counter.updateOne({ key }, { $max: { seq: max } }, { upsert: true });
  }
  for (let i = 0; i < 5; i++) {
    const { seq } = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    const id = prefix + String(seq).padStart(2, '0');
    if (!(await ValuationCase.exists({ id }))) return id;
  }
  throw new Error('Could not get a new case number. Please try again.');
}

module.exports = { nextFileNumber, nextCaseId };
