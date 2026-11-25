// Gouru AI (Gemini) health: every Gemini call reports its answer here. When Google says the quota is used up
// (HTTP 429 "exceeded your current quota") or the key is refused (401/403), engineers get a clear message instead of
// "could not hear that", the Super Admin is told at once (at most every 6 hours), and the admin dashboard shows it.
const ALERT_EVERY_MS = 6 * 60 * 60 * 1000;
const CLEAR_AFTER_MS = 20 * 60 * 1000; // a quota problem not seen for 20 minutes is taken as over

const state = { quotaAt: 0, keyAt: 0, lastOkAt: 0, alertedAt: 0, detail: '' };

function alertAdmins(kind) {
  if (Date.now() - state.alertedAt < ALERT_EVERY_MS) return;
  state.alertedAt = Date.now();
  try {
    const { notify } = require('./notify');
    notify({
      to: 'ADMIN', type: 'system', priority: 'urgent',
      title: kind === 'quota' ? 'Gouru AI limit reached' : 'Gouru AI key refused',
      message: kind === 'quota'
        ? 'Google has stopped Gouru AI for now (quota used up). Voice fill, document reading and the review call are paused. Raise the limit / add billing in Google AI Studio.'
        : 'Google refused the Gouru AI key. Voice fill and document reading are off until the GEMINI_API_KEY is fixed on the server.',
    }).catch(() => {});
  } catch { /* alerts are best effort */ }
}

/** Every Gemini answer: status code (+ the error text when not OK) */
function note(status, text = '') {
  if (status >= 200 && status < 300) { state.lastOkAt = Date.now(); return; }
  if (status === 429 && /quota|exceeded|billing|resource.?exhausted/i.test(text)) {
    state.quotaAt = Date.now(); state.detail = String(text).replace(/\s+/g, ' ').slice(0, 200); alertAdmins('quota');
  } else if (status === 401 || status === 403) {
    state.keyAt = Date.now(); state.detail = String(text).replace(/\s+/g, ' ').slice(0, 200); alertAdmins('key');
  }
}

function status() {
  const now = Date.now();
  const quota = state.quotaAt && now - state.quotaAt < CLEAR_AFTER_MS && state.quotaAt > state.lastOkAt;
  const key = state.keyAt && now - state.keyAt < CLEAR_AFTER_MS && state.keyAt > state.lastOkAt;
  return { ok: !quota && !key, problem: quota ? 'quota' : key ? 'key' : '', since: quota ? state.quotaAt : key ? state.keyAt : 0, lastOkAt: state.lastOkAt };
}

/** The message for the engineer when Gouru AI gave no answer */
function failMessage(fallback) {
  const s = status();
  if (s.problem === 'quota') return 'Gouru AI has reached its daily limit, so it cannot read this now. Please type the details — the office has been told.';
  if (s.problem === 'key') return 'Gouru AI is switched off on the server just now. Please type the details — the office has been told.';
  return fallback;
}

module.exports = { note, status, failMessage };
