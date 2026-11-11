/**
 * GCR Valuation System — Notification service (in-app record + phone push) with smart timing
 *
 * notify({ to, title, message, caseId, type, priority, now })
 *   to:       a user id / username, or 'ADMIN' for the admins: every Super Admin, plus the
 *             Branch Admins of `branchId` when given (a branch's alerts never reach other branches)
 *   priority: 'urgent'  → push immediately, any time (e.g. case assigned for today, report returned)
 *             'normal'  → push immediately during working hours; during quiet hours
 *                         (default 7 PM – 9 AM IST) the push is HELD and delivered at 9 AM,
 *                         bundled into one notification if several were waiting
 *             'digest'  → morning summary; the scheduler already sends it at the right time
 *
 * The in-app record (bell) is always saved immediately — quiet hours only stop the phone
 * from buzzing. Push is skipped safely when FCM is not configured. Never throws.
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const ReminderSettings = require('../models/ReminderSettings');
const { firebaseApp } = require('../config/services');
const { istParts, toMinutes, inWindow, nextOccurrence } = require('./istTime');
const { allowsPush } = require('./notificationCategories');

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

let messaging = null;
if (firebaseApp) {
  try {
    messaging = require('firebase-admin').messaging(firebaseApp);
  } catch (err) {
    console.warn('⚠️ FCM messaging unavailable:', err.message);
  }
}

const pushEnabled = () => Boolean(messaging);

async function quietHours() {
  const s = await ReminderSettings.findOne({ key: 'reminders' }).select('quietHours').lean();
  const q = s?.quietHours || { enabled: true, start: '19:00', end: '09:00' };
  return { enabled: q.enabled !== false, start: toMinutes(q.start), end: toMinutes(q.end) };
}

async function recipientsFor(to, branchId = null) {
  if (to === 'ADMIN') {
    const who = branchId ? [{ role: 'SUPER_ADMIN' }, { role: 'ADMIN', branchId }] : [{ role: 'SUPER_ADMIN' }];
    return User.find({ $or: who, status: { $ne: 'Inactive' } }).select('id role branchId pushTokens notificationPrefs');
  }
  const user = await User.findOne({ $or: [{ id: to }, { username: to }] }).select('id role pushTokens notificationPrefs');
  return user ? [user] : [];
}

async function sendPush(users, { title, message, caseId, type, priority, notificationId, notificationIds = '' }) {
  const tokens = users.flatMap((u) => (u.pushTokens || []).map((t) => t.token)).filter(Boolean);
  if (tokens.length === 0) return { sent: 0, reason: 'no-devices' };
  if (!messaging) return { sent: 0, reason: 'fcm-disabled', devices: tokens.length };

  const high = priority === 'urgent';
  const res = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body: message },
    data: {
      type: String(type || 'general'),
      caseId: String(caseId || ''),
      notificationId: String(notificationId || ''),
      notificationIds: String(notificationIds || ''), // bundled pushes: every included alert (open tracking)
    },
    android: {
      priority: high ? 'high' : 'normal',
      notification: { channelId: 'gcr_alerts', sound: 'default', icon: 'ic_stat_gcr', color: '#007AFF' },
    },
    apns: {
      headers: { 'apns-priority': high ? '10' : '5' },
      payload: { aps: { sound: 'default', 'thread-id': caseId ? `case-${caseId}` : 'gcr' } },
    },
  });

  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code)) dead.push(tokens[i]);
  });
  if (dead.length) await User.updateMany({}, { $pull: { pushTokens: { token: { $in: dead } } } });
  return { sent: res.successCount, failed: res.failureCount, removed: dead.length };
}

const normalizePriority = (p) => (p === 'urgent' || p === 'digest' ? p : 'normal');

async function notify({ to, title, message, caseId = '', type = 'general', priority = 'normal', branchId = null, now = new Date() }) {
  if (!to || !title || !message) return null;
  try {
    const prio = normalizePriority(priority);

    // Respect each person's own alert switches (Settings → Notifications).
    // The in-app record is always kept; only the phone push is skipped for muted people.
    const users = await recipientsFor(to, branchId);
    const allowed = users.filter((u) => allowsPush(u, type));
    const mutedFor = users.filter((u) => !allowsPush(u, type)).map((u) => u.id);
    const base = { targetUser: to, branchId: to === 'ADMIN' ? branchId : null, title, message, caseId, type, priority: prio, mutedFor, createdAt: now };

    if (users.length > 0 && allowed.length === 0) {
      const record = await Notification.create({ ...base, pushStatus: 'muted' });
      if (process.env.NODE_ENV !== 'test') console.log(`🔕 muted → ${to} | ${type} (switched off by recipient)`);
      return { record, push: { muted: true } };
    }

    // Quiet hours: hold non-urgent pushes until the quiet period ends
    if (prio === 'normal') {
      const q = await quietHours();
      if (q.enabled && inWindow(istParts(now).minutes, q.start, q.end)) {
        const deliverAfter = nextOccurrence(now, q.end);
        const record = await Notification.create({ ...base, pushStatus: 'held', deliverAfter });
        if (process.env.NODE_ENV !== 'test') console.log(`🌙 held → ${to} | ${type} | until ${deliverAfter.toISOString()}`);
        return { record, push: { held: true, deliverAfter } };
      }
    }

    const record = await Notification.create(base);
    const push = await sendPush(allowed, { title, message, caseId, type, priority: prio, notificationId: record._id });
    record.pushStatus = 'sent';
    record.pushedAt = new Date();
    await record.save();
    if (process.env.NODE_ENV !== 'test') console.log(`🔔 notify → ${to} | ${type} | ${prio} | push: ${JSON.stringify(push)}`);
    return { record, push };
  } catch (err) {
    console.warn('⚠️ notify failed:', err.message);
    return null;
  }
}

/**
 * Deliver pushes held during quiet hours whose time has come.
 * Several held alerts for the same person become ONE push ("3 updates while you were away").
 * Returns the number of pushes sent.
 */
async function releaseHeld(now = new Date()) {
  const due = await Notification.find({ pushStatus: 'held', deliverAfter: { $lte: now } }).sort({ createdAt: 1 }).lean();
  if (due.length === 0) return 0;

  const byUser = new Map();
  // Group per recipient (and per branch for admin alerts, so branches never get each other's)
  due.forEach((n) => {
    const k = `${n.targetUser}|${n.branchId || ''}`;
    if (!byUser.has(k)) byUser.set(k, []);
    byUser.get(k).push(n);
  });

  let pushes = 0;
  for (const [, list] of byUser) {
    const to = list[0].targetUser;
    // Claim them first so a parallel run can't send them twice
    const ids = list.map((n) => n._id);
    const claimed = await Notification.updateMany({ _id: { $in: ids }, pushStatus: 'held' }, { $set: { pushStatus: 'bundled' } });
    if (!claimed.modifiedCount) continue;

    // Each recipient gets only the alert types they still have switched on
    const users = await recipientsFor(to, list[0].branchId || null);
    for (const u of users) {
      const mine = list.filter((n) => allowsPush(u, n.type));
      if (mine.length === 0) continue;
      let payload;
      if (mine.length === 1) {
        const n = mine[0];
        payload = { title: n.title, message: n.message, caseId: n.caseId, type: n.type, priority: 'normal', notificationId: n._id };
      } else {
        const titles = [...new Set(mine.map((n) => n.title))];
        payload = {
          title: `${mine.length} updates while you were away`,
          message: titles.slice(0, 3).join(' · ') + (titles.length > 3 ? ` · +${titles.length - 3} more` : ''),
          caseId: '', type: 'bundle', priority: 'normal', notificationId: '',
          notificationIds: mine.map((n) => String(n._id)).join(','),
        };
      }
      try {
        await sendPush([u], payload);
        pushes += 1;
      } catch (err) {
        console.warn('⚠️ held push failed:', err.message);
      }
    }
    await Notification.updateMany({ _id: { $in: ids } }, { $set: { pushStatus: list.length === 1 ? 'sent' : 'bundled', pushedAt: new Date() } });
  }
  return pushes;
}

// Fire-and-forget helper for route handlers (doesn't delay the HTTP response)
function notifyLater(payload) {
  setImmediate(() => { notify(payload); });
}

/**
 * Compare a case before/after an update and send the matching alerts with the right priority.
 */
function notifyCaseChange(before, after, actor = {}, now = new Date()) {
  if (!before || !after) return;
  const id = after.id;
  const ref = after.fileNumber || `#${id}`;
  const branchId = after.branchId || null;
  const client = after.clientName ? ` · ${after.clientName}` : '';
  const engineer = after.assignedEngineerId && after.assignedEngineerId !== 'UNASSIGNED' ? after.assignedEngineerId : null;

  // 1. Newly assigned → urgent if the inspection is today/tomorrow (or not yet scheduled)
  if (engineer && engineer !== before.assignedEngineerId) {
    const when = after.inspectionDate ? ` Inspection: ${after.inspectionDate}${after.inspectionTime ? ` ${after.inspectionTime}` : ''}.` : '';
    const today = istParts(now).ymd;
    const tomorrow = istParts(new Date(now.getTime() + 86400000)).ymd;
    const insp = String(after.inspectionDate || '').slice(0, 10);
    const soon = !insp || insp === today || insp === tomorrow;
    notifyLater({
      to: engineer, type: 'case_assigned', caseId: id, priority: soon ? 'urgent' : 'normal', now,
      title: 'New case assigned',
      message: `Case ${ref}${client}${after.bankName ? ` (${after.bankName})` : ''}.${when}`,
    });
  }

  // 2. Engineer submitted / re-submitted → admin review (normal)
  if (after.status === 'Reviewing' && before.status !== 'Reviewing') {
    const resub = before.status === 'Returned';
    notifyLater({
      to: 'ADMIN', branchId, type: 'report_submitted', caseId: id, priority: 'normal', now,
      title: resub ? 'Corrected report submitted' : 'Report ready for review',
      message: `${after.assignedEngineerName && after.assignedEngineerName !== 'Unknown' ? after.assignedEngineerName : 'An engineer'} submitted Case ${ref}${client}.`,
    });
  }

  // 3. Admin decision → engineer (approved: normal; rejected needs action: urgent)
  if (engineer && after.status !== before.status) {
    if (after.status === 'Approved') {
      notifyLater({
        to: engineer, type: 'report_approved', caseId: id, priority: 'normal', now,
        title: 'Report approved',
        message: `Case ${ref}${client} was approved${actor.name ? ` by ${actor.name}` : ''}.`,
      });
    } else if (after.status === 'Rejected') {
      notifyLater({
        to: engineer, type: 'report_rejected', caseId: id, priority: 'urgent', now,
        title: 'Report rejected',
        message: `Case ${ref}${client} was rejected${after.rejectionReason ? `: "${after.rejectionReason}"` : '.'}`,
      });
    }
  }
  // 4. The bank employee who asked for this valuation follows its progress
  const bankUser = after.requestedBy && after.requestedBy.id;
  if (bankUser) {
    if (engineer && engineer !== before.assignedEngineerId) {
      notifyLater({ to: bankUser, type: 'bank_request_update', caseId: id, priority: 'normal', now,
        title: 'Engineer assigned', message: `Your request ${ref}${client} has been given to a GCR engineer for the site visit.` });
    }
    if (after.status === 'Approved' && before.status !== 'Approved') {
      notifyLater({ to: bankUser, type: 'bank_request_update', caseId: id, priority: 'normal', now,
        title: 'Valuation report ready', message: `The approved report for ${ref}${client} is ready to download.` });
    }
  }
}

module.exports = { notify, notifyLater, notifyCaseChange, releaseHeld, pushEnabled };
