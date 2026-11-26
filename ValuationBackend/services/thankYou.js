// End of the day: when an engineer checks out, a warm thank-you with what they did today (once a day).
// Part of the good-morning setting (Settings → Automatic Reminders → Good-morning message): off together.
const Notification = require('../models/Notification');
const ReminderSettings = require('../models/ReminderSettings');
const { notify } = require('./notify');
const { workReport } = require('./workReports');
const { istParts } = require('./istTime');

const hrs = (h) => { const m = Math.round((h || 0) * 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const LINES = [
  "I know you're tired after today's work.",
  'Thank you for all your effort today.',
  'Another day of good work done.',
];

async function thankAfterCheckOut(user, now = new Date()) {
  const s = await ReminderSettings.findOne({ key: 'reminders' }).lean();
  if (s && s.goodMorning && s.goodMorning.enabled === false) return null;
  const ist = istParts(now);
  const start = new Date(`${ist.ymd}T00:00:00+05:30`);
  if (await Notification.exists({ targetUser: user.id, type: 'good_evening', createdAt: { $gte: start } })) return null; // once a day
  const r = await workReport('day', ist.ymd, { userId: user.id });
  const e = (r && r.engineer) || {};
  const done = [e.hours ? `You worked ${hrs(e.hours)}` : null,
    e.siteVisits ? `${e.siteVisits} site visit${e.siteVisits === 1 ? '' : 's'}` : null,
    e.submitted ? `${e.submitted} report${e.submitted === 1 ? '' : 's'} submitted` : null].filter(Boolean);
  const first = String(user.name || user.username || '').trim().split(/\s+/)[0] || '';
  const line = LINES[Number(ist.ymd.replace(/-/g, '')) % LINES.length];
  return notify({
    to: user.id, type: 'good_evening', priority: 'digest', now,
    title: first ? `Thank you, ${first} 🙏` : 'Thank you 🙏',
    message: `${line} ${done.length ? `${done.join(' · ')}. ` : ''}Rest well — see you tomorrow! — Gouru`,
  });
}

module.exports = { thankAfterCheckOut };
