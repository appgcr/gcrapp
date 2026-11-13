const express = require('express');
const router = express.Router();
const LiveLocation = require('../models/LiveLocation');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { isSuper, branchScope } = require('../services/access');
const { notifyLater } = require('../services/notify');

router.use(authenticateToken);

const TRACKED = ['ENGINEER', 'ADMIN'];
const SILENT_MS = 30 * 60 * 1000;      // no report for 30 min → "stopped sharing" alert
const ONDUTY_TRAIL_MS = 15 * 1000;     // on-duty route points kept at most every 15 s
const CONSENT_VERSION = '2026-11-14';

const time12 = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

async function isOnDuty(userId) {
  const last = await Attendance.findOne({ userId, attendanceType: { $in: ['Clock-In', 'Clock-Out'] } }).sort({ timestamp: -1 }).lean();
  return last?.attendanceType === 'Clock-In';
}

// GET /api/live/consent — has this person agreed to always-on location sharing?
router.get('/consent', async (req, res) => {
  const u = await User.findOne({ id: req.user.id }).select('role locationConsentAt locationConsentVersion').lean();
  res.json({
    required: TRACKED.includes(u?.role),
    agreedAt: u?.locationConsentAt || null,
    version: CONSENT_VERSION,
    current: !!u?.locationConsentAt && u?.locationConsentVersion === CONSENT_VERSION,
  });
});

// POST /api/live/consent — records the time they ticked "I agree"
router.post('/consent', async (req, res) => {
  if (req.body?.agree !== true) return res.status(400).json({ error: 'Please tick the box to agree.' });
  const now = new Date();
  await User.updateOne({ id: req.user.id }, { $set: { locationConsentAt: now, locationConsentVersion: CONSENT_VERSION } });
  res.json({ agreedAt: now, version: CONSENT_VERSION });
});

// POST /api/live/ping — { lat, lng, accuracy } or { state: 'off' | 'on' }
router.post('/ping', async (req, res) => {
  try {
    const me = await User.findOne({ id: req.user.id }).select('id name username role branchId').lean();
    if (!me || !TRACKED.includes(me.role)) return res.json({ ignored: true });
    const now = new Date();
    const prev = await LiveLocation.findOne({ userId: me.id }).lean();
    const set = { name: me.name || me.username, role: me.role, branchId: me.branchId || null, lastSeenAt: now, silentAlertedAt: null };
    if (req.body?.platform) set.platform = String(req.body.platform).slice(0, 20);
    const onDuty = me.role === 'ENGINEER' ? await isOnDuty(me.id) : false;
    const who = me.name || me.username;

    if (req.body?.state === 'off') {
      set.off = true;
      if (!prev?.off) set.offSince = now;
      const recentlyAlerted = prev?.offAlertedAt && now - new Date(prev.offAlertedAt) < 10 * 60000;
      if (!recentlyAlerted) {
        set.offAlertedAt = now;
        notifyLater({
          to: 'ADMIN', branchId: me.branchId || null, type: 'location_off', priority: 'urgent',
          title: 'Location turned off',
          message: `${who} turned off location at ${time12(now)}.`,
        });
      }
      if (onDuty) await Attendance.create({ id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId: me.id, name: who, attendanceType: 'Location Off', status: 'Background', timestamp: now });
    } else {
      const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
      const hasFix = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
      const wasOff = !!prev?.off;
      if (hasFix || req.body?.state === 'on') { set.off = false; set.offSince = null; }
      if (hasFix) {
        set.lat = lat; set.lng = lng; set.at = now;
        set.accuracy = Number.isFinite(Number(req.body.accuracy)) ? Number(req.body.accuracy) : null;
      }
      if (wasOff && set.off === false) {
        notifyLater({ to: 'ADMIN', branchId: me.branchId || null, type: 'location_on', priority: 'normal', title: 'Location back on', message: `${who} turned location back on at ${time12(now)}.` });
        if (onDuty) await Attendance.create({ id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId: me.id, name: who, attendanceType: 'Location On', status: 'Background', timestamp: now });
      }
      // While on duty, also keep the route trail used by attendance history
      if (hasFix && onDuty && (!prev?.at || now - new Date(prev.at) >= ONDUTY_TRAIL_MS)) {
        await Attendance.create({
          id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId: me.id, name: who,
          lat: lat.toFixed(6), lng: lng.toFixed(6), accuracy: set.accuracy, attendanceType: 'Location Update', status: 'Background', timestamp: now,
        });
      }
    }
    await LiveLocation.updateOne({ userId: me.id }, { $set: set }, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/live/road — { from: {lat,lng}, to: [{id,lat,lng}] } → road distance (km) and drive time (min)
// from the viewer to each person, using OpenStreetMap road data (OSRM). Only coordinates are sent.
router.post('/road', async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Admins only.' });
    const ok = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
    const from = req.body?.from;
    const to = (Array.isArray(req.body?.to) ? req.body.to : []).filter(ok).slice(0, 90);
    if (!ok(from) || to.length === 0) return res.json({});
    const pts = [from, ...to].map((p) => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${pts}?sources=0&annotations=distance,duration`, {
      signal: ctrl.signal, headers: { 'User-Agent': 'GouruValuations/1.0' },
    }).finally(() => clearTimeout(timer));
    const d = await r.json();
    if (d.code !== 'Ok') return res.json({});
    const out = {};
    to.forEach((p, i) => {
      const m = d.distances?.[0]?.[i + 1];
      const s = d.durations?.[0]?.[i + 1];
      if (Number.isFinite(m)) out[p.id] = { km: Math.round(m / 100) / 10, min: Number.isFinite(s) ? Math.round(s / 60) : null };
    });
    res.json(out);
  } catch (err) {
    res.json({}); // road distance is a nice-to-have; straight-line distance still shows
  }
});

// GET /api/live — latest position of every engineer / branch admin this person may see
router.get('/', async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Admins only.' });
    const b = branchScope(req);
    const filter = {};
    if (b) filter.branchId = b;
    else if (!isSuper(req.user)) return res.json([]);
    if (!isSuper(req.user)) filter.role = 'ENGINEER'; // branch admins see their engineers
    const rows = await LiveLocation.find(filter).lean();
    const now = Date.now();
    res.json(rows.map((r) => ({
      ...r,
      state: r.off ? 'off' : (!r.lastSeenAt || now - new Date(r.lastSeenAt) > SILENT_MS) ? 'silent' : 'live',
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Every 5 minutes: alert when someone's phone has stopped reporting for 30 minutes
// (phone switched off, app force-closed, no internet). One alert per silent spell.
function startLiveWatchdog() {
  const tick = async () => {
    try {
      const cutoff = new Date(Date.now() - SILENT_MS);
      const silent = await LiveLocation.find({ off: false, lastSeenAt: { $lt: cutoff }, silentAlertedAt: null }).lean();
      for (const r of silent) {
        if (r.role === 'ENGINEER' && await isOnDuty(r.userId)) continue; // on-duty gaps are already alerted by the reminders
        await LiveLocation.updateOne({ userId: r.userId }, { $set: { silentAlertedAt: new Date() } });
        notifyLater({
          to: 'ADMIN', branchId: r.branchId || null, type: 'location_silent', priority: 'normal',
          title: 'Location not updating',
          message: `${r.name || r.userId}'s phone stopped sharing location (last seen ${time12(r.lastSeenAt)}). The phone may be off, the app closed or there's no internet.`,
        });
      }
    } catch (e) { console.warn('live watchdog:', e.message); }
  };
  setInterval(tick, 5 * 60 * 1000);
}

module.exports = router;
module.exports.startLiveWatchdog = startLiveWatchdog;
