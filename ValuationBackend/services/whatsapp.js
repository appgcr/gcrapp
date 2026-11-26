// WhatsApp messages from the office number (Meta WhatsApp Cloud API). Used for fee reminders to the bank branch.
// Messages the office starts must use a template approved by Meta (ENVIRONMENT_CREDENTIAL_CHECKLIST.md, group L).
// Off until WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_REMINDER_TEMPLATE are set; never sends on staging.
const env = (k) => String(process.env[k] || '').trim();

function ready() {
  if (require('./testServer').outgoingBlocked()) return false;
  return !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID') && env('WHATSAPP_REMINDER_TEMPLATE'));
}

/** "98765 43210" / "+91 98765-43210" → "919876543210" (India); '' when not a mobile number */
function toWaNumber(phone) {
  // Only clear mobile numbers: 10 digits starting 6-9, or with +91 / 91. A leading 0 is not guessed — "08562 245678"
  // is a Kadapa landline, not a mobile.
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) d = `91${d}`;
  return /^91[6-9]\d{9}$/.test(d) ? d : '';
}

/**
 * Fee reminder (template parameters, in order): invoice no, amount due, customer + file no, days since invoice, pay link.
 * → { sent: true, id } or { sent: false, reason }
 */
async function sendFeeReminder(phone, { invoiceNo, amount, customer, days, link }) {
  if (!ready()) return { sent: false, reason: 'not-set-up' };
  const to = toWaNumber(phone);
  if (!to) return { sent: false, reason: 'no-mobile' };
  const params = [invoiceNo, amount, customer, String(days), link].map((t) => ({ type: 'text', text: String(t || '-').slice(0, 300) }));
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'template',
        template: { name: env('WHATSAPP_REMINDER_TEMPLATE'), language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'en' }, components: [{ type: 'body', parameters: params }] },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { sent: false, reason: (j.error && j.error.message) || `HTTP ${r.status}` };
    return { sent: true, id: j.messages && j.messages[0] && j.messages[0].id };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { ready, toWaNumber, sendFeeReminder };
