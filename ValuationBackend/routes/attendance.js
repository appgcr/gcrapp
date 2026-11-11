const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const AppConfig = require('../models/AppConfig');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { isSuper, branchScope } = require('../services/access');
const { istParts, istDate: istDayStartFn, addDaysYMD } = require('../services/istTime');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const { notifyLater } = require('../services/notify');
const istDayStart = (ymd) => istDayStartFn(ymd, 0);

// Whose attendance this request may read: an engineer → only themself; a Branch Admin →
// their branch's staff; the Super Admin → everyone (or the branch they're viewing).
async function visibleUserIds(req) {
  if (req.user.role === 'ENGINEER') return [req.user.id];
  const b = branchScope(req);
  if (!b && isSuper(req.user)) return null; // no limit
  const people = await User.find({ branchId: b }).select('id').lean();
  return people.map((p) => p.id);
}

// Helper: Format date into 12-hour AM/PM format
function format12Hour(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateString(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDuration(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h} hrs ${m} mins`;
}

// GET /api/attendance
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filter = {};
    const allowed = await visibleUserIds(req);
    if (req.query.userId) {
      if (allowed && !allowed.includes(req.query.userId)) return res.json([]);
      filter.userId = req.query.userId;
    } else if (allowed) {
      filter.userId = { $in: allowed };
    }

    if (req.query.year && req.query.month) {
      const year = parseInt(req.query.year);
      const month = parseInt(req.query.month) - 1; // 0-indexed
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      filter.timestamp = { $gte: startDate, $lte: endDate };
    } else if (req.query.date) {
      const target = new Date(req.query.date);
      const start = new Date(target.setHours(0, 0, 0, 0));
      const end = new Date(target.setHours(23, 59, 59, 999));
      filter.timestamp = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(filter).sort({ timestamp: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/week-summary — this week (Monday → today, India time) for one engineer:
// days present, hours worked, site visits done (first reports) and reports submitted (incl. corrections).
// Engineers get their own; admins may pass ?userId= for someone they can see.
router.get('/week-summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'ENGINEER' ? req.user.id : (req.query.userId || req.user.id);
    const allowed = await visibleUserIds(req);
    if (allowed && !allowed.includes(userId)) return res.status(403).json({ error: 'Not allowed.' });

    const now = new Date();
    const today = istParts(now);
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayIdx = Math.max(0, DAYS.indexOf(today.weekday));
    const weekStartYmd = addDaysYMD(today.ymd, -dayIdx);
    const weekStart = istDayStart(weekStartYmd);

    const rows = await Attendance.find({ userId, attendanceType: { $in: ['Clock-In', 'Clock-Out'] }, timestamp: { $gte: weekStart } })
      .sort({ timestamp: 1 }).select('attendanceType timestamp workDurationHours').lean();

    // Days present = days with at least one check-in
    const presentDays = new Set(rows.filter((r) => r.attendanceType === 'Clock-In').map((r) => istParts(new Date(r.timestamp)).ymd));

    // Hours = finished sessions this week + the session still running (counted from the start of the week)
    let hours = rows.filter((r) => r.attendanceType === 'Clock-Out').reduce((sum, r) => sum + (r.workDurationHours || 0), 0);
    const lastDuty = await Attendance.findOne({ userId, attendanceType: { $in: ['Clock-In', 'Clock-Out'] } }).sort({ timestamp: -1 }).lean();
    if (lastDuty?.attendanceType === 'Clock-In') {
      const from = Math.max(new Date(lastDuty.timestamp).getTime(), weekStart.getTime());
      hours += Math.max(0, now.getTime() - from) / 3600000;
    }
    // A Clock-Out this week whose Clock-In was last week: count only this week's part
    const firstOut = rows.find((r) => r.attendanceType === 'Clock-Out');
    if (firstOut && !rows.some((r) => r.attendanceType === 'Clock-In' && r.timestamp < firstOut.timestamp)) {
      const thisWeekPart = (new Date(firstOut.timestamp).getTime() - weekStart.getTime()) / 3600000;
      hours -= Math.max(0, (firstOut.workDurationHours || 0) - thisWeekPart);
    }

    // Reports: every submission this week; site visits = first-time submissions (version 1)
    const subs = await ValuationCaseVersion.find({ submittedBy: userId, submittedAt: { $gte: weekStart } }).select('version').lean();

    // Working days so far this week (Sundays off)
    const workingDays = Math.min(dayIdx + 1, 6);

    res.json({
      weekStart: weekStartYmd,
      daysPresent: presentDays.size,
      workingDays,
      hoursWorked: Math.round(hours * 10) / 10,
      siteVisits: subs.filter((v) => v.version === 1).length,
      reportsSubmitted: subs.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/calendar-summary
router.get('/calendar-summary', authenticateToken, async (req, res) => {
  try {
    const { userId, year, month } = req.query;
    if (!userId || !year || !month) {
      return res.status(400).json({ error: 'userId, year, and month are required' });
    }
    const allowed = await visibleUserIds(req);
    if (allowed && !allowed.includes(userId)) return res.status(403).json({ error: 'Not allowed.' });

    const y = parseInt(year);
    const m = parseInt(month) - 1;
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const records = await Attendance.find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 });

    // Group logs by YYYY-MM-DD
    const dayMap = {};
    records.forEach(log => {
      const d = new Date(log.timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          date: dateKey,
          day: d.getDate(),
          firstClockIn: null,
          lastClockOut: null,
          totalDurationHours: 0,
          status: 'Absent',
          logs: []
        };
      }
      dayMap[dateKey].logs.push(log);
      if (log.attendanceType === 'Clock-In' && !dayMap[dateKey].firstClockIn) {
        dayMap[dateKey].firstClockIn = log;
      }
      if (log.attendanceType === 'Clock-Out') {
        dayMap[dateKey].lastClockOut = log;
      }
      if (log.workDurationHours) {
        dayMap[dateKey].totalDurationHours += log.workDurationHours;
      }
    });

    // Get attendance settings dynamically from AppConfig
    const config = await AppConfig.findOne({ key: 'global' });
    const fullDayHours = config?.attendanceSettings?.fullDayHours ?? 7;
    const halfDayHours = config?.attendanceSettings?.halfDayHours ?? 4;

    // Compute status for each active day
    Object.values(dayMap).forEach(day => {
      day.totalDurationHours = parseFloat(day.totalDurationHours.toFixed(2));
      day.durationFormatted = formatDuration(day.totalDurationHours);
      if (day.totalDurationHours >= fullDayHours) {
        day.status = 'Full Day';
      } else if (day.totalDurationHours >= halfDayHours) {
        day.status = 'Half Day';
      } else if (day.firstClockIn && !day.lastClockOut) {
        day.status = 'In Progress';
      } else if (day.totalDurationHours > 0) {
        day.status = 'Short Shift';
      } else if (day.firstClockIn) {
        day.status = 'Clocked In';
      }
    });

    res.json(dayMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance
router.post('/', authenticateToken, async (req, res) => {
  try {
    const payload = { ...req.body };
    // People record only their own attendance (no clocking in for someone else)
    if (payload.userId && payload.userId !== req.user.id && payload.userId !== req.user.username && !isSuper(req.user)) {
      return res.status(403).json({ error: 'You can only record your own attendance.' });
    }
    if (!payload.userId) payload.userId = req.user.id;
    const now = new Date(); // Server-side authoritative timestamp
    payload.timestamp = now;

    if (!payload.id) {
      payload.id = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    if (!payload.userId) {
      return res.status(400).json({ error: 'userId is required for attendance record.' });
    }

    if (!payload.name) {
      payload.name = payload.userId;
    }

    if (!payload.attendanceType && payload.type) {
      if (payload.type.toUpperCase().includes('IN')) payload.attendanceType = 'Clock-In';
      else if (payload.type.toUpperCase().includes('OUT')) payload.attendanceType = 'Clock-Out';
      else payload.attendanceType = 'Location Update';
    }
    if (!payload.lat && payload.latitude !== undefined) {
      payload.lat = String(payload.latitude);
    }
    if (!payload.lng && payload.longitude !== undefined) {
      payload.lng = String(payload.longitude);
    }
    if (!payload.name && payload.engineerName) {
      payload.name = payload.engineerName;
    }
    if (payload.verificationMethod === 'FACE_BIOMETRIC' || payload.livenessScore >= 0.8) {
      payload.faceVerified = true;
      payload.livenessVerified = true;
    }

    // Ensure 12-hour AM/PM formatted time and date strings
    if (!payload.formattedTime) {
      payload.formattedTime = format12Hour(now);
    }
    if (!payload.formattedDate) {
      payload.formattedDate = formatDateString(now);
    }

    const type = payload.attendanceType;
    if (!['Clock-In', 'Clock-Out', 'Location Update', 'Location Off', 'Location On'].includes(type)) {
      return res.status(400).json({ error: 'Unknown attendance type.' });
    }

    // Duty state = the latest Clock-In / Clock-Out ever (so a shift that runs past midnight still counts)
    const lastDuty = await Attendance.findOne({ userId: payload.userId, attendanceType: { $in: ['Clock-In', 'Clock-Out'] } })
      .sort({ timestamp: -1 }).lean();
    const onDuty = lastDuty?.attendanceType === 'Clock-In';

    // A real position is required to check in or out (no "default branch" or blank locations)
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    const hasFix = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
    if (hasFix) { payload.lat = lat.toFixed(6); payload.lng = lng.toFixed(6); }
    if (payload.accuracy !== undefined) payload.accuracy = Number(payload.accuracy) || null;

    if (type === 'Clock-In') {
      if (onDuty) {
        return res.status(409).json({ error: `You are already checked in (since ${format12Hour(lastDuty.timestamp)}). Check out first.` });
      }
      if (!hasFix) return res.status(400).json({ error: 'Turn on location to check in. Your position is recorded with each check-in.' });
      const cfg = await AppConfig.findOne({ key: 'global' }).lean().catch(() => null);
      const maxOuts = cfg?.attendanceSettings?.maxDailyClockOuts || 3;
      const ymd = istParts(now).ymd;
      const outsToday = await Attendance.countDocuments({ userId: payload.userId, attendanceType: 'Clock-Out', timestamp: { $gte: istDayStart(ymd) } });
      if (outsToday >= maxOuts) {
        return res.status(429).json({ error: `Daily limit reached: ${maxOuts} check-outs today. Contact your admin.` });
      }
    }

    if (type === 'Clock-Out') {
      if (!onDuty) return res.status(409).json({ error: 'You are not checked in.' });
      if (!hasFix) return res.status(400).json({ error: 'Turn on location to check out. Your position is recorded with each check-out.' });
      // Hours worked = since the open Clock-In (even if it was yesterday)
      const durationHours = Math.max(0, (now.getTime() - new Date(lastDuty.timestamp).getTime()) / 3600000);
      payload.workDurationHours = parseFloat(durationHours.toFixed(2));
      payload.workDurationFormatted = formatDuration(payload.workDurationHours);
    }

    // Live tracking events only make sense while on duty
    if (type === 'Location Update' || type === 'Location Off' || type === 'Location On') {
      if (!onDuty) return res.json({ ignored: true, reason: 'not on duty' });
      if (type === 'Location Update' && !hasFix) return res.status(400).json({ error: 'Location update needs a position.' });
      payload.status = 'Background';
    }

    if (type === 'Location Off') {
      // Tell the engineer's branch admins right away (once per 10 minutes)
      const recent = await Attendance.findOne({ userId: payload.userId, attendanceType: 'Location Off', timestamp: { $gte: new Date(now.getTime() - 10 * 60000) } }).lean();
      if (!recent) {
        const who = await User.findOne({ id: payload.userId }).select('name username branchId').lean();
        notifyLater({
          to: 'ADMIN', branchId: who?.branchId || null, type: 'location_off', priority: 'urgent',
          title: 'Location turned off',
          message: `${who?.name || payload.userId} turned off location while on duty (${format12Hour(now)}).`,
        });
      }
    }
    const newRecord = new Attendance(payload);
    const saved = await newRecord.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
