// Signed-in devices ("sessions"), like Google's "Your devices": every login records the device, and the
// login token carries the session id (sid). Ending a session (the Super Admin, or the person themself)
// makes that token stop working at once and stops push notifications to that device.
const crypto = require('crypto');
const User = require('../models/User');

const MAX_SESSIONS = 15;        // newest kept per person
const TOUCH_EVERY_MS = 2 * 60 * 1000;

/** Client IP behind Render's proxy */
function clientIp(req) {
  // Render sits behind Cloudflare, which passes the visitor's real address in cf-connecting-ip
  const fwd = String(req.headers['cf-connecting-ip'] || req.headers['true-client-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = (fwd || req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64);
  return ip === '::1' || ip === '127.0.0.1' ? '' : ip;   // "this computer" is not a useful address
}

/** "Android phone · SM-A146B · Gouru app" / "iPhone · Gouru app" / "Chrome on Windows" */
function describeDevice(req) {
  const ua = String(req.headers['user-agent'] || '');
  const client = String(req.headers['x-client'] || '').toLowerCase();      // app-android / app-ios / web
  const isApp = client.startsWith('app-') || /; wv\)/.test(ua);
  let kind = 'Computer';
  let model = '';
  const android = /Android\s[\d.]+;\s*([^;)]+?)(?:\sBuild\/|\)|;)/.exec(ua);
  if (/Android/i.test(ua)) {
    kind = /Mobile/i.test(ua) ? 'Android phone' : 'Android tablet';
    if (android && !/^(K|wv|Linux)$/i.test(android[1].trim())) model = android[1].trim();
  } else if (/iPad/i.test(ua) || client === 'app-ios-ipad') kind = 'iPad';
  else if (/iPhone/i.test(ua)) kind = 'iPhone';
  else if (client === 'app-ios') kind = 'iPhone / iPad';
  else if (/Macintosh|Mac OS X/i.test(ua)) kind = 'Mac';
  else if (/Windows/i.test(ua)) kind = 'Windows PC';
  else if (/Linux/i.test(ua)) kind = 'Linux PC';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  const platform = /Android/i.test(ua) || client === 'app-android' ? 'android'
    : /iPhone|iPad/i.test(ua) || client.startsWith('app-ios') ? 'ios' : 'web';
  const via = isApp ? 'Gouru app' : browser ? `${browser} browser` : 'Browser';
  // The phone app sends its real brand / model / name (x-device): "Ravi's Galaxy (Samsung Galaxy A14 5G)"
  const { fromHeader, modelName } = require('./deviceNames');
  const real = fromHeader(req.headers['x-device']);
  if (real) {
    const label = real.ownName ? `${real.ownName} (${real.name})` : real.name;
    return { device: `${label} · ${via}`.slice(0, 120), platform, app: isApp };
  }
  // Older app builds: turn a Samsung code from the browser's own text into its name when we know it
  if (model) {
    const named = modelName(/Android/i.test(ua) && /^SM-/i.test(model) ? 'samsung' : '', model);
    if (named && named !== model) return { device: `${named} · ${via}`.slice(0, 120), platform, app: isApp };
  }
  return { device: [kind, model, via].filter(Boolean).join(' · ').slice(0, 120), platform, app: isApp };
}

/** A new session for this login → its sid (kept in the token) */
async function startSession(user, req) {
  const sid = crypto.randomBytes(12).toString('hex');
  const now = new Date();
  const { device, platform, app } = describeDevice(req);
  await User.updateOne({ id: user.id }, {
    $push: { sessions: { $each: [{ sid, device, platform, app, ip: clientIp(req), createdAt: now, lastSeenAt: now,
      deviceId: String(req.headers['x-device-id'] || '').replace(/[^\w-]/g, '').slice(0, 64) }], $slice: -MAX_SESSIONS } },
  });
  return sid;
}

/**
 * Is this token's session still signed in? → null if fine, else the reason.
 * Tokens from before device tracking (no sid) work until "Sign out of all devices".
 */
function sessionProblem(user, decoded) {
  if (decoded.sid) return (user.sessions || []).some((s) => s.sid === decoded.sid) ? null : 'one';
  // An old token without a session: ended by "Sign out of all devices" (iat is in whole seconds)
  if (user.sessionsRevokedBefore && (decoded.iat || 0) * 1000 < new Date(user.sessionsRevokedBefore).getTime()) return 'all';
  return null;
}

/** Last active time (at most every 2 minutes, so it costs nothing) */
function touchSession(user, sid, req) {
  if (!sid) return;
  const s = (user.sessions || []).find((x) => x.sid === sid);
  if (!s || (s.lastSeenAt && Date.now() - new Date(s.lastSeenAt).getTime() < TOUCH_EVERY_MS)) return;
  User.updateOne({ id: user.id, 'sessions.sid': sid }, { $set: { 'sessions.$.lastSeenAt': new Date(), 'sessions.$.ip': clientIp(req) } }).catch(() => {});
}

/** End one session (and its push notifications). forget: the device also needs approval again to sign in. */
async function endSession(userId, sid, { forget = false } = {}) {
  const u = await User.findOne({ id: userId }).select('sessions').lean();
  const s = (u?.sessions || []).find((x) => x.sid === sid);
  if (!s) return false;
  await User.updateOne({ id: userId }, { $pull: { sessions: { sid } } });
  if (s.pushToken) await User.updateOne({ id: userId }, { $pull: { pushTokens: { token: s.pushToken } } });
  if (forget && s.deviceId) await User.updateOne({ id: userId }, { $pull: { trustedDevices: { deviceId: s.deviceId } } });
  return true;
}

/** End every session, including old tokens from before device tracking */
async function endAllSessions(userId) {
  await User.updateOne({ id: userId }, { $set: { sessions: [], pushTokens: [], trustedDevices: [], sessionsRevokedBefore: new Date() } });
}

/** For the Devices list (newest activity first) */
function listSessions(user, currentSid) {
  return (user.sessions || [])
    .map((s) => ({ sid: s.sid, device: s.device, platform: s.platform, app: !!s.app, ip: s.ip, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, current: s.sid === currentSid }))
    .sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
}

module.exports = { startSession, sessionProblem, touchSession, endSession, endAllSessions, listSessions, describeDevice, clientIp };
