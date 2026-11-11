// Reversible encryption (AES-256-GCM) for the few secrets an admin must be able to read back,
// e.g. the login password an admin issued to an engineer. Login itself still checks the bcrypt hash.
const crypto = require('crypto');

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw && process.env.NODE_ENV === 'production') throw new Error('ENCRYPTION_KEY is not set');
  return crypto.createHash('sha256').update(raw || 'gcr-dev-only-encryption-key').digest();
}

function seal(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

function open(box) {
  if (!box) return null;
  const [v, iv, tag, enc] = String(box).split(':');
  if (v !== 'v1') return null;
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

module.exports = { seal, open };
