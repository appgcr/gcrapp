// Fees and invoices for approved valuations.
//  • Fee = the bank's fee for the property type (Settings → Banks → Fees), editable per case.
//  • GST is added only when the firm's GSTIN is saved (Fees → Firm details); CGST + SGST halves.
//  • Invoice numbers run per Indian financial year: GV/2026-27/0001.

const ValuationCase = require('../models/ValuationCase');
const Bank = require('../models/Bank');
const AppConfig = require('../models/AppConfig');
const Counter = require('../models/Counter');
const { findBank, CATEGORY_SLOT } = require('./banks');
const { istParts } = require('./istTime');

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
  const { seq } = await Counter.findOneAndUpdate({ key: `invoice:${fy}` }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  const billing = {
    invoiceNo: `${firm.prefix}/${fy}/${String(seq).padStart(4, '0')}`, invoiceDate: at, fy,
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

async function invoicePdf(c) {
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

  text(firm.name, 40, y, { f: bold, size: 18, color: navy });
  right(firm.gstin ? 'TAX INVOICE' : 'INVOICE', 555, y, { f: bold, size: 14, color: navy });
  y -= 16;
  ascii(firm.address).split('\n').filter(Boolean).slice(0, 3).forEach((l) => { text(l, 40, y, { size: 9, color: grey }); y -= 12; });
  const contact = [firm.phone && `Ph: ${firm.phone}`, firm.email].filter(Boolean).join('  |  ');
  if (contact) { text(contact, 40, y, { size: 9, color: grey }); y -= 12; }
  const ids = [firm.gstin && `GSTIN: ${firm.gstin}`, firm.pan && `PAN: ${firm.pan}`].filter(Boolean).join('   ');
  if (ids) { text(ids, 40, y, { size: 9, color: grey }); y -= 12; }
  let ry = 784;
  right(`No: ${b.invoiceNo}`, 555, ry, { f: bold }); ry -= 14;
  right(`Date: ${new Date(b.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`, 555, ry);
  y = Math.min(y, 735) - 8; line(y); y -= 20;

  text('Bill to', 40, y, { size: 9, color: grey }); text('Valuation', 320, y, { size: 9, color: grey }); y -= 14;
  text(c.bankName || 'Bank', 40, y, { f: bold, size: 11 });
  text(`File No: ${c.fileNumber || `#${c.id}`}`, 320, y, { size: 10 }); y -= 13;
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
    text('Payment details', 40, y, { f: bold }); y -= 14;
    [firm.accountName && `Account name: ${firm.accountName}`, firm.bankName && `Bank: ${firm.bankName}`, firm.accountNo && `Account no: ${firm.accountNo}`,
      firm.ifsc && `IFSC: ${firm.ifsc}`, firm.upi && `UPI: ${firm.upi}`].filter(Boolean).forEach((l) => { text(l, 40, y, { size: 9.5 }); y -= 13; });
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

module.exports = { cancelInvoice, csvOf, slotFor, firmDetails, money, fyOf, defaultFee, createInvoice, setFee, addPayment, removeLastPayment, statusOf, invoicePdf, words };
