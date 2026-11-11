const express = require('express');
const router = express.Router();
const AppConfig = require('../models/AppConfig');
const ValuationCase = require('../models/ValuationCase');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getSettings: getReminderSettings } = require('../services/reminders');

// Helper: Get or initialize global config
async function getOrCreateConfig() {
  let config = await AppConfig.findOne({ key: 'global' });
  if (!config) {
    config = new AppConfig({ key: 'global' });
    await config.save();
  }

  // Dynamically merge any banks and districts from real cases in MongoDB
  try {
    const caseDistricts = await ValuationCase.distinct('bankDistrict');
    
    let updated = false;
    // Banks are managed in Settings → Banks (services/banks.js keeps config.banks in step)

    caseDistricts.filter(Boolean).forEach(d => {
      if (!config.districts.some(existing => existing.toLowerCase() === d.trim().toLowerCase())) {
        config.districts.push(d.trim());
        updated = true;
      }
    });

    if (updated) {
      await config.save();
    }
  } catch (e) {
    console.warn('Dynamic case config merge notice:', e.message);
  }

  return config;
}

// GET /api/config
router.get('/', authenticateToken, async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config
router.put('/', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const updated = await AppConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/config/banks — old endpoint; banks are now added by the Super Admin in Settings → Banks
router.post('/banks', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only the Super Admin can add banks (Settings → Banks).' });
    }
    const banksSvc = require('../services/banks');
    const Bank = require('../models/Bank');
    const wanted = String(req.body.name || req.body.bank || '').trim();
    if (wanted && !(await banksSvc.findBank(wanted))) {
      await Bank.create({ id: await banksSvc.nextBankId(), name: wanted });
      banksSvc.clearCache();
      await banksSvc.syncConfigList();
    }
    const name = req.body.name || req.body.bank;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bank name is required' });
    }

    const trimmed = name.trim();
    const config = await getOrCreateConfig();

    if (!config.banks.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      config.banks.push(trimmed);
      await config.save();
    }

    res.json({ success: true, banks: config.banks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/config/districts
router.post('/districts', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const name = req.body.name || req.body.district;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'District name is required' });
    }

    const trimmed = name.trim();
    const config = await getOrCreateConfig();

    if (!config.districts.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      config.districts.push(trimmed);
      await config.save();
    }

    res.json({ success: true, districts: config.districts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Automatic reminders ----------
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// GET /api/config/reminders
router.get('/reminders', authenticateToken, async (req, res) => {
  try {
    res.json(await getReminderSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config/reminders — Super Admin only. Partial updates allowed.
router.put('/reminders', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const s = await getReminderSettings();
    const b = req.body || {};
    const bool = (v) => typeof v === 'boolean';
    const num = (v, min, max) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max;

    if (bool(b.enabled)) s.enabled = b.enabled;
    if (bool(b.skipSundays)) s.skipSundays = b.skipSundays;
    if (bool(b.personalTiming)) s.personalTiming = b.personalTiming;
    if (b.quietHours) {
      if (bool(b.quietHours.enabled)) s.quietHours.enabled = b.quietHours.enabled;
      for (const f of ['start', 'end']) {
        if (b.quietHours[f] !== undefined) {
          if (!HHMM.test(b.quietHours[f])) return res.status(400).json({ error: `quietHours.${f} must be HH:MM (24-hour)` });
          s.quietHours[f] = b.quietHours[f];
        }
      }
      if (s.quietHours.start === s.quietHours.end) return res.status(400).json({ error: 'Quiet hours start and end must differ' });
    }
    for (const k of ['morningDigest', 'engineerDigest', 'checkIn', 'checkOut']) {
      if (b[k] && bool(b[k].enabled)) s[k].enabled = b[k].enabled;
      if (b[k] && b[k].time !== undefined) {
        if (!HHMM.test(b[k].time)) return res.status(400).json({ error: `${k}.time must be HH:MM (24-hour)` });
        s[k].time = b[k].time;
      }
    }
    if (b.inspection) {
      if (bool(b.inspection.enabled)) s.inspection.enabled = b.inspection.enabled;
      if (b.inspection.minutesBefore !== undefined) {
        if (!num(b.inspection.minutesBefore, 15, 240)) return res.status(400).json({ error: 'inspection.minutesBefore must be 15–240' });
        s.inspection.minutesBefore = Number(b.inspection.minutesBefore);
      }
    }
    if (b.overdue) {
      if (bool(b.overdue.enabled)) s.overdue.enabled = b.overdue.enabled;
      if (b.overdue.unassignedHours !== undefined) {
        if (!num(b.overdue.unassignedHours, 1, 168)) return res.status(400).json({ error: 'overdue.unassignedHours must be 1–168' });
        s.overdue.unassignedHours = Number(b.overdue.unassignedHours);
      }
      if (b.overdue.reviewHours !== undefined) {
        if (!num(b.overdue.reviewHours, 1, 336)) return res.status(400).json({ error: 'overdue.reviewHours must be 1–336' });
        s.overdue.reviewHours = Number(b.overdue.reviewHours);
      }
    }
    s.updatedBy = req.user?.name || req.user?.username || '';
    s.updatedAt = new Date();
    await s.save();
    res.json(s);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
