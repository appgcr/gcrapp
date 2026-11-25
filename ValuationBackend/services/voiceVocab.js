// Words Gouru AI should expect when it listens to an engineer of this branch: the banks and their branches,
// the engineers, the areas / villages / colonies of past cases, past customers' names and the spellings it
// learned from engineers' corrections. Telugu names and places are heard far better when it knows them.
const mongoose = require('mongoose');

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // branchId → { at, text }

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const top = (counts, n) => [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
const bump = (m, w) => { const k = clean(w); if (k.length >= 3 && k.length <= 40 && !/^\d/.test(k) && !/\d{3,}/.test(k)) m.set(k, (m.get(k) || 0) + 1); };

async function build(branchId) {
  if (mongoose.connection.readyState !== 1) return '';
  const Bank = require('../models/Bank');
  const User = require('../models/User');
  const Case = require('../models/ValuationCase');
  const VoiceWord = require('../models/VoiceWord');
  const [banks, people, cases, learned] = await Promise.all([
    Bank.find({ status: { $ne: 'Inactive' } }).select('name shortName aliases branches').lean().catch(() => []),
    User.find({ ...(branchId ? { branchId } : {}), role: { $in: ['ENGINEER', 'ADMIN'] } }).select('name').limit(60).lean().catch(() => []),
    Case.find(branchId ? { branchId } : {}).sort({ createdAt: -1 }).limit(400)
      .select('clientName clientFatherName address bankBranch propertyDetails.village propertyDetails.sheet').lean().catch(() => []),
    VoiceWord.find({ $or: [{ branchId: branchId || null }, { branchId: null }] }).sort({ count: -1, lastAt: -1 }).limit(150).lean().catch(() => []),
  ]);

  const places = new Map();
  const names = new Map();
  const branches = new Map();
  for (const c of cases) {
    const sh = (c.propertyDetails && c.propertyDetails.sheet) || {};
    [c.address, sh.address, sh.ownerAddress, sh.applicantAddress].forEach((a) => String(a || '').split(/[,;\n]/).forEach((part) => bump(places, part.replace(/^(door|d\.?\s*no|plot|survey|sy|ward)\b.*$/i, ''))));
    bump(places, c.propertyDetails && c.propertyDetails.village);
    [c.clientName, sh.ownerName, sh.applicantName].forEach((n) => bump(names, n));
    [c.clientFatherName, sh.ownerRelation, sh.applicantRelation].forEach((n) => bump(names, String(n || '').replace(/^(s|w|d|c)\s*\/\s*o\.?\s*/i, '')));
    Object.values(sh.boundaries || {}).forEach((b) => { const m = /(?:of|gari)\s+(.+)$/i.exec(String(b || '')); if (m) bump(names, m[1]); });
    bump(branches, c.bankBranch);
  }

  const lines = [];
  if (banks.length) {
    lines.push('Banks (write the full name): ' + banks.map((b) => {
      const alt = [b.shortName, ...(b.aliases || [])].filter(Boolean);
      const br = (b.branches || []).filter(Boolean);
      return `${b.name}${alt.length ? ` (also said: ${alt.join(', ')})` : ''}${br.length ? ` — branches: ${br.join(', ')}` : ''}`;
    }).join('; '));
  }
  const brs = top(branches, 40);
  if (brs.length) lines.push('Bank branches used before: ' + brs.join(', '));
  const eng = people.map((p) => clean(p.name)).filter(Boolean);
  if (eng.length) lines.push('Engineers of this office: ' + eng.join(', '));
  const pl = top(places, 150);
  if (pl.length) lines.push('Areas, villages, colonies and townships of past cases: ' + pl.join(', '));
  const nm = top(names, 150);
  if (nm.length) lines.push('Names from past cases (owners, relations, neighbours): ' + nm.join(', '));
  const fixes = learned.filter((w) => w.heard && w.fixed).map((w) => `"${w.heard}" → "${w.fixed}"`);
  if (fixes.length) lines.push('Corrections engineers made before (when you hear the first, write the second): ' + fixes.join('; '));
  return lines.join('\n').slice(0, 12000);
}

/** The word list for this engineer's branch (cached for 10 minutes) */
async function vocabFor(user) {
  const key = (user && user.branchId) || '_all';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;
  let text = '';
  try { text = await build(user && user.branchId); } catch (err) { console.warn('voice vocab:', err.message); }
  cache.set(key, { at: Date.now(), text });
  return text;
}
const forget = (branchId) => { cache.delete(branchId || '_all'); };

module.exports = { vocabFor, forget };
