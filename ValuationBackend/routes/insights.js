// Monthly report for admins: work done, time taken, engineers, banks, fees.
const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin, caseFilter } = require('../services/access');

router.use(authenticateToken);
router.use((req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ error: 'Admins only.' })));

const IST = 330 * 60000;
function monthRange(ym) {
  const [y, m] = (/^\d{4}-\d{2}$/.test(ym || '') ? ym : new Date(Date.now() + IST).toISOString().slice(0, 7)).split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - IST);
  const end = new Date(Date.UTC(y, m, 1) - IST);
  return { start, end, label: new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), ym: `${y}-${String(m).padStart(2, '0')}` };
}
const days = (a, b) => (new Date(b) - new Date(a)) / 86400000;
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const k = Math.floor(s.length / 2); return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

// GET /api/insights/monthly?month=YYYY-MM
router.get('/monthly', async (req, res) => {
  try {
    const { start, end, label, ym } = monthRange(req.query.month);
    const scope = caseFilter(req);
    const all = await ValuationCase.find(scope)
      .select('id fileNumber clientName bankName status createdAt approvedAt returnedAt assignedEngineerId assignedEngineerName inspectionDate inspectionTime valuation.fairMarketValue billing preCheck')
      .lean();
    const ids = all.map((c) => c.id);
    const versions = await ValuationCaseVersion.find({ caseId: { $in: ids } }).select('caseId version submittedAt adminDecision decisionAt').lean();
    const inMonth = (d) => d && new Date(d) >= start && new Date(d) < end;

    const created = all.filter((c) => inMonth(c.createdAt));
    const approved = all.filter((c) => c.status === 'Approved' && inMonth(c.approvedAt));
    const submittedV = versions.filter((v) => inMonth(v.submittedAt));
    const returnedV = versions.filter((v) => v.adminDecision === 'Returned' && inMonth(v.decisionAt));
    const firstSubmit = new Map();
    versions.forEach((v) => { if (v.submittedAt && (!firstSubmit.has(v.caseId) || new Date(v.submittedAt) < firstSubmit.get(v.caseId))) firstSubmit.set(v.caseId, new Date(v.submittedAt)); });

    // Time taken: request → approved, and request → first submit (field time)
    const turnaround = approved.map((c) => days(c.createdAt, c.approvedAt)).filter((d) => d >= 0);
    const fieldTime = approved.map((c) => (firstSubmit.has(c.id) ? days(c.createdAt, firstSubmit.get(c.id)) : null)).filter((d) => d != null && d >= 0);

    // Engineers
    const eng = {};
    const E = (c) => { const k = c.assignedEngineerName && c.assignedEngineerName !== 'Unknown' ? c.assignedEngineerName : null; if (k && !eng[k]) eng[k] = { name: k, approved: 0, submitted: 0, returned: 0, flagged: 0, days: [] }; return k && eng[k]; };
    approved.forEach((c) => { const e = E(c); if (!e) return; e.approved += 1; if (firstSubmit.has(c.id)) e.days.push(days(c.createdAt, firstSubmit.get(c.id))); if ((c.preCheck?.checks || []).length) e.flagged += 1; });
    const byId = new Map(all.map((c) => [c.id, c]));
    submittedV.forEach((v) => { const c = byId.get(v.caseId); const e = c && E(c); if (e) e.submitted += 1; });
    returnedV.forEach((v) => { const c = byId.get(v.caseId); const e = c && E(c); if (e) e.returned += 1; });
    const engineers = Object.values(eng).map((e) => ({ name: e.name, approved: e.approved, submitted: e.submitted, returned: e.returned, flagged: e.flagged, medianDays: r1(median(e.days)) }))
      .sort((a, b) => b.approved - a.approved);

    // Banks
    const bk = {};
    approved.forEach((c) => {
      const k = c.bankName || 'No bank';
      bk[k] = bk[k] || { bank: k, approved: 0, value: 0, billed: 0, received: 0 };
      bk[k].approved += 1; bk[k].value += Number(c.valuation?.fairMarketValue) || 0;
      const b = c.billing; if (b && b.status !== 'cancelled') { bk[k].billed += b.total || 0; bk[k].received += b.received || 0; }
    });
    created.forEach((c) => { const k = c.bankName || 'No bank'; bk[k] = bk[k] || { bank: k, approved: 0, value: 0, billed: 0, received: 0 }; bk[k].requests = (bk[k].requests || 0) + 1; });
    const banks = Object.values(bk).map((b) => ({ requests: 0, ...b })).sort((a, b) => b.approved - a.approved || b.requests - a.requests);

    // Money received in the month (by payment date), any invoice
    let receivedInMonth = 0;
    all.forEach((c) => (c.billing?.payments || []).forEach((p) => { if (inMonth(p.date)) receivedInMonth += Number(p.amount) || 0; }));
    const billed = approved.reduce((a, c) => a + (c.billing && c.billing.status !== 'cancelled' ? c.billing.total || 0 : 0), 0);
    const outstandingNow = all.reduce((a, c) => a + (c.billing && c.billing.status !== 'cancelled' ? Math.max(0, (c.billing.total || 0) - (c.billing.received || 0)) : 0), 0);

    const open = all.filter((c) => !['Approved', 'Rejected'].includes(c.status));
    res.json({
      month: ym, label,
      work: {
        requests: created.length, submitted: new Set(submittedV.map((v) => v.caseId)).size, approved: approved.length,
        returned: returnedV.length, returnRate: submittedV.length ? Math.round((returnedV.length / submittedV.length) * 100) : 0,
        openNow: open.length, valueApproved: approved.reduce((a, c) => a + (Number(c.valuation?.fairMarketValue) || 0), 0),
      },
      time: { medianTurnaroundDays: r1(median(turnaround)), medianFieldDays: r1(median(fieldTime)) },
      money: { billed, receivedInMonth, outstandingNow },
      engineers, banks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
