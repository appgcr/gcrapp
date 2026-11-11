// Office ↔ staff chat (WhatsApp-style).
// Each engineer has ONE conversation with their office: the shared 'ADMIN' inbox that their
// Branch Admin(s) and the Super Admin answer. Messages from the office carry the real
// sender's name (sentByName) so the engineer sees who replied.
const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Branch = require('../models/Branch');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin, isSuper, branchScope, canManageUser } = require('../services/access');
const { notifyLater } = require('../services/notify');

const OFFICE = 'ADMIN';
const MAX_TEXT = 4000;
const threadQuery = (engineerId) => ({
  $or: [{ senderId: engineerId, receiverId: OFFICE }, { senderId: OFFICE, receiverId: engineerId }],
});
const preview = (m) => (m.attachmentType === 'photo' || m.attachmentType === 'gallery' ? '📷 Photo'
  : m.attachmentType === 'document' ? `📄 ${m.text || 'Document'}`
  : m.attachmentType === 'location' ? '📍 Location' : (m.text || ''));

// Engineers the caller may chat with (admins) — the caller themself for engineers
async function engineersFor(req) {
  if (!isAdmin(req.user)) return [req.user];
  const b = branchScope(req);
  const filter = { role: 'ENGINEER', status: { $ne: 'Inactive' } };
  if (b) filter.branchId = b;
  else if (!isSuper(req.user)) filter.branchId = '__none__';
  return User.find(filter).select('id name username phone branchId').lean();
}

async function mayOpen(req, engineerId) {
  if (!isAdmin(req.user)) return engineerId === req.user.id;
  const eng = await User.findOne({ id: engineerId }).select('id role branchId').lean();
  return !!eng && eng.role === 'ENGINEER' && canManageUser(req.user, eng);
}

// GET /api/chat/conversations — admin: every engineer they can see, newest chat first;
// engineer: their one office conversation. Includes last message and unread count.
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const people = await engineersFor(req);
    const codes = new Map((await Branch.find({}).select('id code').lean()).map((b) => [b.id, b.code]));
    const out = await Promise.all(people.map(async (p) => {
      const last = await ChatMessage.findOne(threadQuery(p.id)).sort({ timestamp: -1 }).lean();
      const unread = await ChatMessage.countDocuments(isAdmin(req.user)
        ? { senderId: p.id, receiverId: OFFICE, isRead: false }
        : { senderId: OFFICE, receiverId: p.id, isRead: false });
      // Real duty status (latest check-in / check-out) — not a fake "online"
      let duty = null;
      if (isAdmin(req.user)) {
        duty = await Attendance.findOne({ userId: p.id, attendanceType: { $in: ['Clock-In', 'Clock-Out'] } })
          .sort({ timestamp: -1 }).select('attendanceType timestamp').lean();
      }
      return {
        engineerId: p.id, name: p.name || p.username, phone: p.phone || '', branchId: p.branchId || null,
        branchCode: codes.get(p.branchId) || '',
        onDuty: duty?.attendanceType === 'Clock-In',
        dutyAt: duty?.timestamp || null,
        lastMessage: last ? preview(last) : '', lastAt: last?.timestamp || null,
        lastFromMe: last ? (isAdmin(req.user) ? last.senderId === OFFICE : last.senderId === req.user.id) : false,
        lastRead: last ? !!last.isRead : false,
        unread,
      };
    }));
    out.sort((a, b) => (new Date(b.lastAt || 0) - new Date(a.lastAt || 0)) || a.name.localeCompare(b.name));
    // Engineers: the number to call their office — the branch phone, else a branch admin's,
    // else the head office (a Super Admin's)
    if (!isAdmin(req.user) && out[0]) {
      const branch = req.user.branchId ? await Branch.findOne({ id: req.user.branchId }).select('name phone').lean() : null;
      let officePhone = branch?.phone || '';
      let officeName = branch ? `${branch.name} Office` : 'Head Office';
      if (!officePhone && req.user.branchId) {
        const ba = await User.findOne({ role: 'ADMIN', branchId: req.user.branchId, status: { $ne: 'Inactive' }, phone: { $nin: ['', null] } }).select('phone').lean();
        officePhone = ba?.phone || '';
      }
      if (!officePhone) {
        const sa = await User.findOne({ role: 'SUPER_ADMIN', status: { $ne: 'Inactive' }, phone: { $nin: ['', null] } }).select('phone').lean();
        officePhone = sa?.phone || '';
        if (officePhone && !branch) officeName = 'Head Office';
      }
      out[0].officePhone = officePhone;
      out[0].officeName = officeName;
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/thread/:engineerId — the conversation (latest 300 messages, oldest first)
router.get('/thread/:engineerId', authenticateToken, async (req, res) => {
  try {
    const { engineerId } = req.params;
    if (!(await mayOpen(req, engineerId))) return res.status(403).json({ error: 'Not allowed.' });
    const rows = await ChatMessage.find(threadQuery(engineerId)).sort({ timestamp: -1 }).limit(300).lean();
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chat/thread/:engineerId/read — mark the other side's messages as read (blue ticks)
router.put('/thread/:engineerId/read', authenticateToken, async (req, res) => {
  try {
    const { engineerId } = req.params;
    if (!(await mayOpen(req, engineerId))) return res.status(403).json({ error: 'Not allowed.' });
    const filter = isAdmin(req.user)
      ? { senderId: engineerId, receiverId: OFFICE, isRead: false }
      : { senderId: OFFICE, receiverId: engineerId, isRead: false };
    const r = await ChatMessage.updateMany(filter, { $set: { isRead: true, readAt: new Date() } });
    res.json({ success: true, marked: r.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat — send. Body: { engineerId?, text?, attachmentUrl?, attachmentType?, attachmentMetadata?, caseId? }
// Admins send to an engineer (engineerId); engineers always send to their office.
router.post('/', authenticateToken, async (req, res) => {
  try {
    const admin = isAdmin(req.user);
    const engineerId = admin ? (req.body.engineerId || req.body.receiverId) : req.user.id;
    if (!engineerId || engineerId === OFFICE) return res.status(400).json({ error: 'Choose who to message.' });
    if (!(await mayOpen(req, engineerId))) return res.status(403).json({ error: 'That person is not in your branch.' });

    const text = String(req.body.text || '').trim().slice(0, MAX_TEXT);
    const attachmentType = req.body.attachmentType || null;
    if (!text && !req.body.attachmentUrl) return res.status(400).json({ error: 'Message is empty.' });
    if (attachmentType && !['photo', 'gallery', 'document', 'location'].includes(attachmentType)) {
      return res.status(400).json({ error: 'Unsupported attachment.' });
    }

    const saved = await ChatMessage.create({
      senderId: admin ? OFFICE : req.user.id,
      receiverId: admin ? engineerId : OFFICE,
      sentBy: req.user.id,
      sentByName: req.user.name || req.user.username,
      caseId: req.body.caseId || null,
      text,
      attachmentUrl: req.body.attachmentUrl || null,
      attachmentType,
      attachmentMetadata: req.body.attachmentMetadata || {},
      timestamp: new Date(),
    });

    // Phone alert for the other side (shown as a push, not in the bell list)
    const body = preview(saved).slice(0, 120);
    if (admin) {
      notifyLater({ to: engineerId, type: 'chat_message', priority: 'urgent', title: `${req.user.name || 'Office'}`, message: body });
    } else {
      notifyLater({ to: OFFICE, branchId: req.user.branchId || null, type: 'chat_message', priority: 'urgent', title: req.user.name || 'Engineer', message: body });
    }
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- Older routes, kept for the unread badge polling in the admin portal ----

// GET /api/chat/admin/users — [{ userId, lastMessage, lastMessageTime, unreadCount }]
router.get('/admin/users', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.json([]);
    const people = await engineersFor(req);
    const out = await Promise.all(people.map(async (p) => {
      const last = await ChatMessage.findOne(threadQuery(p.id)).sort({ timestamp: -1 }).lean();
      if (!last) return null;
      const unreadCount = await ChatMessage.countDocuments({ senderId: p.id, receiverId: OFFICE, isRead: false });
      return { userId: p.id, lastMessage: preview(last), lastMessageTime: last.timestamp, unreadCount };
    }));
    res.json(out.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
