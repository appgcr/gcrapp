const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { seal, open } = require('../services/secretBox');
const { authenticateToken, requireRole } = require('../middleware/auth');
const Branch = require('../models/Branch');
const { isSuper, isBranchAdmin, userFilter, canManageUser } = require('../services/access');

const PUBLIC_FIELDS = '-password -issuedPasswordEnc -credentials -currentChallenge -pushTokens -activityLog -notificationPrefs';

// GET /api/users — people this account may see:
//   Super Admin → everyone (or one branch via x-branch-scope); Branch Admin → their branch;
//   Engineer → themself and their branch admins (for chat)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filter = userFilter(req);
    // Super Admins are listed only for other Super Admins
    const users = await User.find(isSuper(req.user) ? filter : { $and: [filter, { role: { $ne: 'SUPER_ADMIN' } }] })
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:idOrUsername/push-token — register this phone for push notifications
// Body: { token, platform: 'android' | 'ios' | 'web' }. A user may only register their own device.
router.post('/:idOrUsername/push-token', authenticateToken, async (req, res) => {
  try {
    const { token, platform = 'android' } = req.body || {};
    if (!token || typeof token !== 'string' || token.length > 4096) {
      return res.status(400).json({ error: 'A valid push token is required.' });
    }
    const { idOrUsername } = req.params;
    if (req.user.id !== idOrUsername && req.user.username !== idOrUsername) {
      return res.status(403).json({ error: 'You can only register your own device.' });
    }
    // A device token belongs to one user at a time (handles shared phones / re-login)
    await User.updateMany({ id: { $ne: req.user.id } }, { $pull: { pushTokens: { token } } });
    await User.updateOne({ id: req.user.id }, { $pull: { pushTokens: { token } } });
    await User.updateOne(
      { id: req.user.id },
      { $push: { pushTokens: { $each: [{ token, platform, updatedAt: new Date() }], $slice: -10 } } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:idOrUsername/activity — app opened. Records the FIRST open of each
// India-time day (last 30 days) so morning summaries can arrive at the person's usual start time.
router.post('/:idOrUsername/activity', authenticateToken, async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    if (req.user.id !== idOrUsername && req.user.username !== idOrUsername) {
      return res.status(403).json({ error: 'You can only record your own activity.' });
    }
    const { istParts } = require('../services/istTime');
    const now = new Date();
    const today = istParts(now).ymd;
    const user = await User.findOne({ id: req.user.id }).select('activityLog');
    const log = user?.activityLog || [];
    const already = log.some((d) => istParts(new Date(d)).ymd === today);
    if (!already) {
      await User.updateOne({ id: req.user.id }, { $push: { activityLog: { $each: [now], $slice: -30 } } });
    }
    res.json({ recorded: !already });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:idOrUsername/notification-prefs — this person's alert switches
router.get('/:idOrUsername/notification-prefs', authenticateToken, async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    if (req.user.id !== idOrUsername && req.user.username !== idOrUsername) {
      return res.status(403).json({ error: 'You can only view your own notification settings.' });
    }
    const { categoriesForRole, prefValue } = require('../services/notificationCategories');
    const user = await User.findOne({ id: req.user.id }).select('role notificationPrefs');
    res.json({
      categories: categoriesForRole(user.role).map((c) => ({
        key: c.key, label: c.label, description: c.description, required: c.required,
        enabled: c.required ? true : prefValue(user.notificationPrefs, c.key),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:idOrUsername/notification-prefs — Body: { categoryKey: true|false, ... }
router.put('/:idOrUsername/notification-prefs', authenticateToken, async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    if (req.user.id !== idOrUsername && req.user.username !== idOrUsername) {
      return res.status(403).json({ error: 'You can only change your own notification settings.' });
    }
    const { categoriesForRole } = require('../services/notificationCategories');
    const user = await User.findOne({ id: req.user.id }).select('role notificationPrefs');
    const allowed = new Map(categoriesForRole(user.role).map((c) => [c.key, c]));
    const set = {};
    for (const [key, val] of Object.entries(req.body || {})) {
      const cat = allowed.get(key);
      if (!cat) return res.status(400).json({ error: `Unknown alert type: ${key}` });
      if (cat.required) return res.status(400).json({ error: `"${cat.label}" is always on.` });
      if (typeof val !== 'boolean') return res.status(400).json({ error: `${key} must be true or false` });
      set[`notificationPrefs.${key}`] = val;
    }
    await User.updateOne({ id: req.user.id }, { $set: set });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:idOrUsername/push-token — stop pushes to this phone (on logout)
router.delete('/:idOrUsername/push-token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token is required.' });
    const { idOrUsername } = req.params;
    if (req.user.id !== idOrUsername && req.user.username !== idOrUsername) {
      return res.status(403).json({ error: 'You can only remove your own device.' });
    }
    await User.updateOne({ id: req.user.id }, { $pull: { pushTokens: { token } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:idOrUsername
router.get('/:idOrUsername', authenticateToken, async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    const user = await User.findOne({
      $or: [{ id: idOrUsername }, { username: idOrUsername }]
    }).select(PUBLIC_FIELDS);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const self = user.id === req.user.id;
    if (!self && !isSuper(req.user) && !(isBranchAdmin(req.user) && user.branchId === req.user.branchId)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — Strictly restricted to SUPER_ADMIN
// Super Admin creates Branch Admins and Engineers (in any branch); a Branch Admin creates
// Engineers in their own branch only.
router.post('/', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { username, password, name, phone, licenseNo, branch } = req.body;
    const role = req.body.role || 'ENGINEER';
    if (!['ADMIN', 'ENGINEER', 'BANK'].includes(role)) {
      return res.status(400).json({ error: 'Only Branch Admin, Engineer or Bank Employee accounts can be created here.' });
    }
    // A bank employee belongs to one of the banks in Settings → Banks
    let bankRec = null;
    if (role === 'BANK') {
      const { findBank } = require('../services/banks');
      bankRec = await findBank(String(req.body.bankName || ''));
      if (!bankRec) return res.status(400).json({ error: 'Choose the employee’s bank from the bank list.' });
      if (!String(req.body.bankBranch || '').trim()) return res.status(400).json({ error: 'Enter the employee’s bank branch.' });
      if (!/^[6-9]\d{9}$/.test(String(phone || ''))) return res.status(400).json({ error: 'Enter the employee’s 10-digit mobile number.' });
    }
    if (role === 'ADMIN' && !isSuper(req.user)) {
      return res.status(403).json({ error: 'Only the Super Admin can create Branch Admins.' });
    }
    const branchId = isSuper(req.user) ? req.body.branchId : req.user.branchId;
    const branchDoc = branchId ? await Branch.findOne({ id: branchId }) : null;
    if (!branchDoc) return res.status(400).json({ error: 'Choose the branch for this account.' });
    
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = await User.findOne({ username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const rawPassword = typeof password === 'string' ? password.trim() : '';
    if (rawPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Next free number (never reuses an id, even after deletions)
    const prefix = role === 'ADMIN' ? 'BRA' : role === 'BANK' ? 'BNK' : 'ENG';
    const taken = await User.find({ id: new RegExp(`^${prefix}-`) }).select('id').lean();
    const max = taken.reduce((m, u) => Math.max(m, parseInt(u.id.split('-')[1], 10) || 0), 0);
    const customId = `${prefix}-${String(max + 1).padStart(3, '0')}`;

    const newUser = new User({
      id: customId,
      username: username.trim(),
      password: hashedPassword,
      issuedPasswordEnc: seal(rawPassword),
      issuedPasswordAt: new Date(),
      name: name.trim(),
      role,
      branchId: branchDoc.id,
      phone: phone || '',
      licenseNo: licenseNo || '',
      branch: branch || branchDoc.name,
      canSelfCase: role === 'ENGINEER' && req.body.canSelfCase === true,
      ...(role === 'BANK' ? {
        bankName: bankRec.name,
        bankBranch: String(req.body.bankBranch).trim().slice(0, 120),
        designation: String(req.body.designation || '').trim().slice(0, 80),
        email: String(req.body.email || '').trim().slice(0, 120),
      } : {}),
    });

    const saved = await newUser.save();
    const sanitized = saved.toObject();
    delete sanitized.password;
    delete sanitized.issuedPasswordEnc;
    delete sanitized.credentials;
    delete sanitized.currentChallenge;

    res.status(201).json(sanitized);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:username — Strictly restricted to SUPER_ADMIN
router.delete('/:username', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const target = await User.findOne({ $or: [{ username: req.params.username }, { id: req.params.username }] });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You can’t delete your own account.' });
    if (target.role === 'SUPER_ADMIN' || !canManageUser(req.user, target)) {
      return res.status(403).json({ error: 'Not allowed to delete this account.' });
    }
    await User.deleteOne({ id: target.id });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:username
// PUT /api/users/:username — update a profile. Requires login:
//   · a user may update their own name / phone / password
//   · a Super Admin may also update another user's name / phone / branch / licence / status
// Role, id, username, passkeys and push tokens can never be changed here.
router.put('/:username', authenticateToken, async (req, res) => {
  try {
    const target = await User.findOne({ $or: [{ username: req.params.username }, { id: req.params.username }] });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const isSelf = req.user.id === target.id;
    const manages = !isSelf && canManageUser(req.user, target);
    if (!isSelf && !manages) {
      return res.status(403).json({ error: 'You can only update your own profile.' });
    }

    const allowed = manages ? ['name', 'phone', 'branch', 'licenseNo', 'status'] : ['name', 'phone', 'password'];
    if (manages && target.role === 'BANK') allowed.push('bankBranch', 'designation', 'email');
    if (manages && target.role === 'ENGINEER') allowed.push('canSelfCase');
    if (req.body.canSelfCase !== undefined && allowed.includes('canSelfCase')) req.body.canSelfCase = req.body.canSelfCase === true;
    // Super Admin may move a Branch Admin / Engineer to another branch
    if (manages && isSuper(req.user) && req.body.branchId !== undefined && target.role !== 'SUPER_ADMIN') {
      if (!(await Branch.exists({ id: req.body.branchId }))) return res.status(400).json({ error: 'Branch not found.' });
      allowed.push('branchId');
    }
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    // Admins reset other people's passwords through /reset-password (so the new one is shown once)
    if (updateData.password !== undefined && !isSelf) delete updateData.password;
    if (updateData.password !== undefined) {
      const pw = typeof updateData.password === 'string' ? updateData.password.trim() : '';
      if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      updateData.password = await bcrypt.hash(pw, 10);
      // The engineer chose their own password — the admin no longer knows it
      updateData.issuedPasswordEnc = null;
      updateData.issuedPasswordAt = null;
      updateData.passwordChangedBySelfAt = new Date();
    }
    if (updateData.status !== undefined && !['Active', 'Inactive'].includes(updateData.status)) {
      return res.status(400).json({ error: 'status must be Active or Inactive.' });
    }
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'Nothing to update.' });

    const updated = await User.findOneAndUpdate(
      { id: target.id },
      { $set: updateData },
      { new: true }
    ).select(PUBLIC_FIELDS);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:idOrUsername/reset-password — Super Admin sets a new temporary password.
// Body: { password? } — if omitted a strong, easy-to-read one is generated.
// The new password is returned ONCE so the admin can share it; it is stored only as a hash.
router.post('/:idOrUsername/reset-password', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    const target = await User.findOne({ $or: [{ id: idOrUsername }, { username: idOrUsername }] });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id || !canManageUser(req.user, target)) {
      return res.status(403).json({ error: 'Not allowed to reset this password.' });
    }

    let pw = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (pw && pw.length < 8) return res.status(400).json({ error: 'Temporary password must be at least 8 characters.' });
    if (!pw) {
      // Readable but strong: e.g. "Kadapa-4827-Moon" style — no confusing 0/O, 1/l
      const crypto = require('crypto');
      const words = ['River', 'Mango', 'Tiger', 'Lotus', 'Cloud', 'Stone', 'Maple', 'Pearl', 'Comet', 'Cedar', 'Coral', 'Delta', 'Falcon', 'Harbor', 'Jasmine', 'Meadow'];
      const pick = () => words[crypto.randomInt(words.length)];
      pw = `${pick()}-${crypto.randomInt(2000, 9999)}-${pick()}`;
    }
    await User.updateOne({ id: target.id }, { $set: {
      password: await bcrypt.hash(pw, 10),
      issuedPasswordEnc: seal(pw),
      issuedPasswordAt: new Date(),
      passwordChangedBySelfAt: null,
    } });
    console.log(`🔑 Password reset for ${target.id} by ${req.user.id}`);
    res.json({ success: true, username: target.username, temporaryPassword: pw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:idOrUsername/issued-password — Super Admin reads the password they issued.
// Every view is logged. If the engineer has since set their own password, it is not available.
router.get('/:idOrUsername/issued-password', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    const target = await User.findOne({ $or: [{ id: idOrUsername }, { username: idOrUsername }] })
      .select('+issuedPasswordEnc id username role branchId issuedPasswordAt passwordChangedBySelfAt');
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id || !canManageUser(req.user, target)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    let password = null;
    try { password = open(target.issuedPasswordEnc); } catch { password = null; }
    console.log(`👁️ Issued password viewed for ${target.id} by ${req.user.id}`);
    res.json({
      username: target.username,
      password,
      issuedAt: target.issuedPasswordAt || null,
      changedByUserAt: target.passwordChangedBySelfAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:idOrUsername/face-enroll
router.post('/:idOrUsername/face-enroll', authenticateToken, async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    const target = await User.findOne({ $or: [{ id: idOrUsername }, { username: idOrUsername }] }).select('id role branchId');
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id !== req.user.id && !canManageUser(req.user, target)) {
      return res.status(403).json({ error: 'You can only set up Face ID for yourself or your own staff.' });
    }
    const { faceDescriptor, facePhotoUrl } = req.body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return res.status(400).json({ error: 'Valid faceDescriptor array is required' });
    }

    const updated = await User.findOneAndUpdate(
      { $or: [{ id: idOrUsername }, { username: idOrUsername }] },
      {
        $set: {
          faceDescriptor,
          facePhotoUrl: facePhotoUrl || '',
          faceEnrolled: true,
          faceEnrolledAt: new Date()
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Face profile successfully enrolled!',
      user: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        faceEnrolled: updated.faceEnrolled,
        faceEnrolledAt: updated.faceEnrolledAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
