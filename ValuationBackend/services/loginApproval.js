// Sign-in on a new device needs the Super Admin's approval (engineers and branch admins).
// Each phone / computer has a lasting device id (the app sends x-device-id). An approved device is
// remembered on the person (trustedDevices) and signs in normally after that. Signing the device out in
// Staff → person → Devices forgets it again.
const crypto = require('crypto');
const User = require('../models/User');
const LoginRequest = require('../models/LoginRequest');

const WAIT_MS = 15 * 60 * 1000;                       // a request is valid for 15 minutes
const ROLES = ['ENGINEER', 'ADMIN'];
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const deviceIdOf = (req) => String(req.headers['x-device-id'] || '').replace(/[^\w-]/g, '').slice(0, 64);

async function enabled() {
  const AppConfig = require('../models/AppConfig');
  const cfg = await AppConfig.findOne({ key: 'global' }).select('loginApproval').lean().catch(() => null);
  return cfg?.loginApproval !== false;
}

/** The App Review demo office signs in without approval (Apple's reviewers can't wait for a tap) */
async function exempt(user) {
  if (!user.branchId) return false;
  const Branch = require('../models/Branch');
  const b = await Branch.findOne({ id: user.branchId }).select('code name').lean().catch(() => null);
  return !!b && (String(b.code).toUpperCase() === 'DEMO' || /app\s*review/i.test(b.name || ''));
}

/** Must this sign-in wait for approval? */
async function needsApproval(user, req) {
  if (!ROLES.includes(user.role)) return false;
  if (!(await enabled())) return false;
  if (await exempt(user)) return false;
  const deviceId = deviceIdOf(req);
  return !(deviceId && (user.trustedDevices || []).some((d) => d.deviceId === deviceId));
}

/** Holds the sign-in, tells the Super Admin → { requestId, pollKey } for the phone */
async function createRequest(user, req) {
  const { describeDevice, clientIp } = require('./sessions');
  const deviceId = deviceIdOf(req);
  // One open request per person and device: a second try replaces the first
  await LoginRequest.deleteMany({ userId: user.id, deviceId, status: 'pending' });
  const pollKey = crypto.randomBytes(18).toString('hex');
  const r = await LoginRequest.create({
    id: `LR-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId: user.id, userName: user.name || user.username, role: user.role, branchId: user.branchId || null,
    deviceId, device: describeDevice(req).device, ip: clientIp(req), pollKeyHash: hash(pollKey),
  });
  const { notify } = require('./notify');
  const who = user.role === 'ADMIN' ? 'Branch admin' : 'Engineer';
  notify({
    to: 'ADMIN', type: 'login_approval', priority: 'urgent', title: 'Approve sign-in?',
    message: `${who} ${r.userName} wants to sign in on a new device: ${r.device}. Open the app to approve or deny.`,
  }).catch(() => {});
  return { requestId: r.id, pollKey, device: r.device };
}

/** The phone asks: approved yet? → { status } or, once approved, the user to sign in (used once) */
async function poll(requestId, pollKey) {
  const r = await LoginRequest.findOne({ id: requestId });
  if (!r || r.pollKeyHash !== hash(pollKey)) return { status: 'unknown' };
  if (r.status === 'pending' && Date.now() - r.createdAt.getTime() > WAIT_MS) return { status: 'expired' };
  if (r.status !== 'approved') return { status: r.status };
  // Hand over once: a second poll gets nothing
  const won = await LoginRequest.findOneAndUpdate({ id: r.id, status: 'approved' }, { $set: { status: 'used' } }, { new: true });
  if (!won) return { status: 'used' };
  const user = await User.findOne({ id: r.userId });
  if (!user || (user.status && user.status !== 'Active')) return { status: 'denied' };
  return { status: 'approved', user };
}

/** Super Admin decides; approving remembers the device for that person */
async function decide(requestId, approve, admin) {
  const r = await LoginRequest.findOne({ id: requestId, status: 'pending' });
  if (!r) return { error: 'This request was already answered or has expired.' };
  if (Date.now() - r.createdAt.getTime() > WAIT_MS) return { error: 'This request has expired. Ask them to sign in again.' };
  r.status = approve ? 'approved' : 'denied';
  r.decidedAt = new Date();
  r.decidedBy = admin.name || admin.username || admin.id;
  await r.save();
  if (approve && r.deviceId) {
    await User.updateOne({ id: r.userId }, { $pull: { trustedDevices: { deviceId: r.deviceId } } });
    await User.updateOne({ id: r.userId }, {
      $push: { trustedDevices: { $each: [{ deviceId: r.deviceId, device: r.device, approvedAt: r.decidedAt, approvedBy: r.decidedBy }], $slice: -20 } },
    });
  }
  return { ok: true, request: r };
}

/** Waiting requests for the Super Admin (newest first) */
async function pending() {
  const since = new Date(Date.now() - WAIT_MS);
  return LoginRequest.find({ status: 'pending', createdAt: { $gte: since } }).sort({ createdAt: -1 })
    .select('id userId userName role branchId device ip createdAt').lean();
}

module.exports = { needsApproval, createRequest, poll, decide, pending, enabled, deviceIdOf };
