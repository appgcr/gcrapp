// One-time tidy-up on start: data created before branches existed is attached to a branch,
// and cases without a file number get one (numbered by the month they were created).
const Branch = require('../models/Branch');
const User = require('../models/User');
const ValuationCase = require('../models/ValuationCase');
const { nextFileNumber } = require('./fileNumber');
const { reportFormatFor } = require('./banks');

async function ensureBranchSetup() {
  try {
    const orphanUsers = await User.countDocuments({ role: { $in: ['ADMIN', 'ENGINEER'] }, branchId: null });
    const orphanCases = await ValuationCase.countDocuments({ branchId: null });
    let main = null;
    if (orphanUsers || orphanCases) {
      main = await Branch.findOne({}).sort({ id: 1 });
      if (!main) main = await Branch.create({ id: 'BR-001', code: 'MAIN', name: 'Main Branch' });
      await User.updateMany({ role: { $in: ['ADMIN', 'ENGINEER'] }, branchId: null }, { $set: { branchId: main.id } });
      // A case follows its engineer's branch when it has one
      const cases = await ValuationCase.find({ branchId: null }).select('id assignedEngineerId').lean();
      for (const c of cases) {
        const eng = c.assignedEngineerId && await User.findOne({ $or: [{ id: c.assignedEngineerId }, { username: c.assignedEngineerId }] }).select('branchId').lean();
        await ValuationCase.updateOne({ id: c.id }, { $set: { branchId: eng?.branchId || main.id } });
      }
      console.log(`🏢 Attached ${orphanUsers} staff and ${orphanCases} cases to a branch`);
    }

    const unnumbered = await ValuationCase.find({ $or: [{ fileNumber: '' }, { fileNumber: null }, { fileNumber: { $exists: false } }] })
      .select('id branchId createdAt bankName reportFormat').sort({ createdAt: 1 }).lean();
    if (unnumbered.length) {
      const codes = new Map((await Branch.find({}).select('id code').lean()).map((b) => [b.id, b.code]));
      for (const c of unnumbered) {
        const fileNumber = await nextFileNumber(codes.get(c.branchId) || 'GEN', c.createdAt ? new Date(c.createdAt) : new Date());
        const set = { fileNumber };
        if (!c.reportFormat?.bankKey && c.bankName) set.reportFormat = await reportFormatFor(c.bankName);
        await ValuationCase.updateOne({ id: c.id }, { $set: set });
      }
      console.log(`🗂️ Gave file numbers to ${unnumbered.length} existing case(s)`);
    }
  } catch (err) {
    console.warn('⚠️ Branch setup:', err.message);
  }
}

module.exports = { ensureBranchSetup };
