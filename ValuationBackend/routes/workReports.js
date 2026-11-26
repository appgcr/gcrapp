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
