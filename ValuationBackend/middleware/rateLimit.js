// Simple in-memory request limits (one server instance; resets on restart).
//   limit({ name, windowMs, max, key, onlyFailures, message })
// onlyFailures: count a request only when the answer is 4xx (wrong password) — a success clears the count.

const buckets = new Map(); // name:key → { n, until }

function limit({ name, windowMs, max, key = (req) => req.ip, onlyFailures = false, message }) {
  return (req, res, next) => {
    const id = `${name}:${key(req)}`;
    const now = Date.now();
    let b = buckets.get(id);
    if (!b || b.until <= now) { b = { n: 0, until: now + windowMs }; buckets.set(id, b); }
    if (b.n >= max) {
      const mins = Math.max(1, Math.ceil((b.until - now) / 60000));
      res.setHeader('Retry-After', String(Math.ceil((b.until - now) / 1000)));
      return res.status(429).json({ error: message ? message(mins) : `Too many requests. Please wait ${mins} minute${mins > 1 ? 's' : ''} and try again.` });
    }
    if (!onlyFailures) { b.n += 1; return next(); }
    res.on('finish', () => {
      if (res.statusCode >= 400 && res.statusCode < 500) b.n += 1;
      else if (res.statusCode < 300) buckets.delete(id);
    });
    return next();
  };
}

// Forget old entries every 10 minutes
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.until <= now) buckets.delete(k); }, 10 * 60 * 1000).unref();

const userOrIp = (req) => {
  const h = req.headers.authorization || '';
  return h ? h.slice(-24) : req.ip; // same login → same bucket, without decoding the token here
};

module.exports = { limit, userOrIp, _buckets: buckets };
