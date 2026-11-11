const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { notify } = require('../services/notify');
const { authenticateToken, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const { TYPE_TO_CATEGORY } = require('../services/notificationCategories');
const mongoose = require('mongoose');

// GET /api/notifications/stats?days=30 — Super Admin: how useful each alert type is.
// (Declared before '/:user' so "stats" isn't treated as a user id.)
router.get('/stats', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await Notification.find({ createdAt: { $gte: since } })
      .select('type title createdAt readAt openedAt pushStatus mutedFor priority').lean();

    const byType = new Map();
    for (const n of rows) {
      const cat = TYPE_TO_CATEGORY.get(n.type);
      const key = n.type || 'general';
      const g = byType.get(key) || {
        type: key, label: cat ? cat.label : (n.title || key), audience: cat ? cat.role : 'ALL',
        sent: 0, pushed: 0, held: 0, muted: 0, read: 0, opened: 0, readDelays: [],
      };
      g.sent += 1;
      if (n.pushStatus === 'sent' || n.pushStatus === 'bundled') g.pushed += 1;
      if (n.pushStatus === 'held') g.held += 1;
      if (n.pushStatus === 'muted' || (n.mutedFor && n.mutedFor.length)) g.muted += 1;
      if (n.openedAt) g.opened += 1;
      if (n.readAt || n.openedAt) {
        g.read += 1;
        const at = new Date(n.openedAt || n.readAt) - new Date(n.createdAt);
        if (at >= 0) g.readDelays.push(at);
      }
      byType.set(key, g);
    }

    const median = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
    const types = [...byType.values()].map((g) => ({
      type: g.type, label: g.label, audience: g.audience,
      sent: g.sent, pushed: g.pushed, held: g.held, muted: g.muted,
      read: g.read, opened: g.opened,
      readRate: g.sent ? Math.round((g.read / g.sent) * 100) : 0,
      medianMinutesToRead: g.readDelays.length ? Math.round(median(g.readDelays) / 60000) : null,
    })).sort((a, b) => b.sent - a.sent);

    const total = types.reduce((t, x) => ({ sent: t.sent + x.sent, read: t.read + x.read, opened: t.opened + x.opened }), { sent: 0, read: 0, opened: 0 });
    res.json({ days, since, total: { ...total, readRate: total.sent ? Math.round((total.read / total.sent) * 100) : 0 }, types });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/opened — the user tapped a phone notification. Body: { ids: [...] }
router.post('/opened', authenticateToken, async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
      .map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)).slice(0, 50);
    if (!ids.length) return res.status(400).json({ error: 'ids are required.' });
    const now = new Date();
    await Notification.updateMany({ _id: { $in: ids }, openedAt: null }, { $set: { openedAt: now } });
    await Notification.updateMany({ _id: { $in: ids }, readAt: null }, { $set: { readAt: now, isRead: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/notifications/:user
// :user can be 'ADMIN' or the employee ID
router.get('/:user', authenticateToken, async (req, res) => {
  try {
    const want = req.params.user;
    let filter;
    if (want === 'ADMIN') {
      // Admin alerts: Super Admin sees all (or the branch being viewed); Branch Admin only theirs
      if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) return res.json([]);
      const b = req.user.role === 'ADMIN' ? (req.user.branchId || '__none__') : (req.headers['x-branch-scope'] && req.headers['x-branch-scope'] !== 'all' ? req.headers['x-branch-scope'] : null);
      filter = b ? { targetUser: 'ADMIN', $or: [{ branchId: b }, { branchId: null, type: 'announcement' }] } : { targetUser: 'ADMIN' };
    } else {
      if (want !== req.user.id && want !== req.user.username && req.user.role !== 'SUPER_ADMIN') return res.json([]);
      filter = { targetUser: want };
    }
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications — e.g. admin announcements.
// Accepts { targetUser | userId, title, message, caseId? } and also sends a phone push.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, message, caseId = '', type = 'announcement' } = req.body || {};
    const targetUser = req.body?.targetUser || req.body?.userId;
    if (!targetUser || !title || !message) {
      return res.status(400).json({ error: 'targetUser (or userId), title and message are required.' });
    }
    // Engineers may only alert their own branch's admins; a Branch Admin only their own branch
    const role = req.user.role;
    if (!['SUPER_ADMIN', 'ADMIN', 'ENGINEER'].includes(role)) return res.status(403).json({ error: 'Not allowed.' });
    let branchId = null;
    if (targetUser === 'ADMIN') {
      branchId = role === 'SUPER_ADMIN' ? null : (req.user.branchId || null);
    } else if (role === 'ENGINEER') {
      return res.status(403).json({ error: 'Engineers can only send alerts to their admin.' });
    } else if (role === 'ADMIN') {
      const to = await User.findOne({ $or: [{ id: targetUser }, { username: targetUser }] }).select('branchId').lean();
      if (!to || to.branchId !== req.user.branchId) return res.status(403).json({ error: 'That person is in another branch.' });
    }
    // Announcements are sent deliberately by the admin → deliver immediately
    const result = await notify({ to: targetUser, branchId, title, message, caseId, type, priority: 'urgent' });
    if (!result) return res.status(500).json({ error: 'Could not save notification.' });
    res.status(201).json({ ...result.record.toObject(), push: result.push });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Bad notification id.' });
    // Keep the FIRST read time (engagement tracking)
    await Notification.updateOne({ _id: req.params.id, readAt: null }, { $set: { readAt: new Date() } });
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
