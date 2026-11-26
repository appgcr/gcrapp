/**
 * Gouru Valuations System — Automatic reminder scheduler
 *
 * Runs on the backend (works even when phones/apps are closed). Every minute it
 * checks five rules in India Standard Time and sends alerts through notify()
 * (in-app bell + phone push):
 *
 *   1. Morning digest      → Admin      at settings.morningDigest.time   (default 08:30)
 *   2. Check-in reminder   → Engineer   at settings.checkIn.time         (default 09:30)
 *                            only engineers with open assigned cases and no Clock-In today
 *   3. Inspection reminder → Engineer   settings.inspection.minutesBefore (default 60) before
 *                            the case's inspection date + time
 *   4. Overdue alerts      → Admin      once a day per case, during working hours:
 *                            unassigned > unassignedHours, awaiting review > reviewHours
 *   5. Check-out reminder  → Engineer   at settings.checkOut.time        (default 19:00)
 *                            only if still checked in
 *
 * Rules: Sundays skipped (setting), nothing non-urgent outside 08:00–20:00 IST,
 * and every reminder is sent at most once (ReminderLog key claimed before sending).
 */

const ValuationCase = require('../models/ValuationCase');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const ReminderLog = require('../models/ReminderLog');
const ReminderSettings = require('../models/ReminderSettings');
const { notify, releaseHeld } = require('./notify');

const { IST_OFFSET_MIN, istParts, toMinutes, fmt12 } = require('./istTime');

const TICK_MS = 60 * 1000;
const CATCH_UP_MIN = 20; // if the server was briefly down, still send within 20 min of the set time
const WORK_START = 7 * 60;   // digests may go out from 7 AM (personal timing)
const WORK_END = 20 * 60;
const HOUR = 3600 * 1000;
const DIGEST_LEAD_MIN = 15;  // personal summary arrives 15 min before the usual start
const DIGEST_EARLIEST = 7 * 60;
const DIGEST_LATEST = 10 * 60 + 30;
const MIN_SAMPLES = 3;       // need at least 3 days of history before personalising

// Start of an IST calendar day as a real Date
function istDayStart(ymd) {
  const [y, mo, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0) - IST_OFFSET_MIN * 60000);
}

// Parse a case's inspection date + time (IST) → Date, accepting common formats
function parseInspection(dateStr, timeStr) {
  const ds = String(dateStr || '').trim();
  let y; let mo; let d;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(ds);
  if (m) { [, y, mo, d] = m.map(Number); } else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(ds); // DD/MM/YYYY
    if (!m) return null;
    [, d, mo, y] = m.map(Number);
  }
  const ts = String(timeStr || '').trim().toUpperCase();
  const t = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/.exec(ts);
  if (!t) return null;
  let hh = Number(t[1]);
  const mm = Number(t[2]);
  if (t[3] === 'PM' && hh < 12) hh += 12;
  if (t[3] === 'AM' && hh === 12) hh = 0;
  return new Date(Date.UTC(y, mo - 1, d, hh, mm) - IST_OFFSET_MIN * 60000);
}

// "Due" if now is at/after the target time but within the catch-up window
const isDue = (nowMin, targetMin) => targetMin !== null && nowMin >= targetMin && nowMin < targetMin + CATCH_UP_MIN;

const isOpen = (c) => c.status !== 'Approved' && c.status !== 'Rejected';
const isAssigned = (c) => c.assignedEngineerId && c.assignedEngineerId !== 'UNASSIGNED';

// Claim a reminder key; returns false if it was already sent (by us or another instance)
async function claim(key, rule, sentTo) {
  try {
    await ReminderLog.create({ key, rule, sentTo });
    return true;
  } catch (err) {
    if (err && err.code === 11000) return false;
    throw err;
  }
}

async function send(key, rule, payload) {
  if (!(await claim(key, rule, payload.to))) return false;
  await notify(payload);
  return true;
}

async function getSettings() {
  let s = await ReminderSettings.findOne({ key: 'reminders' });
  if (!s) s = await ReminderSettings.create({ key: 'reminders' });
  return s;
}

// Latest Clock-In / Clock-Out per user for an IST day
async function dutyStateByUser(ymd) {
  const start = istDayStart(ymd);
  const end = new Date(start.getTime() + 24 * HOUR);
  const rows = await Attendance.find({
    timestamp: { $gte: start, $lt: end },
    attendanceType: { $in: ['Clock-In', 'Clock-Out'] },
  }).sort({ timestamp: 1 }).lean();
  const state = new Map();
  rows.forEach((r) => {
    const s = state.get(r.userId) || { checkedIn: false, last: null };
    if (r.attendanceType === 'Clock-In') s.checkedIn = true;
    s.last = r.attendanceType;
    state.set(r.userId, s);
  });
  return state;
}

// ---------- the five rules ----------

// ---------- personal timing ----------

const startCache = new Map(); // `${ymd}:${userId}` → minutes | null (computed once per day)

const median = (arr) => {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

/**
 * A person's usual start of day (minutes after midnight, IST), learned from:
 *   engineers → their first Clock-In each day (last 21 days)
 *   everyone  → their first app-open each day (User.activityLog)
 * Returns null until there are at least 3 days of history.
 */
async function usualStartMinutes(user, ymd, now) {
  const key = `${ymd}:${user.id}`;
  if (startCache.has(key)) return startCache.get(key);
  let samples = [];
  if (user.role === 'ENGINEER') {
    const since = new Date(now.getTime() - 21 * 24 * HOUR);
    const rows = await Attendance.find({ userId: user.id, attendanceType: 'Clock-In', timestamp: { $gte: since } })
      .select('timestamp').sort({ timestamp: 1 }).lean();
    const firstPerDay = new Map();
    rows.forEach((r) => { const p = istParts(new Date(r.timestamp)); if (p.ymd !== ymd && !firstPerDay.has(p.ymd)) firstPerDay.set(p.ymd, p.minutes); });
    samples = [...firstPerDay.values()];
  }
  if (samples.length < MIN_SAMPLES) {
    samples = (user.activityLog || [])
      .map((d) => istParts(new Date(d)))
      .filter((p) => p.ymd !== ymd)
      .map((p) => p.minutes);
  }
  const value = samples.length >= MIN_SAMPLES ? median(samples) : null;
  startCache.set(key, value);
  if (startCache.size > 2000) startCache.clear();
  return value;
}

// When this person's morning summary is due today, and why
async function digestTimeFor(user, fallbackHHMM, ctx) {
  const fallback = toMinutes(fallbackHHMM);
  if (!ctx.settings.personalTiming) return { minutes: fallback, personal: false };
  const usual = await usualStartMinutes(user, ctx.ist.ymd, ctx.now);
  if (usual === null) return { minutes: fallback, personal: false };
  const t = Math.min(DIGEST_LATEST, Math.max(DIGEST_EARLIEST, usual - DIGEST_LEAD_MIN));
  return { minutes: t, personal: true };
}

const inspectionsToday = (cases, ymd) => cases
  .filter((c) => isOpen(c))
  .map((c) => ({ c, at: parseInspection(c.inspectionDate, c.inspectionTime) }))
  .filter(({ at }) => at && istParts(at).ymd === ymd)
  .sort((a, b) => a.at - b.at);

// ---------- the rules ----------

// On duty but the phone has gone quiet (location off, phone off, app killed) → tell the
// branch admin and the engineer, once per silent spell. Runs at any hour while someone is on duty.
const SILENT_MIN = 10;
async function ruleLocationSilence(ctx) {
  let count = 0;
  for (const e of ctx.engineers) {
    const lastDuty = await Attendance.findOne({ userId: e.id, attendanceType: { $in: ['Clock-In', 'Clock-Out'] } })
      .sort({ timestamp: -1 }).select('attendanceType timestamp').lean();
    if (lastDuty?.attendanceType !== 'Clock-In') continue;
    const lastSeen = await Attendance.findOne({ userId: e.id, timestamp: { $gte: lastDuty.timestamp } })
      .sort({ timestamp: -1 }).select('timestamp').lean();
    const at = new Date(lastSeen?.timestamp || lastDuty.timestamp);
    const mins = Math.floor((ctx.now.getTime() - at.getTime()) / 60000);
    if (mins < SILENT_MIN) continue;
    const key = `loc-silent:${e.id}:${at.getTime()}`;
    const name = e.name || e.username;
    const sentAdmin = await send(key, 'locationSilence', {
      to: 'ADMIN', branchId: e.branchId || null, type: 'location_silent', priority: 'urgent', now: ctx.now,
      title: 'No location from engineer',
      message: `${name} is on duty but no location for ${mins} min. Location may be off, or the phone is switched off.`,
    });
    if (sentAdmin) {
      await send(`${key}:self`, 'locationSilence', {
        to: e.id, type: 'location_silent', priority: 'urgent', now: ctx.now,
        title: 'Turn on your location',
        message: 'You are on duty but your location is not reaching the office. Open Gouru Valuations and keep location on.',
      });
      count += 1;
    }
  }
  return count;
}

async function ruleMorningDigest(ctx) {
  const { settings, ist, admins } = ctx;
  if (!settings.morningDigest.enabled) return 0;

  let count = 0;
  for (const a of admins) {
    // Super Admin: every branch. Branch Admin: only their own branch.
    const cases = a.role === 'ADMIN' ? ctx.cases.filter((c) => c.branchId === a.branchId) : ctx.cases;
    const engineers = a.role === 'ADMIN' ? ctx.engineers.filter((e) => e.branchId === a.branchId) : ctx.engineers;
  const review = cases.filter((c) => isAssigned(c) && (c.status === 'Reviewing' || c.status === 'Completed')).length;
  const unassigned = cases.filter((c) => isOpen(c) && !isAssigned(c)).length;
  const returned = cases.filter((c) => c.status === 'Returned').length;
  const todays = inspectionsToday(cases, ist.ymd).length;
  const message = [
    `${review} awaiting review`,
    `${unassigned} unassigned`,
    returned ? `${returned} returned` : null,
    `${todays} inspection${todays === 1 ? '' : 's'} today`,
    `${engineers.length} engineer${engineers.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

    const { minutes } = await digestTimeFor(a, settings.morningDigest.time, ctx);
    if (!isDue(ist.minutes, minutes)) continue;
    const first = (a.name || '').split(' ')[0];
    const sent = await send(`digest:${a.id}:${ist.ymd}`, 'morningDigest', {
      to: a.id, type: 'morning_digest', priority: 'digest', now: ctx.now,
      title: first && first.toLowerCase() !== 'super' ? `Good morning, ${first}` : 'Good morning — today at Gouru Valuations',
      message,
    });
    if (sent) count += 1;
  }
  return count;
}

async function ruleEngineerDigest(ctx) {
  const { settings, ist, cases, engineers } = ctx;
  if (!settings.engineerDigest?.enabled) return 0;
  const today = inspectionsToday(cases, ist.ymd);
  let count = 0;
  for (const e of engineers) {
    const mine = cases.filter((c) => isOpen(c) && (c.assignedEngineerId === e.id || c.assignedEngineerId === e.username));
    if (mine.length === 0) continue; // nothing to say → no message
    const { minutes } = await digestTimeFor(e, settings.engineerDigest.time, ctx);
    if (!isDue(ist.minutes, minutes)) continue;
    const myInspections = today.filter(({ c }) => c.assignedEngineerId === e.id || c.assignedEngineerId === e.username);
    const returned = mine.filter((c) => c.status === 'Returned').length;
    const parts = [
      `${mine.length} open case${mine.length === 1 ? '' : 's'}`,
      returned ? `${returned} to correct` : null,
      myInspections.length
        ? `inspection${myInspections.length > 1 ? 's' : ''} at ${myInspections.map(({ c, at }) => `${fmt12(istParts(at).minutes)} (${c.clientName || `#${c.id}`})`).join(', ')}`
        : 'no inspections booked today',
    ].filter(Boolean);
    const first = (e.name || e.username || '').split(' ')[0];
    const sent = await send(`edigest:${e.id}:${ist.ymd}`, 'engineerDigest', {
      to: e.id, type: 'morning_digest', priority: 'digest', now: ctx.now,
      title: first ? `Good morning, ${first}` : 'Good morning',
      message: parts.join(' · '),
    });
    if (sent) count += 1;
  }
  return count;
}

async function ruleCheckIn(ctx) {
  const { settings, ist, cases, engineers, duty } = ctx;
  if (!settings.checkIn.enabled || !isDue(ist.minutes, toMinutes(settings.checkIn.time))) return 0;
  let count = 0;
  for (const e of engineers) {
    const openWork = cases.filter((c) => isOpen(c) && (c.assignedEngineerId === e.id || c.assignedEngineerId === e.username));
    if (openWork.length === 0) continue;               // nothing to do today → don't nag
    if (duty.get(e.id)?.checkedIn) continue;            // already checked in
    const sent = await send(`checkin:${e.id}:${ist.ymd}`, 'checkIn', {
      to: e.id, type: 'checkin_reminder', priority: 'urgent', now: ctx.now,
      title: "You haven't checked in yet",
      message: `You have ${openWork.length} open case${openWork.length === 1 ? '' : 's'}. Check in to start your day.`,
    });
    if (sent) count += 1;
  }
  return count;
}

async function ruleInspection(ctx) {
  const { settings, now, cases } = ctx;
  if (!settings.inspection.enabled) return 0;
  const lead = settings.inspection.minutesBefore * 60000;
  let count = 0;
  for (const c of cases) {
    if (!isOpen(c) || !isAssigned(c)) continue;
    const at = parseInspection(c.inspectionDate, c.inspectionTime);
    if (!at) continue;
    const remindAt = at.getTime() - lead;
    // window: from remindAt until the inspection starts
    if (now.getTime() < remindAt || now.getTime() >= at.getTime()) continue;
    const mins = Math.max(1, Math.round((at.getTime() - now.getTime()) / 60000));
    const sent = await send(`inspect:${c.id}:${c.inspectionDate}:${c.inspectionTime}`, 'inspection', {
      to: c.assignedEngineerId, type: 'inspection_reminder', caseId: c.id, priority: 'urgent', now,
      title: `Inspection in ${mins >= 60 ? `${Math.round(mins / 60)} hr` : `${mins} min`}`,
      message: `${fmt12(istParts(at).minutes)} — ${c.clientName || `Case #${c.id}`}${c.address ? `, ${c.address.split(',').slice(0, 2).join(',').trim()}` : ''}.`,
    });
    if (sent) count += 1;
  }
  return count;
}

async function ruleOverdue(ctx) {
  const { settings, ist, now, cases } = ctx;
  if (!settings.overdue.enabled) return 0;
  if (ist.minutes < 9 * 60 || ist.minutes >= 19 * 60) return 0; // admin alerts in office hours only
  let count = 0;

  // Unassigned for too long
  const unassignedLimit = settings.overdue.unassignedHours * HOUR;
  for (const c of cases) {
    if (!isOpen(c) || isAssigned(c)) continue;
    const created = new Date(c.createdAt).getTime();
    if (Number.isNaN(created) || now.getTime() - created < unassignedLimit) continue;
    const hrs = Math.floor((now.getTime() - created) / HOUR);
    const sent = await send(`overdue-unassigned:${c.id}:${ist.ymd}`, 'overdue', {
      to: 'ADMIN', branchId: c.branchId || null, type: 'overdue_unassigned', caseId: c.id, priority: 'normal', now,
      title: 'Case waiting for a valuer',
      message: `Case ${c.fileNumber || `#${c.id}`}${c.clientName ? ` · ${c.clientName}` : ''} has been unassigned for ${hrs >= 48 ? `${Math.floor(hrs / 24)} days` : `${hrs} hrs`}.`,
    });
    if (sent) count += 1;
  }

  // Awaiting review for too long (time since the latest submission)
  const reviewLimit = settings.overdue.reviewHours * HOUR;
  const inReview = cases.filter((c) => isAssigned(c) && (c.status === 'Reviewing' || c.status === 'Completed'));
  for (const c of inReview) {
    const v = await ValuationCaseVersion.findOne({ caseId: c.id }).sort({ version: -1 }).select('submittedAt').lean();
    const submitted = v?.submittedAt ? new Date(v.submittedAt).getTime() : NaN;
    if (Number.isNaN(submitted) || now.getTime() - submitted < reviewLimit) continue;
    const hrs = Math.floor((now.getTime() - submitted) / HOUR);
    const sent = await send(`overdue-review:${c.id}:${ist.ymd}`, 'overdue', {
      to: 'ADMIN', branchId: c.branchId || null, type: 'overdue_review', caseId: c.id, priority: 'normal', now,
      title: 'Report waiting for your review',
      message: `Case ${c.fileNumber || `#${c.id}`}${c.clientName ? ` · ${c.clientName}` : ''} was submitted ${hrs >= 48 ? `${Math.floor(hrs / 24)} days` : `${hrs} hrs`} ago.`,
    });
    if (sent) count += 1;
  }
  return count;
}

async function ruleCheckOut(ctx) {
  const { settings, ist, engineers, duty } = ctx;
  if (!settings.checkOut.enabled || !isDue(ist.minutes, toMinutes(settings.checkOut.time))) return 0;
  let count = 0;
  for (const e of engineers) {
    if (duty.get(e.id)?.last !== 'Clock-In') continue; // only those still checked in
    const sent = await send(`checkout:${e.id}:${ist.ymd}`, 'checkOut', {
      to: e.id, type: 'checkout_reminder', priority: 'urgent', now: ctx.now,
      title: 'Still checked in',
      message: "Remember to check out when you finish for the day. Location sharing stops when you check out.",
    });
    if (sent) count += 1;
  }
  return count;
}

// Engineer has a case assigned 2+ hours ago, is on duty, and has not told the customer or started → nudge once a day
async function ruleVisitNudge(ctx) {
  const { ist, now, cases, duty } = ctx;
  if (ist.minutes < 10 * 60 || ist.minutes >= 18 * 60) return 0;
  let count = 0;
  for (const c of cases) {
    if (c.status !== 'Pending' || !isAssigned(c)) continue;
    const assignedAt = parseInspection(c.inspectionDate, c.inspectionTime);
    if (!assignedAt || now.getTime() - assignedAt.getTime() < 2 * HOUR) continue;
    if (c.customerNotified && c.customerNotified.at && istParts(new Date(c.customerNotified.at)).ymd === ist.ymd) continue;
    const eng = ctx.engineers.find((e) => e.id === c.assignedEngineerId || e.username === c.assignedEngineerId);
    if (!eng || !duty.get(eng.id)?.checkedIn) continue;
    const sent = await send(`visitnudge:${c.id}:${ist.ymd}`, 'visitNudge', {
      to: eng.id, type: 'visit_nudge', caseId: c.id, priority: 'normal', now,
      title: 'Plan your site visit',
      message: `${c.clientName || `Case #${c.id}`}: tap “Tell customer I'm coming” when you leave so they wait at the site.`,
    });
    if (sent) count += 1;
  }
  return count;
}

// End-of-day summary for admins (Super Admin: all branches, Branch Admin: their own)
const EVENING_AT = 19 * 60 + 30; // 7:30 PM IST
async function ruleEveningSummary(ctx) {
  const { ist, now, admins } = ctx;
  if (!isDue(ist.minutes, EVENING_AT)) return 0;
  const start = istDayStart(ist.ymd);
  const [subs, cases] = await Promise.all([
    ValuationCaseVersion.find({ submittedAt: { $gte: start } }).select('caseId').lean(),
    ValuationCase.find({}).select('id branchId fileNumber clientName status approvedAt returnedAt assignedEngineerId assignedEngineerName inspectionDate inspectionTime createdAt').lean(),
  ]);
  const byId = new Map(cases.map((c) => [c.id, c]));
  let count = 0;
  for (const a of admins) {
    const mine = (c) => c && (a.role !== 'ADMIN' || c.branchId === a.branchId);
    const submitted = new Set(subs.map((v) => v.caseId).filter((id) => mine(byId.get(id)))).size;
    const own = cases.filter(mine);
    const approved = own.filter((c) => c.approvedAt && new Date(c.approvedAt) >= start).length;
    const returned = own.filter((c) => c.returnedAt && new Date(c.returnedAt) >= start).length;
    const waiting = own.filter((c) => c.status === 'Reviewing' || c.status === 'Completed').length;
    const stuck = own.filter((c) => {
      if ((c.status !== 'Pending' && c.status !== 'Returned') || !isAssigned(c)) return false;
      const since = (c.status === 'Returned' && c.returnedAt) ? new Date(c.returnedAt) : (parseInspection(c.inspectionDate, c.inspectionTime) || new Date(c.createdAt));
      return now.getTime() - since.getTime() > 48 * HOUR;
    });
    const unassigned = own.filter((c) => isOpen(c) && !isAssigned(c)).length;
    const parts = [
      `Today: ${submitted} submitted, ${approved} approved${returned ? `, ${returned} returned` : ''}`,
      `${waiting} waiting for your review`,
      unassigned ? `${unassigned} not assigned` : null,
      stuck.length ? `${stuck.length} stuck over 2 days (${stuck.slice(0, 3).map((c) => c.fileNumber || `#${c.id}`).join(', ')}${stuck.length > 3 ? '…' : ''})` : 'nothing stuck',
    ].filter(Boolean);
    const sent = await send(`evening:${a.id}:${ist.ymd}`, 'eveningSummary', {
      to: a.id, type: 'evening_summary', priority: 'digest', now,
      title: 'Today at Gouru Valuations', message: parts.join(' · '),
    });
    if (sent) count += 1;
  }
  return count;
}

// Unpaid invoices: reminders 7 days after the invoice, on the due date (15), then every 7 days (until 90).
// Bank users get a notification (bank portal + phone), the bank branch an email with the invoice when
// email is set up, and each admin one daily list with one-tap WhatsApp messages in Fees.
const INVOICE_AT = 10 * 60 + 30; // 10:30 AM IST
const INVOICE_DAYS = [7, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78, 85];
async function ruleInvoiceReminders(ctx) {
  const { ist, now, admins } = ctx;
  if (!isDue(ist.minutes, INVOICE_AT)) return 0;
  const billing = require('./billing');
  const { emailReady, contactFor } = require('./reportDelivery');
  const base = process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || 'https://gcrapp-api.onrender.com';
  const open = await ValuationCase.find({ 'billing.invoiceNo': { $exists: true }, 'billing.status': { $ne: 'cancelled' }, 'billing.total': { $gt: 0 } })
    .select('id fileNumber clientName clientPhone bankName bankBranch bankId branchId requestedBy billing approvedAt propertyDetails.propertyType').lean();
  const unpaid = open.filter((c) => billing.dueOf(c.billing) > 0);
  let count = 0;
  const overdueByBranch = new Map();
  for (const c of unpaid) {
    // Calendar days in India time (an evening invoice is 'day 7' on the 7th morning after)
    const days = Math.round((Date.parse(ist.ymd) - Date.parse(istParts(new Date(c.billing.invoiceDate)).ymd)) / 86400000);
    if (days >= 15) { const list = overdueByBranch.get(c.branchId) || []; list.push(c); overdueByBranch.set(c.branchId, list); }
    if (!INVOICE_DAYS.includes(days)) continue;
    const key = `invoice:${c.id}:${c.billing.invoiceNo}:d${days}`;
    if (!(await claim(key, 'invoiceReminder', 'bank'))) continue;
    const amount = `Rs. ${billing.dueOf(c.billing).toLocaleString('en-IN')}`;
    // Bank employees: the one who asked for it, and the bank's users at that branch
    const bankUsers = await User.find({ role: 'BANK', status: { $ne: 'Inactive' }, $or: [
      ...(c.requestedBy && c.requestedBy.id ? [{ id: c.requestedBy.id }] : []),
      { bankName: c.bankName, bankBranch: c.bankBranch, branchId: c.branchId },
    ] }).select('id').lean();
    for (const u of bankUsers) {
      await notify({ to: u.id, type: 'invoice_due', caseId: c.id, priority: days >= 15 ? 'high' : 'normal', now,
        title: days >= 15 ? `Payment overdue: ${amount}` : `Payment reminder: ${amount}`,
        message: `Invoice ${c.billing.invoiceNo} · ${c.fileNumber} · ${c.clientName}. Open the app to pay by UPI or see bank details.` }).catch(() => {});
    }
    // Email to the bank branch with the invoice attached
    if (emailReady()) {
      try { const ct = await contactFor(c); if (ct.email) await billing.emailInvoice(c, { to: ct.email, link: billing.payLink(base, c), reminder: days }); } catch (err) { console.warn('invoice reminder email:', err.message); }
    }
    await ValuationCase.updateOne({ id: c.id }, { $push: { 'billing.reminders': { at: now, day: days, bankUsers: bankUsers.length, email: emailReady() } } });
    count += 1;
  }
  // Admins: one list a day of overdue invoices, each one tap to send on WhatsApp from Fees
  for (const a of admins) {
    const mine = a.role === 'SUPER_ADMIN' ? [...overdueByBranch.values()].flat() : (overdueByBranch.get(a.branchId) || []);
    if (!mine.length) continue;
    const total = mine.reduce((n, c) => n + billing.dueOf(c.billing), 0);
    await send(`invoiceOverdue:${a.id}:${ist.ymd}`, 'invoiceOverdue', {
      to: a.id, type: 'invoice_overdue', priority: 'normal', now,
      title: `${mine.length} unpaid invoice${mine.length === 1 ? '' : 's'} · Rs. ${total.toLocaleString('en-IN')}`,
      message: `${mine.slice(0, 3).map((c) => c.billing.invoiceNo).join(', ')}${mine.length > 3 ? '…' : ''} — open Fees → Unpaid to send WhatsApp reminders.`,
    });
  }
  return count;
}

// ---------- runner ----------

/**
 * Run all rules once. `now` can be overridden for testing.
 * Returns a summary of how many reminders each rule sent.
 */
// Daily (every working day) and weekly (on its set day) work report to every engineer, branch admin and
// Super Admin: one notification with the key numbers; tapping it opens the full report in the app.
async function ruleWorkReports(ctx, period) {
  const { settings, ist, now, engineers, admins } = ctx;
  const cfg = period === 'week' ? settings.weeklyReport : settings.dailyReport;
  if (!cfg?.enabled) return 0;
  if (period === 'week' && ist.weekday !== (cfg.day || 'Sat')) return 0;
  if (!isDue(ist.minutes, toMinutes(cfg.time || '20:00'))) return 0;
  const { workReport, summaryLine } = require('./workReports');
  const type = period === 'week' ? 'weekly_report' : 'daily_report';
  const word = period === 'week' ? 'weekly' : 'daily';
  const Title = period === 'week' ? 'Weekly report' : 'Daily report';
  let count = 0;
  const deliver = async (person, scope, title) => {
    const r = await workReport(period, ist.ymd, scope);
    if (!r) return;
    const sent = await send(`${type}:${person.id}:${ist.ymd}`, `${word}Report`, {
      to: person.id, type, priority: 'digest', now, title, message: summaryLine(r),
    });
    if (sent) count += 1;
  };
  for (const e of engineers) await deliver(e, { userId: e.id }, `Your ${word} report`);
  const Branch = require('../models/Branch');
  const names = Object.fromEntries((await Branch.find({}).select('id name').lean()).map((b) => [b.id, b.name]));
  for (const a of admins) {
    if (a.role === 'ADMIN') { if (a.branchId) await deliver(a, { branchId: a.branchId }, `${Title} — ${names[a.branchId] || 'your branch'}`); }
    else await deliver(a, {}, `${Title} — all branches`);
  }
  return count;
}

async function runReminders(now = new Date()) {
  const settings = await getSettings();
  const ist = istParts(now);
  const summary = { at: now.toISOString(), ist: `${ist.ymd} ${fmt12(ist.minutes)}`, skipped: null, sent: {} };

  // Deliver phone pushes that were held during quiet hours (runs even if reminders are off)
  summary.sent.releasedHeld = await releaseHeld(now);

  // A check-in left open at the end of the day is closed by the system (always on)
  try { summary.sent.autoCheckout = await require('./autoCheckout').runAutoCheckout(now); } catch (err) { console.warn('auto check-out:', err.message); }

  // Duty location check is a safety rule — it runs even when reminders are switched off
  try {
    const onDutyStaff = await User.find({ role: 'ENGINEER', status: { $ne: 'Inactive' } }).select('id username name branchId').lean();
    summary.sent.locationSilence = await ruleLocationSilence({ now, engineers: onDutyStaff });
  } catch (err) { console.warn('location check:', err.message); }

  if (!settings.enabled) { summary.skipped = 'disabled'; return summary; }

  const [cases, engineers, duty] = await Promise.all([
    ValuationCase.find({}).select('id fileNumber branchId clientName address bankName status assignedEngineerId assignedEngineerName createdAt inspectionDate inspectionTime customerNotified').lean(),
    User.find({ role: { $in: ['ENGINEER', 'ADMIN', 'SUPER_ADMIN'] }, status: { $ne: 'Inactive' } }).select('id username name role branchId activityLog').lean(),
    dutyStateByUser(ist.ymd),
  ]);
  const people = engineers; // all active staff
  const ctx = {
    settings, now, ist, cases, duty,
    engineers: people.filter((u) => u.role === 'ENGINEER'),
    admins: people.filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN'),
  };

  // Inspection reminders are time-critical and may run early/late in the day;
  // everything else stays inside working hours.
  // An actual booked inspection is reminded any day (even Sunday).
  summary.sent.inspection = await ruleInspection(ctx);
  // Weekly work report on its own day (even if that is a Sunday)
  try { summary.sent.weeklyReport = await ruleWorkReports(ctx, 'week'); } catch (err) { console.warn('weekly report:', err.message); }
  if (settings.skipSundays && ist.weekday === 'Sun') { summary.skipped = 'sunday (only inspection reminders run)'; return summary; }
  // Daily work report (8 PM by default — after the working-hours rules below stop)
  try { summary.sent.dailyReport = await ruleWorkReports(ctx, 'day'); } catch (err) { console.warn('daily report:', err.message); }
  if (ist.minutes >= WORK_START && ist.minutes < WORK_END) {
    summary.sent.morningDigest = await ruleMorningDigest(ctx);
    summary.sent.engineerDigest = await ruleEngineerDigest(ctx);
    summary.sent.checkIn = await ruleCheckIn(ctx);
    summary.sent.overdue = await ruleOverdue(ctx);
    summary.sent.checkOut = await ruleCheckOut(ctx);
    summary.sent.visitNudge = await ruleVisitNudge(ctx);
    // The one-line evening summary only while the fuller daily report is switched off
    if (!settings.dailyReport?.enabled) summary.sent.eveningSummary = await ruleEveningSummary(ctx);
    try { summary.sent.invoiceReminders = await ruleInvoiceReminders(ctx); } catch (err) { console.warn('invoice reminders:', err.message); }
  }
  return summary;
}

let timer = null;
let running = false;

function startReminderScheduler() {
  if (timer) return;
  const tick = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const s = await runReminders();
      const total = Object.values(s.sent).reduce((a, b) => a + b, 0);
      if (total > 0) console.log(`⏰ Reminders sent at ${s.ist}:`, JSON.stringify(s.sent));
    } catch (err) {
      console.warn('⚠️ Reminder run failed:', err.message);
    } finally {
      running = false;
    }
  };
  // First run shortly after boot, then every minute
  setTimeout(tick, 15 * 1000);
  timer = setInterval(tick, TICK_MS);
  console.log('⏰ Reminder scheduler started (checks every minute, India time)');
}

function stopReminderScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  ruleInvoiceReminders,
  startReminderScheduler, stopReminderScheduler, runReminders, getSettings,
  // exported for tests
  _internal: { istParts, parseInspection, toMinutes, isDue, usualStartMinutes },
};
