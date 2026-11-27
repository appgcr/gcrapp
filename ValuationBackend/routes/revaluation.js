// Revaluation Radar (services/revaluation.js).
// GET  /api/revaluation/due[?all=1]      → { rows, totals } — Super Admin: every branch · branch admin: own branch ·
//                                          bank staff: properties they requested. all=1 also lists requested / dismissed.
// POST /api/revaluation/:id/request      → { case } new case for a fresh valuation (admins, or the bank staff member)
// POST /api/revaluation/:id/dismiss      → { ok } "not needed" (loan closed, sold…) — { reason }
// POST /api/revaluation/:id/restore      → { ok } undo "not needed" (admins)
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { isSuper, isBranchAdmin, isBank, canSeeCase } = require('../services/access');
const ValuationCase = require('../models/ValuationCase');
const rv = require('../services/revaluation');

const router = express.Router();
router.use(authenticateToken, (req, res, next) => (isSuper(req.user) || isBranchAdmin(req.user) || isBank(req.user)
  ? next() : res.status(403).json({ error: 'Only admins and bank staff can see revaluations.' })));

const scope = (u) => (isSuper(u) ? {} : isBank(u) ? { 'requestedBy.id': u.id } : { branchId: u.branchId || '__none__' });

router.get('/due', async (req, res) => {
  try {
    const rows = await rv.dueList(scope(req.user), { includeDone: String(req.query.all || '') === '1' });
    res.json({ rows, totals: rv.totals(rows.filter((r) => !r.state)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function ownCase(req, res) {
  const c = await ValuationCase.findOne({ id: req.params.id }).select('id branchId requestedBy status assignedEngineerId').lean();
  if (!c || !canSeeCase(req.user, c)) { res.status(404).json({ error: 'Case not found.' }); return null; }
  return c;
}

router.post('/:id/request', async (req, res) => {
  try {
    if (!(await ownCase(req, res))) return;
    const created = await rv.createRevaluationCase(req.params.id, req.user, req.body && req.body.note);
    res.status(201).json({ case: { id: created.id, fileNumber: created.fileNumber, clientName: created.clientName } });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/dismiss', async (req, res) => {
  try {
    if (!(await ownCase(req, res))) return;
    await rv.setState(req.params.id, req.user, 'dismissed', req.body && req.body.reason);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/restore', async (req, res) => {
  try {
    if (isBank(req.user)) return res.status(403).json({ error: 'Ask Gouru Valuations to restore it.' });
    const c = await ownCase(req, res); if (!c) return;
    const cur = await ValuationCase.findOne({ id: c.id }).select('reval').lean();
    if (cur && cur.reval && cur.reval.state === 'requested') return res.status(400).json({ error: 'A revaluation case already exists for it.' });
    await rv.setState(req.params.id, req.user, null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
