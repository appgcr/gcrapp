const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { isSuper, branchScope } = require('../services/access');
const { workReport } = require('../services/workReports');
const { istParts } = require('../services/istTime');

// GET /api/work-report?period=day|week&date=YYYY-MM-DD[&userId=ENG-001]
//   Engineer → their own report. Branch Admin → their branch (or one of its engineers).
//   Super Admin → every branch, the branch being viewed, or one engineer.
// The same report as a polished A4 PDF: GET /api/work-report/pdf?period=day|week&date=…[&userId=…]
router.get('/pdf', authenticateToken, async (req, res) => {
  try {
    const out = await reportFor(req);
    if (out.error) return res.status(out.status).json({ error: out.error });
    const r = out.report;
    const Branch = require('../models/Branch');
    const bid = r.kind === 'engineer' ? (await User.findOne({ id: r.engineer && r.engineer.id }).select('branchId').lean() || {}).branchId : null;
    const br = bid ? await Branch.findOne({ id: bid }).select('name').lean() : null;
    const { workReportPdf } = require('../services/workReportPdf');
    const pdf = await workReportPdf(r, { scopeName: br ? br.name : '', generatedFor: req.user.name || '' });
    const who = r.kind === 'engineer' ? (r.engineer && r.engineer.name) : r.kind === 'branch' ? (r.branch && r.branch.name) : 'All-branches';
    const name = `Gouru_${r.period === 'week' ? 'Weekly' : 'Daily'}_Report_${String(who || 'Report').replace(/[^A-Za-z0-9]+/g, '-')}_${r.ymd}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Whose report this login may see (engineer: own; branch admin: branch or one of its engineers; Super Admin: any)
async function reportFor(req) {
  const period = req.query.period === 'week' ? 'week' : 'day';
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : istParts(new Date()).ymd;
  const u = req.user;
  let scope;
  if (u.role === 'ENGINEER') scope = { userId: u.id };
  else if (u.role === 'BANK') return { status: 403, error: 'Not available.' };
  else if (req.query.userId) {
    const t = await User.findOne({ id: String(req.query.userId) }).select('id branchId').lean();
    if (!t || (!isSuper(u) && t.branchId !== u.branchId)) return { status: 403, error: 'Not allowed.' };
    scope = { userId: t.id };
  } else {
    const b = branchScope(req);
    scope = b ? { branchId: b } : {};
  }
  const report = await workReport(period, ymd, scope);
  return report ? { report } : { status: 404, error: 'Not found.' };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const period = req.query.period === 'week' ? 'week' : 'day';
    const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : istParts(new Date()).ymd;
    const u = req.user;
    let scope;
    if (u.role === 'ENGINEER') scope = { userId: u.id };
    else if (u.role === 'BANK') return res.status(403).json({ error: 'Not available.' });
    else if (req.query.userId) {
      const t = await User.findOne({ id: String(req.query.userId) }).select('id branchId').lean();
      if (!t || (!isSuper(u) && t.branchId !== u.branchId)) return res.status(403).json({ error: 'Not allowed.' });
      scope = { userId: t.id };
    } else {
      const b = branchScope(req);
      scope = b ? { branchId: b } : {};
    }
    const report = await workReport(period, ymd, scope);
    if (!report) return res.status(404).json({ error: 'Not found.' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
