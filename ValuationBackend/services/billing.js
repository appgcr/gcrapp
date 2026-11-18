// Fees and invoices for approved valuations.
//  • Fee = the bank's fee for the property type (Settings → Banks → Fees), editable per case.
//  • GST is added only when the firm's GSTIN is saved (Fees → Firm details); CGST + SGST halves.
//  • Invoice numbers run per branch and Indian financial year: GV/KDP/26-27/0001 (one unbroken series each).
//  • Every invoice carries a UPI QR for the exact amount and a signed payment page link.

const ValuationCase = require('../models/ValuationCase');
const Bank = require('../models/Bank');
const AppConfig = require('../models/AppConfig');
const Counter = require('../models/Counter');
const { findBank, CATEGORY_SLOT } = require('./banks');
const { istParts } = require('./istTime');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Branch = require('../models/Branch');

const round = (n) => Math.round(Number(n) || 0);

function slotFor(propertyType = '') {
  if (CATEGORY_SLOT[propertyType]) return CATEGORY_SLOT[propertyType];
  const t = propertyType.toLowerCase();
  if (/apart|flat/.test(t)) return 'apartment';
  if (/agri/.test(t)) return 'agriculture';
  if (/industr|shed|factory/.test(t)) return 'industrial';
  if (/site|plot|land/.test(t)) return 'openSite';
  return 'house';
}

async function firmDetails() {
  const cfg = await AppConfig.findOne({ key: 'global' }).select('billing').lean();
  const b = (cfg && cfg.billing) || {};
  return {
    name: b.name || 'Gouru Valuations', address: b.address || '', phone: b.phone || '', email: b.email || '',
    gstin: b.gstin || '', pan: b.pan || '', sac: b.sac || '', gstPercent: b.gstPercent == null || b.gstPercent === '' ? 18 : Number(b.gstPercent),
    bankName: b.bankName || '', accountName: b.accountName || '', accountNo: b.accountNo || '', ifsc: b.ifsc || '', upi: b.upi || '',
    prefix: b.prefix || 'GV', terms: b.terms || 'Payment due within 15 days.',
  };
}

function money(fee, firm) {
  const base = round(fee);
  const pct = firm.gstin ? Math.max(0, Number(firm.gstPercent) || 0) : 0;
  const gst = round((base * pct) / 100);
  return { fee: base, gstPercent: pct, cgst: Math.floor(gst / 2), sgst: gst - Math.floor(gst / 2), gst, total: base + gst };
}

function fyOf(date) {
  const [y, m] = istParts(date).ymd.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

async function defaultFee(c) {
  const bank = c.bankId ? await Bank.findOne({ id: c.bankId }).lean() : await findBank(c.bankName);
  const slot = slotFor((c.propertyDetails || {}).propertyType);
  const fee = bank && bank.fees ? bank.fees[slot] : null;
  return fee == null ? null : Number(fee);
}

/** Create the invoice for an approved case (once). → billing */
async function createInvoice(caseId, { by = 'system' } = {}) {
  const c = await ValuationCase.findOne({ id: caseId }).lean();
  if (!c || c.status !== 'Approved') return null;
  if (c.billing && c.billing.invoiceNo && c.billing.status !== 'cancelled') return c.billing;
  const firm = await firmDetails();
  const fee = await defaultFee(c);
  const at = new Date();
  const fy = fyOf(at);
  // One series per branch and financial year: GV/KDP/26-27/0001
  const br = c.branchId ? await Branch.findOne({ id: c.branchId }).select('code').lean() : null;
  const code = (br && br.code) || 'GV';
  const { seq } = await Counter.findOneAndUpdate({ key: `invoice:${code}:${fy}` }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  const billing = {
    invoiceNo: `${firm.prefix}/${code}/${fy.slice(2)}/${String(seq).padStart(4, '0')}`, invoiceDate: at, fy, branchCode: code,
    ...money(fee || 0, firm), feeSet: fee != null,
    status: 'unpaid', received: 0, payments: [], createdBy: by,
  };
  // Only set it if no one else did meanwhile (a cancelled invoice is kept in billingCancelled)
  const guard = c.billing && c.billing.status === 'cancelled'
    ? { id: c.id, 'billing.invoiceNo': c.billing.invoiceNo, 'billing.status': 'cancelled' }
    : { id: c.id, 'billing.invoiceNo': { $exists: false } };
  const update = { $set: { billing } };
  if (c.billing && c.billing.status === 'cancelled') update.$push = { billingCancelled: c.billing };
  const r = await ValuationCase.updateOne(guard, update);
  if (!r.modifiedCount) return (await ValuationCase.findOne({ id: c.id }).select('billing').lean()).billing;
  return billing;
}

function statusOf(b) {
  if (!b) return 'none';
  if (b.status === 'cancelled') return 'cancelled';
  if (b.received >= b.total && b.total > 0) return 'paid';
  if (b.received > 0) return 'partial';
  return 'unpaid';
}

async function setFee(caseId, fee, { by } = {}) {
  const c = await ValuationCase.findOne({ id: caseId }).lean();
  if (!c || !c.billing) throw new Error('No invoice on this case yet.');
  if (c.billing.status === 'cancelled') throw new Error('This invoice is cancelled. Create a new one.');
  const firm = await firmDetails();
  const m = money(fee, firm);
  const billing = { ...c.billing, ...m, feeSet: true, editedBy: by, editedAt: new Date() };
  billing.status = statusOf(billing);
  await ValuationCase.updateOne({ id: caseId }, { $set: { billing } });
  return billing;
}

async function addPayment(caseId, { amount, mode = '', ref = '', date, by }) {
  const c = await ValuationCase.findOne({ id: caseId }).lean();
  if (!c || !c.billing) throw new Error('No invoice on this case yet.');
  if (c.billing.status === 'cancelled') throw new Error('This invoice is cancelled.');
  const amt = round(amount);
  if (!(amt > 0)) throw new Error('Enter the amount received.');
  const pay = { amount: amt, mode: String(mode).slice(0, 30), ref: String(ref).slice(0, 60), date: date ? new Date(date) : new Date(), by, at: new Date() };
  const billing = { ...c.billing, payments: [...(c.billing.payments || []), pay] };
  billing.received = billing.payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  billing.status = statusOf(billing);
  if (billing.status === 'paid') billing.paidAt = pay.date;
  await ValuationCase.updateOne({ id: caseId }, { $set: { billing } });
  return billing;
}

async function removeLastPayment(caseId) {
  const c = await ValuationCase.findOne({ id: caseId }).lean();
  if (!c || !c.billing) throw new Error('No invoice on this case yet.');
  const payments = (c.billing.payments || []).slice(0, -1);
  const billing = { ...c.billing, payments, received: payments.reduce((a, p) => a + (Number(p.amount) || 0), 0) };
  billing.status = statusOf(billing);
  if (billing.status !== 'paid') delete billing.paidAt;
  await ValuationCase.updateOne({ id: caseId }, { $set: { billing } });
  return billing;
}

// ── Invoice PDF ────────────────────────────────────────────────────────────────
const inr = (n) => `Rs. ${round(n).toLocaleString('en-IN')}`;
const ascii = (s) => String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E\n]/g, '');

function words(n) {
  n = round(n);
  if (!n) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : `${t[Math.floor(x / 10)]}${x % 10 ? ` ${a[x % 10]}` : ''}`);
  const three = (x) => (x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${two(x % 100)}` : ''}` : two(x));
  const parts = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push(`${three(cr)} Crore`);
  if (lk) parts.push(`${two(lk)} Lakh`);
  if (th) parts.push(`${two(th)} Thousand`);
  if (n) parts.push(three(n));
  return parts.join(' ');
}

// ── Paying the invoice ────────────────────────────────────────────────────────────────
const PAY_DAYS = 120;
const PAY_SECRET = () => `invoice-pay:${process.env.JWT_SECRET || require('../config/env').config.JWT_SECRET || 'dev_only_super_secure_jwt_secret_2026'}`;
const paySig = (id, no, exp) => crypto.createHmac('sha256', PAY_SECRET()).update(`${id}:${no}:${exp}`).digest('hex').slice(0, 32);
/** Signed page where the bank / customer sees the invoice, the UPI QR and the bank details (no login) */
function payLink(baseUrl, c) {
  const exp = Math.floor(Date.now() / 1000) + PAY_DAYS * 86400;
  return `${String(baseUrl || '').replace(/\/$/, '')}/api/pay/${encodeURIComponent(c.id)}?e=${exp}&s=${paySig(c.id, c.billing.invoiceNo, exp)}`;
}
function checkPay(c, e, s) {
  if (!c || !c.billing || !e || !s || Number(e) * 1000 < Date.now()) return false;
  const want = paySig(c.id, c.billing.invoiceNo, e);
  return want.length === String(s).length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(String(s)));
}
const dueOf = (b) => Math.max(0, Math.round((b.total || 0) - (b.received || 0)));
/** upi://pay link for the amount still due (opens GPay / PhonePe / Paytm…) */
function upiLink(firm, c) {
  if (!firm.upi || !c.billing) return '';
  const q = new URLSearchParams({ pa: firm.upi, pn: firm.accountName || firm.name, am: String(dueOf(c.billing)), cu: 'INR',
    tn: `${c.billing.invoiceNo} ${c.fileNumber || ''}`.trim().slice(0, 60) });
  return `upi://pay?${q.toString()}`;
}
async function upiQrPng(firm, c) {
  const link = upiLink(firm, c);
  if (!link) return null;
  return require('qrcode').toBuffer(link, { width: 420, margin: 1, errorCorrectionLevel: 'M' });
}
const LOGO = path.join(__dirname, '..', 'assets', 'gouru_logo.png');

async function invoicePdf(c, { link = '' } = {}) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const firm = await firmDetails();
  const b = c.billing;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.06, 0.09, 0.16); const grey = rgb(0.4, 0.45, 0.52); const navy = rgb(0.07, 0.2, 0.45);
  let y = 800;
  const text = (s, x, yy, { f = font, size = 10, color = ink } = {}) => page.drawText(ascii(s), { x, y: yy, size, font: f, color });
  const right = (s, xr, yy, o = {}) => { const f = o.f || font; const size = o.size || 10; text(s, xr - f.widthOfTextAtSize(ascii(s), size), yy, o); };
  const line = (yy) => page.drawLine({ start: { x: 40, y: yy }, end: { x: 555, y: yy }, thickness: 0.7, color: rgb(0.8, 0.83, 0.87) });

  // Logo + firm name
  let lx = 40;
  try {
    const logo = await doc.embedPng(fs.readFileSync(LOGO));
    page.drawImage(logo, { x: 40, y: y - 26, width: 46, height: 46 });
    lx = 96;
  } catch { /* name only */ }
  text(firm.name, lx, y, { f: bold, size: 18, color: navy });
  right(firm.gstin ? 'TAX INVOICE' : 'INVOICE', 555, y, { f: bold, size: 14, color: navy });
  y -= 16;
  ascii(firm.address).split('\n').filter(Boolean).slice(0, 3).forEach((l) => { text(l, lx, y, { size: 9, color: grey }); y -= 12; });
  const contact = [firm.phone && `Ph: ${firm.phone}`, firm.email].filter(Boolean).join('  |  ');
  if (contact) { text(contact, lx, y, { size: 9, color: grey }); y -= 12; }
  const ids = [firm.gstin && `GSTIN: ${firm.gstin}`, firm.pan && `PAN: ${firm.pan}`].filter(Boolean).join('   ');
  if (ids) { text(ids, lx, y, { size: 9, color: grey }); y -= 12; }
  y = Math.min(y, 760);
  let ry = 782;
  right(`Invoice No: ${b.invoiceNo}`, 555, ry, { f: bold }); ry -= 14;
  right(`Date: ${new Date(b.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`, 555, ry); ry -= 18;
  // File number in its own box, so bank and customer can match it to the report
  const fileNo = `File No: ${c.fileNumber || `#${c.id}`}`;
  const fw = bold.widthOfTextAtSize(ascii(fileNo), 10.5) + 16;
  page.drawRectangle({ x: 555 - fw, y: ry - 6, width: fw, height: 20, color: rgb(0.93, 0.95, 0.98), borderColor: rgb(0.75, 0.82, 0.93), borderWidth: 0.8 });
  right(fileNo, 547, ry, { f: bold, size: 10.5, color: navy });
  y = Math.min(y, ry - 14, 735) - 8; line(y); y -= 20;

  text('Bill to', 40, y, { size: 9, color: grey }); text('Valuation', 320, y, { size: 9, color: grey }); y -= 14;
  text(c.bankName || 'Bank', 40, y, { f: bold, size: 11 });
  text(`Report: ${c.fileNumber || `#${c.id}`}`, 320, y, { size: 10 }); y -= 13;
  if (c.bankBranch) text(`${c.bankBranch} Branch`, 40, y);
  text(`Customer: ${c.clientName || '-'}`, 320, y); y -= 13;
  if (c.bankDistrict) text(c.bankDistrict, 40, y);
  text(`Property: ${(c.propertyDetails || {}).propertyType || '-'}`, 320, y); y -= 13;
  if (c.approvedAt) text(`Report approved: ${new Date(c.approvedAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 320, y);
  y -= 24;

  // Table
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 22, color: rgb(0.93, 0.95, 0.98) });
  text('Description', 48, y, { f: bold }); if (firm.sac) text('SAC', 360, y, { f: bold }); right('Amount', 547, y, { f: bold });
  y -= 26;
  text('Professional fee for property valuation report', 48, y);
  if (firm.sac) text(firm.sac, 360, y);
  right(inr(b.fee), 547, y); y -= 14;
  text(`${(c.propertyDetails || {}).propertyType || 'Property'} - ${c.clientName || ''}`, 48, y, { size: 9, color: grey }); y -= 18;
  line(y); y -= 18;
  const row = (label, val, o = {}) => { right(label, 440, y, o); right(val, 547, y, o); y -= 16; };
  row('Taxable value', inr(b.fee));
  if (b.gst) { row(`CGST @ ${b.gstPercent / 2}%`, inr(b.cgst)); row(`SGST @ ${b.gstPercent / 2}%`, inr(b.sgst)); }
  row('Total', inr(b.total), { f: bold, size: 12 });
  if (b.received) { row('Received', inr(b.received)); row('Balance due', inr(Math.max(0, b.total - b.received)), { f: bold }); }
  y -= 4;
  text(`Amount in words: Rupees ${words(b.total)} Only`, 40, y, { size: 9.5 }); y -= 26;

  if (firm.accountNo || firm.upi) {
    const top = y;
    text('Payment details', 40, y, { f: bold }); y -= 14;
    [firm.accountName && `Account name: ${firm.accountName}`, firm.bankName && `Bank: ${firm.bankName}`, firm.accountNo && `Account no: ${firm.accountNo}`,
      firm.ifsc && `IFSC: ${firm.ifsc}`, firm.upi && `UPI: ${firm.upi}`].filter(Boolean).forEach((l) => { text(l, 40, y, { size: 9.5 }); y -= 13; });
    // UPI QR for the exact amount due
    if (firm.upi && b.status !== 'cancelled' && dueOf(b) > 0) {
      try {
        const qr = await doc.embedPng(await upiQrPng(firm, c));
        page.drawImage(qr, { x: 440, y: top - 112, width: 108, height: 108 });
        right('Scan to pay with any UPI app', 555, top - 122, { size: 8.5, color: grey });
        right(`Rs. ${dueOf(b).toLocaleString('en-IN')}`, 555, top - 134, { f: bold, size: 9.5 });
        y = Math.min(y, top - 146);
      } catch { /* details only */ }
    }
    if (link) { text('Pay / download online:', 40, y, { size: 9, color: grey }); y -= 12; text(link.length > 95 ? `${link.slice(0, 95)}…` : link, 40, y, { size: 7.5, color: navy }); y -= 12; }
    y -= 8;
  }
  if (firm.terms) { text(firm.terms, 40, y, { size: 9, color: grey }); y -= 14; }
  if (!firm.gstin) { text('GST not charged (no GSTIN on record).', 40, y, { size: 8.5, color: grey }); }
  right(`For ${firm.name}`, 555, 120, { f: bold });
  right('Authorised signatory', 555, 80, { size: 9, color: grey });
  text('This is a computer-generated invoice.', 40, 50, { size: 8, color: grey });
  if (b.status === 'cancelled') {
    page.drawText('CANCELLED', { x: 150, y: 380, size: 72, font: bold, color: rgb(0.86, 0.15, 0.15), opacity: 0.25, rotate: { type: 'degrees', angle: 30 } });
    if (b.cancelled && b.cancelled.reason) text(`Cancelled: ${b.cancelled.reason}`, 40, 64, { size: 9, color: rgb(0.7, 0.1, 0.1) });
  }
  return Buffer.from(await doc.save());
}

/** Cancel an invoice (wrong fee / wrong bank). Payments must be undone first. */
async function cancelInvoice(caseId, { reason = '', by } = {}) {
  const c = await ValuationCase.findOne({ id: caseId }).lean();
  if (!c || !c.billing) throw new Error('No invoice on this case yet.');
  if (c.billing.status === 'cancelled') return c.billing;
  if ((c.billing.received || 0) > 0) throw new Error('Undo the payments on this invoice before cancelling it.');
  const why = String(reason || '').trim();
  if (!why) throw new Error('Write why the invoice is cancelled.');
  const billing = { ...c.billing, status: 'cancelled', cancelled: { at: new Date(), by, reason: why.slice(0, 200) } };
  await ValuationCase.updateOne({ id: caseId }, { $set: { billing } });
  return billing;
}

function csvOf(items) {
  // Text starting with = + - @ would run as a formula in Excel: prefix it with '
  const q = (v) => { let t = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const d = (x) => (x ? new Date(x).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '');
  const head = ['Invoice No', 'Invoice Date', 'File No', 'Customer', 'Bank', 'Branch', 'Property', 'Approved', 'Fee', 'CGST', 'SGST', 'Total', 'Received', 'Due', 'Status', 'Paid On', 'Payments'];
  const rows = items.map((i) => {
    const b = i.billing || {};
    const live = b.invoiceNo && b.status !== 'cancelled';
    return [b.invoiceNo || '', d(b.invoiceDate), i.fileNumber, i.clientName, i.bankName, i.bankBranch, i.propertyType, d(i.approvedAt),
      live ? b.fee : '', live ? b.cgst : '', live ? b.sgst : '', live ? b.total : '', live ? b.received || 0 : '', live ? Math.max(0, b.total - (b.received || 0)) : '',
      i.status, d(b.paidAt), (b.payments || []).map((p) => `${d(p.date)} ${p.mode} ${p.amount}${p.ref ? ` (${p.ref})` : ''}`).join('; ')];
  });
  return '\ufeff' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}

/** The words for WhatsApp / email (bank or customer) */
function invoiceMessage(c, { to = 'bank', link = '', reminder = 0 } = {}) {
  const b = c.billing;
  const due = dueOf(b);
  const days = Math.floor((Date.now() - new Date(b.invoiceDate).getTime()) / 86400000);
  const amount = `Rs. ${due.toLocaleString('en-IN')}`;
  const subject = `${reminder ? 'Reminder: ' : ''}Invoice ${b.invoiceNo} – ${c.fileNumber || ''} – ${amount}`;
  const lines = to === 'customer' ? [
    `Dear ${c.clientName || 'Sir/Madam'},`, '',
    reminder ? `This is a gentle reminder that the valuation fee of ${amount} is pending (${days} days).` : `The valuation of your property is complete. Please pay the valuation fee of ${amount}.`,
  ] : [
    'Dear Sir/Madam,', '',
    reminder ? `Gentle reminder: the valuation fee of ${amount} for the report below is pending (${days} days since the invoice).` : `Please find our invoice for the valuation report below.`,
  ];
  lines.push('', `Invoice: ${b.invoiceNo}`, `File No: ${c.fileNumber || '#' + c.id}`, `Customer: ${c.clientName || ''}`,
    `Bank: ${[c.bankName, c.bankBranch].filter(Boolean).join(', ')}`, `Amount due: ${amount}`, '',
    `Pay by UPI or see the invoice & bank details here: ${link}`, '', 'Thank you,', 'Gouru Valuations');
  return { subject, text: lines.join('\n'), amount: due };
}

/** Email the invoice with the PDF attached (needs the firm's email login). Returns { sent: true, to } */
async function emailInvoice(c, { to = '', link = '', reminder = 0 } = {}) {
  const { contactFor, emailReady } = require('./reportDelivery');
  if (!emailReady()) throw new Error('Email is not set up yet (Settings → email login). Use WhatsApp or share the link.');
  const email = to || (await contactFor(c)).email;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('No email address for this bank branch. Add it in Settings → Banks.');
  const { config } = require('../config/env');
  const env = (k) => config[k] ?? process.env[k];
  const nodemailer = require('nodemailer');
  const port = Number(env('SMTP_PORT') || 587);
  const t = nodemailer.createTransport({ host: env('SMTP_HOST'), port, secure: port === 465, auth: { user: env('SMTP_USERNAME'), pass: env('SMTP_PASSWORD') } });
  const { subject, text } = invoiceMessage(c, { to: 'bank', link, reminder });
  await t.sendMail({ from: env('EMAIL_FROM'), to: email, subject, text,
    attachments: [{ filename: `Invoice_${c.billing.invoiceNo.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`, content: await invoicePdf(c, { link }) }] });
  await ValuationCase.updateOne({ id: c.id }, { $push: { 'billing.sent': { at: new Date(), via: 'email', to: email, reminder } } });
  return { sent: true, to: email };
}

module.exports = { invoiceMessage, emailInvoice, payLink, checkPay, upiLink, upiQrPng, dueOf, cancelInvoice, csvOf, slotFor, firmDetails, money, fyOf, defaultFee, createInvoice, setFee, addPayment, removeLastPayment, statusOf, invoicePdf, words };
