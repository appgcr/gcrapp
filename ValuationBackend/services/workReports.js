// Daily and weekly work reports (India time): for an engineer (their own day/week), a branch (every engineer of
// the branch) or every branch (Super Admin). Sent automatically by services/reminders.js and shown in the app.
const ValuationCase = require('../models/ValuationCase');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { istParts, istDate, addDaysYMD } = require('./istTime');

const DAY = 86400000;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const isOpen = (c) => c.status !== 'Approved' && c.status !== 'Rejected';
const isAssigned = (c) => c.assignedEngineerId && c.assignedEngineerId !== 'UNASSIGNED';

/** 'day' | 'week' + an India date → { from, to, label, ymd } (a week runs Monday to Sunday) */
function rangeOf(period, ymd = istParts(new Date()).ymd) {
  if (period === 'week') {
    const idx = Math.max(0, DAYS.indexOf(istParts(istDate(ymd, 12 * 60)).weekday));
    const mon = addDaysYMD(ymd, -idx);
    const from = istDate(mon, 0);
    const sun = addDaysYMD(mon, 6);
    const fmt = (d) => istDate(d, 12 * 60).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
    return { period, ymd: mon, from, to: new Date(from.getTime() + 7 * DAY), label: `${fmt(mon)} – ${fmt(sun)}` };
  }
  const from = istDate(ymd, 0);
  const label = istDate(ymd, 12 * 60).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return { period: 'day', ymd, from, to: new Date(from.getTime() + DAY), label };
}

const time12 = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }) : '');

/** The numbers for a set of engineers over a range (one query per collection) */
async function engineerRows(engineers, range) {
  const ids = engineers.flatMap((e) => [e.id, e.username].filter(Boolean));
  const [att, subs, cases] = await Promise.all([
    Attendance.find({ userId: { $in: ids }, attendanceType: { $in: ['Clock-In', 'Clock-Out'] }, timestamp: { $gte: range.from, $lt: range.to } })
      .select('userId attendanceType timestamp workDurationHours missedCheckOut').sort({ timestamp: 1 }).lean(),
    ValuationCaseVersion.find({ submittedBy: { $in: ids }, submittedAt: { $gte: range.from, $lt: range.to } }).select('submittedBy version caseId').lean(),
    ValuationCase.find({ assignedEngineerId: { $in: ids } }).select('id assignedEngineerId status approvedAt returnedAt').lean(),
  ]);
  return engineers.map((e) => {
    const mine = (uid) => uid === e.id || uid === e.username;
    const a = att.filter((r) => mine(r.userId));
    const ins = a.filter((r) => r.attendanceType === 'Clock-In');
    const outs = a.filter((r) => r.attendanceType === 'Clock-Out');
    const s = subs.filter((v) => mine(v.submittedBy));
    const c = cases.filter((x) => mine(x.assignedEngineerId));
    const inRange = (d) => d && new Date(d) >= range.from && new Date(d) < range.to;
    return {
      id: e.id, name: e.name || e.username, branchId: e.branchId || null,
      daysPresent: new Set(ins.map((r) => istParts(new Date(r.timestamp)).ymd)).size,
      firstIn: ins[0] ? time12(ins[0].timestamp) : '',
      lastOut: outs.length ? time12(outs[outs.length - 1].timestamp) : '',
      onDutyNow: a.length > 0 && a[a.length - 1].attendanceType === 'Clock-In',
      hours: Math.round(outs.reduce((n, r) => n + (r.workDurationHours || 0), 0) * 10) / 10,
      missedCheckOut: outs.some((r) => r.missedCheckOut),
      siteVisits: s.filter((v) => v.version === 1).length,
      submitted: s.length,
      approved: c.filter((x) => inRange(x.approvedAt)).length,
      returned: c.filter((x) => inRange(x.returnedAt)).length,
      openNow: c.filter(isOpen).length,
    };
  });
}

const sum = (rows, k) => rows.reduce((n, r) => n + (r[k] || 0), 0);

/** Branch totals over a range (cases created / approved / returned, review queue, unassigned) */
async function branchTotals(branchIds, range, rows) {
  const filter = branchIds ? { branchId: { $in: branchIds } } : {};
  const cases = await ValuationCase.find(filter).select('branchId status assignedEngineerId createdAt approvedAt returnedAt').lean();
  const inRange = (d) => d && new Date(d) >= range.from && new Date(d) < range.to;
  return {
    engineers: rows.length,
    present: rows.filter((r) => r.daysPresent > 0).length,
    hours: Math.round(sum(rows, 'hours') * 10) / 10,
    siteVisits: sum(rows, 'siteVisits'),
    submitted: sum(rows, 'submitted'),
    newCases: cases.filter((c) => inRange(c.createdAt)).length,
    approved: cases.filter((c) => inRange(c.approvedAt)).length,
    returned: cases.filter((c) => inRange(c.returnedAt)).length,
    waitingReview: cases.filter((c) => c.status === 'Reviewing' || c.status === 'Completed').length,
    unassigned: cases.filter((c) => isOpen(c) && !isAssigned(c)).length,
    open: cases.filter(isOpen).length,
  };
}

/**
 * scope: { userId } (one engineer) | { branchId } (one branch) | {} (every branch)
 * → { period, label, kind: 'engineer'|'branch'|'all', engineer?, totals?, engineers?, branches? }
 */
async function workReport(period, ymd, scope = {}) {
  const range = rangeOf(period, ymd);
  const base = { period: range.period, ymd: range.ymd, label: range.label };
  if (scope.userId) {
    const e = await User.findOne({ id: scope.userId }).select('id username name branchId role').lean();
    if (!e) return null;
    const [row] = await engineerRows([e], range);
    return { ...base, kind: 'engineer', engineer: row };
  }
  const active = { role: 'ENGINEER', status: { $ne: 'Inactive' } };
  if (scope.branchId) {
    const b = await Branch.findOne({ id: scope.branchId }).select('id name').lean();
    const engineers = await User.find({ ...active, branchId: scope.branchId }).select('id username name branchId').lean();
    const rows = await engineerRows(engineers, range);
    return { ...base, kind: 'branch', branch: b ? { id: b.id, name: b.name } : { id: scope.branchId, name: '' }, totals: await branchTotals([scope.branchId], range, rows), engineers: rows };
  }
  const [branches, engineers] = await Promise.all([
    Branch.find({ status: { $ne: 'Inactive' } }).select('id name').sort({ name: 1 }).lean(),
    User.find(active).select('id username name branchId').lean(),
  ]);
  const rows = await engineerRows(engineers, range);
  const perBranch = [];
  for (const b of branches) {
    const r = rows.filter((x) => x.branchId === b.id);
    perBranch.push({ id: b.id, name: b.name, totals: await branchTotals([b.id], range, r) });
  }
  return { ...base, kind: 'all', totals: await branchTotals(null, range, rows), branches: perBranch, engineers: rows };
}

const hrs = (h) => { const m = Math.round((h || 0) * 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

/** One-line summary for the notification */
function summaryLine(r) {
  const when = r.period === 'week' ? 'This week' : 'Today';
  if (r.kind === 'engineer') {
    const e = r.engineer;
    return [
      r.period === 'week' ? `${e.daysPresent} day${e.daysPresent === 1 ? '' : 's'} present, ${hrs(e.hours)} on duty` : (e.daysPresent ? `${hrs(e.hours)} on duty${e.firstIn ? ` (in ${e.firstIn})` : ''}` : 'Not checked in'),
      `${e.siteVisits} site visit${e.siteVisits === 1 ? '' : 's'}`, `${e.submitted} report${e.submitted === 1 ? '' : 's'} submitted`,
      e.approved ? `${e.approved} approved` : null, e.returned ? `${e.returned} returned to fix` : null, `${e.openNow} open`,
    ].filter(Boolean).join(' · ').replace(/^/, `${when}: `);
  }
  const t = r.totals;
  const who = r.kind === 'branch' ? (r.branch?.name || 'Your branch') : 'All branches';
  return [
    `${t.present} of ${t.engineers} engineers ${r.period === 'week' ? 'worked' : 'present'}`, `${t.siteVisits} visits`, `${t.submitted} submitted`,
    `${t.approved} approved`, t.returned ? `${t.returned} returned` : null, `${t.waitingReview} waiting review`, t.unassigned ? `${t.unassigned} not assigned` : null,
  ].filter(Boolean).join(' · ').replace(/^/, `${who} ${when.toLowerCase()}: `);
}

module.exports = { workReport, summaryLine, rangeOf };
