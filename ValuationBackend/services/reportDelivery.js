// Approved report → the bank.
//  • A signed download link (30 days) that opens without a login — for email / WhatsApp.
//  • Email with the report attached, sent automatically on approval when the server has email set up
//    (EMAIL_ENABLED + SMTP_HOST / SMTP_PORT / SMTP_USERNAME / SMTP_PASSWORD / EMAIL_FROM) and the bank
//    has an email for that branch (Settings → Banks → Report delivery).
//  • The bank employee who raised the request is told in the app either way.

const crypto = require('crypto');
const ValuationCase = require('../models/ValuationCase');
const Bank = require('../models/Bank');
const { config } = require('../config/env');
const { notify } = require('./notify');
const { findBank } = require('./banks');

const SECRET = () => `report-share:${config.JWT_SECRET || process.env.JWT_SECRET || 'dev_only_super_secure_jwt_secret_2026'}`;
const DAYS = 30;

function sign(id, v, exp) {
  return crypto.createHmac('sha256', SECRET()).update(`${id}:${v}:${exp}`).digest('hex').slice(0, 40);
}

function shareLink(baseUrl, c) {
  const v = c.version || 1;
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  return `${baseUrl.replace(/\/$/, '')}/api/cases/${encodeURIComponent(c.id)}/shared-report?v=${v}&exp=${exp}&sig=${sign(c.id, v, exp)}`;
}

function checkLink(id, v, exp, sig) {
  if (!id || !v || !exp || !sig) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  const want = sign(id, v, exp);
  return want.length === String(sig).length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(String(sig)));
}

/** The bank's contact for this case's branch: { email, phone, branch } */
async function contactFor(c) {
  const bank = c.bankId ? await Bank.findOne({ id: c.bankId }).lean() : await findBank(c.bankName);
  if (!bank) return { bank: null, email: '', phone: '', branch: c.bankBranch || '' };
  const b = String(c.bankBranch || '').trim().toLowerCase();
  const row = (bank.contacts || []).find((r) => String(r.branch || '').trim().toLowerCase() === b)
    || (bank.contacts || []).find((r) => b && String(r.branch || '').toLowerCase().includes(b));
  return { bank, email: (row && row.email) || bank.email || '', phone: (row && row.phone) || '', branch: c.bankBranch || '' };
}

const env = (k) => config[k] ?? process.env[k];
const emailReady = () => String(env('EMAIL_ENABLED')).toLowerCase() === 'true'
  && env('SMTP_HOST') && env('SMTP_USERNAME') && env('SMTP_PASSWORD') && env('EMAIL_FROM');

function messageFor(c, link) {
  const subject = `Valuation report – ${c.clientName || 'Customer'} – ${c.fileNumber || `#${c.id}`}`;
  const text = [
    `Dear Sir/Madam,`,
    ``,
    `Please find the approved valuation report for ${c.clientName || 'the customer'} (${c.fileNumber || `#${c.id}`}).`,
    c.valuation?.fairMarketValue ? `Fair market value: Rs. ${Math.round(c.valuation.fairMarketValue).toLocaleString('en-IN')}` : '',
    ``,
    `Report: ${link}`,
    `Documents (deed, plan, tax receipt, site photos): ${link}&part=docs`,
    `(The link works for ${DAYS} days.)`,
    ``,
    `Regards,`,
    `Gouru Valuations`,
  ].filter((l) => l !== null).join('\n');
  return { subject, text };
}

const ANNEX_EMAIL_MAX = 8 * 1024 * 1024; // larger annexures stay in the app (most mail servers refuse big mails)

async function sendEmail(to, c, link, attachment, { withDocs = true } = {}) {
  const nodemailer = require('nodemailer');
  const port = Number(env('SMTP_PORT') || 587);
  const t = nodemailer.createTransport({
    host: env('SMTP_HOST'), port, secure: port === 465,
    auth: { user: env('SMTP_USERNAME'), pass: env('SMTP_PASSWORD') },
  });
  const { subject, text } = messageFor(c, link);
  const attachments = attachment ? [attachment] : [];
  if (c.billing && c.billing.invoiceNo && c.billing.feeSet && c.billing.status !== 'cancelled') {
    try {
      const { invoicePdf } = require('./billing');
      attachments.push({ filename: `Invoice_${c.billing.invoiceNo.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`, content: await invoicePdf(c) });
    } catch (err) { console.warn('invoice attach:', err.message); }
  }
  if (withDocs) {
    try {
      const { annexurePdf } = require('./annexure');
      const full = await ValuationCase.findOne({ id: c.id }).select('id fileNumber clientName borrowerName bankName bankBranch assignedEngineerName inspectionDate documents sitePhotos siteSelfie aiReview').lean();
      const a = await annexurePdf(full || c);
      if (a.pdf.length <= ANNEX_EMAIL_MAX) attachments.push({ filename: a.filename, content: a.pdf });
    } catch (err) { console.warn('documents annexure attach:', err.message); }
  }
  await t.sendMail({ from: env('EMAIL_FROM'), to, subject, text, attachments });
}

/**
 * Run after approval. Never throws. Saves case.delivery = { status, at, email, phone, link, error? }
 * status: 'emailed' | 'ready' (link ready, send by hand) | 'failed'
 */
/** The approved report file (archived at submit; archived now if that was missed) */
async function reportFile(c, format = 'docx') {
  const { getArchivedReport, archiveCaseReport } = require('./reportArchiveService');
  const who = { username: 'report-delivery', role: 'SYSTEM' };
  const v = c.version || 1;
  let a = await getArchivedReport(c.id, v, format, who);
  if (!a || !a.found) {
    try {
      const full = await ValuationCase.findOne({ id: c.id });
      await archiveCaseReport(full.toObject(), v, { id: 'SYSTEM', username: 'report-delivery', name: 'Report delivery', role: 'SYSTEM' });
      a = await getArchivedReport(c.id, v, format, who);
    } catch (err) { console.warn('report archive for delivery:', err.message); }
  }
  if (a && a.found && !a.corrupted && a.buffer) return a;
  // Last resort: build the Word report now (same builder as the report screen)
  if (format !== 'docx') return null;
  try {
    const fs = require('fs'); const path = require('path'); const os = require('os');
    const { spawnSync } = require('child_process');
    const { bankInfoForReport } = require('./banks');
    const full = await ValuationCase.findOne({ id: c.id }).lean();
    const data = await bankInfoForReport(full);
    const stamp = `${c.id}_${Date.now()}`;
    const jsonPath = path.join(os.tmpdir(), `share_${stamp}.json`);
    const docxPath = path.join(os.tmpdir(), `share_${stamp}.docx`);
    fs.writeFileSync(jsonPath, JSON.stringify(data), 'utf-8');
    const r = await require('./runPython').runPython([path.join(__dirname, 'masterDocxGenerator.py'), jsonPath, docxPath], { timeout: 150000 });
    try { fs.unlinkSync(jsonPath); } catch { /* ignore */ }
    if (r.status !== 0 || !fs.existsSync(docxPath)) return null;
    const buffer = fs.readFileSync(docxPath);
    try { fs.unlinkSync(docxPath); } catch { /* ignore */ }
    const safe = String(c.fileNumber || c.id).replace(/[^a-zA-Z0-9]+/g, '-');
    return { found: true, buffer, filename: `Valuation_Report_${safe}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  } catch (err) {
    console.warn('report build for delivery:', err.message);
    return null;
  }
}

async function deliverReport(caseId, { baseUrl, actor = 'auto', quiet = false, withDocs = true } = {}) {
  try {
    const c = await ValuationCase.findOne({ id: caseId }).lean();
    if (!c || c.status !== 'Approved') return null;
    const link = shareLink(baseUrl, c);
    const contact = await contactFor(c);
    const delivery = { status: 'ready', at: new Date(), email: contact.email, phone: contact.phone, branch: contact.branch, link, by: actor };

    const auto = !contact.bank || contact.bank.autoSend !== false;
    if (auto && contact.email && emailReady()) {
      try {
        let attachment = null;
        const a = await reportFile(c, 'docx');
        if (a) attachment = { filename: a.filename || `Valuation_${c.fileNumber || c.id}.docx`, content: a.buffer };
        await sendEmail(contact.email, c, link, attachment, { withDocs });
        delivery.status = 'emailed';
      } catch (err) {
        delivery.status = 'failed'; delivery.error = String(err.message || err).slice(0, 200);
      }
    }
    await ValuationCase.updateOne({ id: c.id }, { $set: { delivery } });

    // The bank employee who asked for this valuation
    if (!quiet && c.requestedBy && c.requestedBy.id) {
      notify({ to: c.requestedBy.id, type: 'report_ready', caseId: c.id, priority: 'normal',
        title: 'Valuation report ready', message: `${c.clientName || 'Your request'} · ${c.fileNumber || `#${c.id}`} is approved. Open the app to download.` }).catch(() => {});
    }
    // Tell the admins when it still has to be sent by hand
    if (!quiet && delivery.status !== 'emailed') {
      notify({ to: 'ADMIN', branchId: c.branchId || null, type: 'report_delivery', caseId: c.id, priority: 'normal',
        title: delivery.status === 'failed' ? 'Report email failed' : 'Send report to the bank',
        message: `${c.fileNumber || `#${c.id}`} · ${c.bankName}${c.bankBranch ? ` ${c.bankBranch}` : ''}: ${delivery.status === 'failed' ? delivery.error : 'tap Send to bank to email or WhatsApp it.'}` }).catch(() => {});
    }
    return delivery;
  } catch (err) {
    console.warn('report delivery:', err.message);
    return null;
  }
}

module.exports = { reportFile, deliverReport, shareLink, checkLink, contactFor, messageFor, emailReady };
