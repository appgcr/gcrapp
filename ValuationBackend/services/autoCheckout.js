/**
 * Automatic check-out for a forgotten check-in.
 *
 * An engineer who is still checked in at the end of the working day (default 21:00 IST,
 * AUTO_CHECKOUT_TIME to change) is checked out by the system at that time, so a check-in
 * never stays open for days. A check-in made after that time (late work) closes 4 hours
 * later; no shift is ever longer than 14 hours. The record is marked missedCheckOut, and
 * the engineer and their branch admin are told. Runs every minute with the reminders,
 * even when reminders are switched off.
 */
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { notify } = require('./notify');
const { istParts, istDate, toMinutes } = require('./istTime');

const END_MIN = toMinutes(process.env.AUTO_CHECKOUT_TIME || '21:00') ?? 21 * 60;
const MAX_SHIFT_MS = 14 * 3600000;
const LATE_SHIFT_MS = 4 * 3600000;

const istTime = (d) => new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
const istDay = (d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
const duration = (hours) => {
  const t = Math.round(hours * 60); const h = Math.floor(t / 60); const m = t % 60;
  return h === 0 ? `${m} mins` : m === 0 ? `${h} hrs` : `${h} hrs ${m} mins`;
};

/** When an open check-in made at `inAt` is closed by the system */
function autoCloseAt(inAt) {
  const t = new Date(inAt).getTime();
  const dayEnd = istDate(istParts(new Date(t)).ymd, END_MIN).getTime();
  const close = t < dayEnd ? dayEnd : t + LATE_SHIFT_MS;
  return new Date(Math.min(close, t + MAX_SHIFT_MS));
}

async function runAutoCheckout(now = new Date()) {
  // Everyone whose latest Clock-In / Clock-Out is a Clock-In
  const open = await Attendance.aggregate([
    { $match: { attendanceType: { $in: ['Clock-In', 'Clock-Out'] } } },
    { $sort: { timestamp: -1 } },
    { $group: { _id: '$userId', last: { $first: '$$ROOT' } } },
    { $match: { 'last.attendanceType': 'Clock-In' } },
  ]);
  let closed = 0;
  for (const { last } of open) {
    const closeAt = autoCloseAt(last.timestamp);
    if (now < closeAt) continue;
    // Claim it: only one Clock-Out is ever written for this check-in, even if two servers run
    const hours = Math.max(0, (closeAt - new Date(last.timestamp)) / 3600000);
    const id = `ATT-AUTO-${last.id}`;
    try {
      await Attendance.create({
        id, userId: last.userId, name: last.name, timestamp: closeAt, attendanceType: 'Clock-Out',
        lat: last.lat || '', lng: last.lng || '', address: last.address || '',
        formattedTime: istTime(closeAt), formattedDate: istDay(closeAt),
        workDurationHours: Math.round(hours * 100) / 100, workDurationFormatted: duration(hours),
        status: 'Verified', missedCheckOut: true,
      });
    } catch (err) {
      if (err && err.code === 11000) continue; // already closed
      throw err;
    }
    closed += 1;
    const user = await User.findOne({ $or: [{ id: last.userId }, { username: last.userId }] }).select('id name username branchId').lean();
    const who = user?.name || last.name || last.userId;
    notify({
      to: user?.id || last.userId, type: 'checkout_reminder', priority: 'normal', now,
      title: 'Checked out automatically',
      message: `You didn't check out on ${istDay(last.timestamp)}, so you were checked out at ${istTime(closeAt)}. Check in again when you start work.`,
    }).catch(() => {});
    if (user?.branchId) {
      notify({
        to: 'ADMIN', branchId: user.branchId, type: 'general', priority: 'normal', now,
        title: 'Missed check-out',
        message: `${who} didn't check out on ${istDay(last.timestamp)}. The system checked them out at ${istTime(closeAt)} (${duration(hours)}).`,
      }).catch(() => {});
    }
  }
  return closed;
}

module.exports = { runAutoCheckout, autoCloseAt };
