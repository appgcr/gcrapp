const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { config } = require('../config/env');

const JWT_SECRET = config.JWT_SECRET || process.env.JWT_SECRET || 'dev_only_super_secure_jwt_secret_2026';


// A bank employee's login is limited to its own requests (everything else is refused)
const BANK_ALLOWED = [
  /^\/api\/bank(\/|$)/,
  /^\/api\/auth\/(me|logout|refresh)(\/|$)/,
  /^\/api\/users\/[^/]+$/,                 // update own name / phone / password (checked in the route)
  /^\/api\/users\/[^/]+\/(push-token|notification-prefs|activity)$/,
];
// Notifications: only reading their own list, marking read, and "opened"
const BANK_NOTIFICATIONS = [['GET', /^\/api\/notifications\/(?!ADMIN$|stats$)[^/]+$/], ['PUT', /^\/api\/notifications\/[^/]+\/read$/], ['POST', /^\/api\/notifications\/opened$/]];
function bankMayUse(req) {
  const path = (req.originalUrl || '').split('?')[0];
  if (BANK_NOTIFICATIONS.some(([m, rx]) => req.method === m && rx.test(path))) return true;
  return BANK_ALLOWED.some((rx) => rx.test(path));
}

/**
 * Middleware: Verify JWT Bearer Token
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

    if (!token) {
      // Old "x-user-id header only" access is switched off: anyone could send another person's id.
      // A real login token is required (the app always sends one).
      const legacyUserId = process.env.ALLOW_LEGACY_USER_HEADER === 'true' ? req.headers['x-user-id'] : null;
      if (legacyUserId) {
        const user = await User.findOne({ $or: [{ id: legacyUserId }, { username: legacyUserId }] });
        if (user) {
          if (user.status && user.status !== 'Active') {
            return res.status(403).json({ error: 'Account is deactivated. Contact Administrator.' });
          }
          if (user.role === 'BANK') return res.status(401).json({ error: 'Access token required.' });
          req.user = user;
          return next();
        }
      }
      return res.status(401).json({ error: 'Access token required.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ $or: [{ id: decoded.id }, { username: decoded.username }] });

    if (!user) {
      return res.status(401).json({ error: 'Invalid or revoked token.' });
    }

    if (user.status && user.status !== 'Active') {
      return res.status(403).json({ error: 'Account is deactivated. Contact Administrator.' });
    }

    req.user = user;
    if (user.role === 'BANK' && !bankMayUse(req)) {
      return res.status(403).json({ error: 'Bank accounts can only send and follow their own valuation requests.' });
    }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please re-login.' });
    }
    return res.status(403).json({ error: 'Invalid authentication token.' });
  }
}

/**
 * Middleware: Require one or more roles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access requires one of [${allowedRoles.join(', ')}] role.`
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
