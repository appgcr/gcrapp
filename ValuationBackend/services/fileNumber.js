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

module.exports = { nextFileNumber };
