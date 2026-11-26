// Monthly report for admins: work done, time taken, engineers, banks, fees.
const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin, isSuper, caseFilter } = require('../services/access');

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
      .select('id fileNumber clientName bankName branchId status createdAt approvedAt returnedAt assignedEngineerId assignedEngineerName inspectionDate inspectionTime valuation.fairMarketValue billing preCheck')
      .lean();
    const ids = all.map((c) => c.id);
    const versions = await ValuationCaseVersion.find({ caseId: { $in: ids } }).select('caseId version submittedAt adminDecision decisionAt decisionComment').lean();
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

    // Why reports came back: each return with its reason (newest first), and the reasons grouped by topic
    const TOPICS = [['Photos / selfie / map', /photo|selfie|picture|image|map|gps|location/i], ['Documents', /deed|document|tax|plan|layout|ec\b|link doc|missing doc/i],
      ['Measurements / extent', /measure|extent|area|sq|cent|dimension|boundar/i], ['Rates / value', /rate|value|valuation|price|guideline|market|amount/i],
      ['Names / details', /name|s\/o|w\/o|address|survey|door|plot|ward/i], ['Building', /floor|plinth|age|construction|structure|building/i]];
    const returns = returnedV.map((v) => { const c = byId.get(v.caseId) || {}; return { caseId: v.caseId, fileNumber: c.fileNumber, clientName: c.clientName, engineer: c.assignedEngineerName, at: v.decisionAt, reason: String(v.decisionComment || '').slice(0, 300) }; })
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    const topics = {};
    returns.forEach((r) => { const t = (TOPICS.find(([, rx]) => rx.test(r.reason)) || ['Other'])[0]; topics[t] = (topics[t] || 0) + 1; });
    const returnTopics = Object.entries(topics).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);

    // Branches side by side (Super Admin, all branches)
    let branches = [];
    if (isSuper(req.user)) {
      const Branch = require('../models/Branch');
      const names = new Map((await Branch.find({}).select('id name').lean()).map((b) => [b.id, b.name]));
      const br = {};
      const B = (c) => { const k = c.branchId || 'none'; br[k] = br[k] || { branchId: k, name: names.get(k) || 'No branch', requests: 0, approved: 0, returned: 0, billed: 0, received: 0, outstanding: 0 }; return br[k]; };
      created.forEach((c) => { B(c).requests += 1; });
      approved.forEach((c) => { const x = B(c); x.approved += 1; const b = c.billing; if (b && b.status !== 'cancelled') { x.billed += b.total || 0; x.received += b.received || 0; } });
      returnedV.forEach((v) => { const c = byId.get(v.caseId); if (c) B(c).returned += 1; });
      all.forEach((c) => { const b = c.billing; if (b && b.status !== 'cancelled' && (b.total || 0) > (b.received || 0)) B(c).outstanding += (b.total || 0) - (b.received || 0); });
      branches = Object.values(br).filter((x) => x.requests || x.approved || x.returned || x.outstanding).sort((a, b) => b.approved - a.approved);
    }

    // Every change of where invoices are paid this month (account, UPI, QR) — firm default and each branch
    let paymentChanges = [];
    if (isSuper(req.user)) {
      const Branch = require('../models/Branch');
      const AppConfig = require('../models/AppConfig');
      const cfg = await AppConfig.findOne({ key: 'global' }).select('billing.paymentHistory').lean();
      const firmH = ((cfg && cfg.billing && cfg.billing.paymentHistory) || []).map((h) => ({ ...h, where: 'Firm default' }));
      const brs = await Branch.find({}).select('name payment.history').lean();
      const brH = brs.flatMap((b) => ((b.payment && b.payment.history) || []).map((h) => ({ ...h, where: `${b.name} branch` })));
      paymentChanges = [...firmH, ...brH].filter((h) => inMonth(h.at))
        .map((h) => ({ at: h.at, byName: h.byName, where: h.where, changed: (h.changed || []).map((c) => `${c.field}: ${c.from || '-'} → ${c.to || '-'}`) }))
        .sort((a, b) => new Date(b.at) - new Date(a.at));
    }

    const open = all.filter((c) => !['Approved', 'Rejected'].includes(c.status));
    res.json({
      returns: returns.slice(0, 50), returnTopics, branches, paymentChanges,
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
