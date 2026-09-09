const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const AppConfig = require('../models/AppConfig');

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
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.userId) {
      filter.userId = req.query.userId;
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

// GET /api/attendance/calendar-summary
router.get('/calendar-summary', async (req, res) => {
  try {
    const { userId, year, month } = req.query;
    if (!userId || !year || !month) {
      return res.status(400).json({ error: 'userId, year, and month are required' });
    }

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
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    const now = payload.timestamp ? new Date(payload.timestamp) : new Date();
    payload.timestamp = now;

    // Ensure 12-hour AM/PM formatted time and date strings
    if (!payload.formattedTime) {
      payload.formattedTime = format12Hour(now);
    }
    if (!payload.formattedDate) {
      payload.formattedDate = formatDateString(now);
    }

    // If Clock-Out: Find latest Clock-In on the same day for this user
    if (payload.attendanceType === 'Clock-Out') {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);

      const latestClockIn = await Attendance.findOne({
        userId: payload.userId,
        attendanceType: 'Clock-In',
        timestamp: { $gte: dayStart, $lte: dayEnd }
      }).sort({ timestamp: -1 });

      if (latestClockIn) {
        const diffMs = now.getTime() - new Date(latestClockIn.timestamp).getTime();
        const durationHours = Math.max(0, diffMs / (1000 * 60 * 60));
        payload.workDurationHours = parseFloat(durationHours.toFixed(2));
        payload.workDurationFormatted = formatDuration(payload.workDurationHours);
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
