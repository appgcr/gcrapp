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
// ── Sharing on WhatsApp, one person at a time (free): each engineer / branch admin gets a private link to ONLY
// their own report PDF. The link is signed (cannot be changed to see someone else's) and works for 7 days, no login.
const crypto = require('crypto');
const SHARE_DAYS = 7;
const shareSecret = () => `work-report-share:${process.env.JWT_SECRET || require('../config/env').config.JWT_SECRET || 'dev_only_super_secure_jwt_secret_2026'}`;
const shareSig = (id, period, ymd, exp) => crypto.createHmac('sha256', shareSecret()).update(`${id}:${period}:${ymd}:${exp}`).digest('hex').slice(0, 32);
const scopeOfPerson = (u) => (u.role === 'ENGINEER' ? { userId: u.id } : u.role === 'ADMIN' ? { branchId: u.branchId } : {});
const baseUrlOf = (req) => `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;

// The person's own report PDF from a signed link (no login). Two forms of the same link:
//   short:  /r/BRA-001.d20261126.ksl3a2.8060c89bf16164bf   (what goes in WhatsApp)
//   long:   /api/work-report/shared/BRA-001?p=day&d=2026-11-26&e=…&s=…   (older messages)
async function servePersonReport(res, userId, period, ymd, exp, sig) {
  const want = /^\d{4}-\d{2}-\d{2}$/.test(ymd) && exp ? shareSig(userId, period, ymd, exp).slice(0, sig.length >= 32 ? 32 : 16) : '';
  if (!want || sig.length < 16 || want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig)) || exp * 1000 < Date.now()) {
    return res.status(403).type('text/plain').send('This report link has expired or is not valid. Please ask the office for a new one.');
  }
  const u = await User.findOne({ id: userId, status: { $ne: 'Inactive' } }).select('id name role branchId').lean();
  if (!u || !['ENGINEER', 'ADMIN'].includes(u.role)) return res.status(404).type('text/plain').send('Not found.');
  const r = await workReport(period, ymd, scopeOfPerson(u));
  if (!r) return res.status(404).type('text/plain').send('Not found.');
  const Branch = require('../models/Branch');
  const br = u.branchId ? await Branch.findOne({ id: u.branchId }).select('name').lean() : null;
  const { workReportPdf } = require('../services/workReportPdf');
  const pdf = await workReportPdf(r, { scopeName: br ? br.name : '', generatedFor: u.name || '' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Gouru_${period === 'week' ? 'Weekly' : 'Daily'}_Report_${String(u.name || 'Report').replace(/[^A-Za-z0-9]+/g, '-')}_${r.ymd}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.send(pdf);
}
const shortToken = (id, period, ymd, exp) => `${id}.${period === 'week' ? 'w' : 'd'}${ymd.replace(/-/g, '')}.${exp.toString(36)}.${shareSig(id, period, ymd, exp).slice(0, 16)}`;
async function serveShort(req, res) {
  try {
    const m = /^([A-Za-z0-9_-]+)\.([dw])(\d{8})\.([0-9a-z]+)\.([0-9a-f]{16})$/.exec(String(req.params.token || ''));
    if (!m) return res.status(403).type('text/plain').send('This report link is not valid. Please ask the office for a new one.');
    const ymd = `${m[3].slice(0, 4)}-${m[3].slice(4, 6)}-${m[3].slice(6, 8)}`;
    return await servePersonReport(res, m[1], m[2] === 'w' ? 'week' : 'day', ymd, parseInt(m[4], 36), m[5]);
  } catch (err) { return res.status(500).type('text/plain').send('Could not make the report.'); }
}
router.get('/r/:token', serveShort);
router.get('/shared/:userId', async (req, res) => {
  try {
    return await servePersonReport(res, req.params.userId, req.query.p === 'week' ? 'week' : 'day', String(req.query.d || ''), Number(req.query.e), String(req.query.s || ''));
  } catch (err) { return res.status(500).type('text/plain').send('Could not make the report.'); }
});

// WhatsApp message: bold title, one figure per line (easy to read on a phone)
function whatsappMessage(p, r, link) {
  const week = r.period === 'week';
  const lines = [`Hello ${p.name || 'there'} 👋`, `*Gouru Valuations — ${week ? 'Weekly' : 'Daily'} Performance Report*`,
    `📅 ${r.label}${p.branch ? `  ·  🏢 ${p.branch} Branch` : ''}`, ''];
  if (r.kind === 'engineer') {
    const e = r.engineer;
    lines.push(week ? `🗓️ Days present: *${e.daysPresent}* (${hrs(e.hours)} on duty)` : (e.daysPresent ? `🕘 On duty: *${hrs(e.hours)}*${e.firstIn ? ` (in ${e.firstIn})` : ''}` : '🕘 Not checked in'));
    lines.push(`📍 Site visits: *${e.siteVisits}*`, `📄 Reports submitted: *${e.submitted}*`, `✅ Approved: *${e.approved}*`);
    if (e.returned) lines.push(`🔁 Returned to fix: *${e.returned}*`);
    lines.push(`📂 Open cases: *${e.openNow}*`);
  } else {
    const t = r.totals;
    lines.push(`👷 Engineers ${week ? 'who worked' : 'present'}: *${t.present} of ${t.engineers}*`, `📍 Site visits: *${t.siteVisits}*`, `📄 Reports submitted: *${t.submitted}*`, `✅ Approved: *${t.approved}*`, `⏳ Waiting review: *${t.waitingReview}*`);
    if (t.returned) lines.push(`🔁 Returned to fix: *${t.returned}*`);
    if (t.unassigned) lines.push(`📌 Not assigned: *${t.unassigned}*`);
  }
  lines.push('', `📎 Full report (PDF): ${link}`, '', 'Thank you,', 'Gouru Valuations');
  return lines.join('\n');
}
const hrs = (h) => { const m = Math.round((h || 0) * 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

// GET /api/work-report/share-list?period=day|week&date=… — admins: each person's WhatsApp message with their own link
//   Super Admin → every engineer and branch admin (or the branch being viewed). Branch Admin → their engineers.
router.get('/share-list', authenticateToken, async (req, res) => {
  try {
    const u = req.user;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(u.role)) return res.status(403).json({ error: 'Admins only.' });
    const period = req.query.period === 'week' ? 'week' : 'day';
    const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : istParts(new Date()).ymd;
    const branchId = isSuper(u) ? branchScope(req) : u.branchId;
    const roles = isSuper(u) ? ['ENGINEER', 'ADMIN'] : ['ENGINEER'];
    const people = await User.find({ role: { $in: roles }, status: { $ne: 'Inactive' }, ...(branchId ? { branchId } : {}) }).select('id name role branchId phone').sort({ role: 1, name: 1 }).lean();
    const Branch = require('../models/Branch');
    const names = Object.fromEntries((await Branch.find({}).select('id name').lean()).map((b) => [b.id, b.name]));
    const { summaryLine } = require('../services/workReports');
    const { toWaNumber } = require('../services/whatsapp');
    const exp = Math.floor(Date.now() / 1000) + SHARE_DAYS * 86400;
    const base = baseUrlOf(req);
    const list = [];
    for (const p of people) {
      const r = await workReport(period, ymd, scopeOfPerson(p));
      if (!r) continue;
      const link = `${base}/r/${shortToken(p.id, period, r.ymd, exp)}`;
      const message = whatsappMessage({ name: p.name, branch: names[p.branchId] || '' }, r, link);
      list.push({ id: p.id, name: p.name, role: p.role === 'ADMIN' ? 'Branch Admin' : 'Engineer', branch: names[p.branchId] || '', phone: p.phone || '', wa: toWaNumber(p.phone), summary: summaryLine(r), message });
    }
    res.json({ period, people: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.serveShort = serveShort; // also at /r/:token (server.js) for a short link
module.exports = router;
