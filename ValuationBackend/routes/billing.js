// Fees & invoices — admins only (Branch Admin: own branch; Super Admin: all / chosen branch)
const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const AppConfig = require('../models/AppConfig');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin, isSuper, caseFilter, canSeeCase } = require('../services/access');
const billing = require('../services/billing');

router.use(authenticateToken);
router.use((req, res, next) => (isAdmin(req.user) ? next() : res.status(403).json({ error: 'Admins only.' })));

const actor = (req) => req.user?.name || req.user?.username || 'admin';

// GET /api/billing?from=YYYY-MM-DD&to=YYYY-MM-DD&bank=&status=paid|unpaid|partial|none|cancelled
async function listItems(req) {
    const q = { $and: [caseFilter(req), { status: 'Approved' }] };
    if (req.query.from || req.query.to) {
      const r = {};
      if (req.query.from) r.$gte = new Date(`${req.query.from}T00:00:00+05:30`);
      if (req.query.to) r.$lte = new Date(`${req.query.to}T23:59:59+05:30`);
      q.$and.push({ approvedAt: r });
    }
    if (req.query.bank) q.$and.push({ bankName: req.query.bank });
    const rows = await ValuationCase.find(q)
      .select('id fileNumber clientName bankName bankBranch branchId approvedAt propertyDetails.propertyType billing assignedEngineerName')
      .sort({ approvedAt: -1 }).lean();
    let items = rows.map((c) => ({
      id: c.id, fileNumber: c.fileNumber, clientName: c.clientName, bankName: c.bankName, bankBranch: c.bankBranch, branchId: c.branchId,
      approvedAt: c.approvedAt, propertyType: c.propertyDetails?.propertyType || '', engineer: c.assignedEngineerName || '',
      billing: c.billing || null, status: billing.statusOf(c.billing),
    }));
    if (req.query.status) items = items.filter((i) => i.status === req.query.status);
    return items;
}

router.get('/export.csv', async (req, res) => {
  try {
    const items = await listItems(req);
    const name = `Gouru_Fees_${req.query.from || 'all'}_${req.query.to || 'today'}.csv`.replace(/[^A-Za-z0-9_.-]/g, '');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(billing.csvOf(items));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    const items = await listItems(req);
    const live = (b) => b && b.status !== 'cancelled';
    const sum = (f) => items.reduce((a, i) => a + (live(i.billing) ? f(i.billing) : 0), 0);
    const totals = {
      billed: sum((b) => b.total), received: sum((b) => b.received || 0),
      outstanding: sum((b) => Math.max(0, b.total - (b.received || 0))),
      count: items.length, unpaid: items.filter((i) => i.status === 'unpaid' || i.status === 'partial').length,
      noInvoice: items.filter((i) => i.status === 'none' || i.status === 'cancelled').length, feeMissing: items.filter((i) => live(i.billing) && !i.billing.feeSet).length,
    };
    const byBank = {};
    items.forEach((i) => {
      const k = i.bankName || 'No bank';
      byBank[k] = byBank[k] || { bank: k, count: 0, billed: 0, outstanding: 0 };
      byBank[k].count += 1;
      if (live(i.billing)) { byBank[k].billed += i.billing.total; byBank[k].outstanding += Math.max(0, i.billing.total - (i.billing.received || 0)); }
    });
    res.json({ items, totals, byBank: Object.values(byBank).sort((a, b) => b.outstanding - a.outstanding) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Where invoices are paid: account, UPI and QR — per branch (its own admin or the Super Admin) or the firm default ──
const maskAcc = (v) => (v ? `••••${String(v).slice(-4)}` : '');
const PAY_LABELS = { accountName: 'Account name', bankName: 'Bank', accountNo: 'Account no', ifsc: 'IFSC', upi: 'UPI ID', qrDataUrl: 'QR picture' };
function cleanPayment(body) {
  const b = body || {};
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const p = {
    accountName: str(b.accountName, 120), bankName: str(b.bankName, 80), accountNo: str(b.accountNo, 30).replace(/[\s-]/g, ''),
    ifsc: str(b.ifsc, 11).toUpperCase(), upi: str(b.upi, 80).replace(/\s/g, ''), qrDataUrl: String(b.qrDataUrl || ''),
  };
  if (p.accountNo && !/^\d{6,18}$/.test(p.accountNo)) throw Object.assign(new Error('Account number should be 6 to 18 digits.'), { status: 400 });
  if (p.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(p.ifsc)) throw Object.assign(new Error('IFSC should look like SBIN0001234 (11 characters, 5th is zero).'), { status: 400 });
  if (p.upi && !/^[\w.-]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/.test(p.upi)) throw Object.assign(new Error('UPI ID should look like name@okaxis or 9876543210@ybl.'), { status: 400 });
  if (p.qrDataUrl && (!/^data:image\/(png|jpe?g);base64,/i.test(p.qrDataUrl) || p.qrDataUrl.length > 1.5 * 1024 * 1024)) throw Object.assign(new Error('QR picture should be a PNG or JPG under 1 MB.'), { status: 400 });
  if (p.accountNo && !p.ifsc) throw Object.assign(new Error('Please add the IFSC with the account number.'), { status: 400 });
  return p;
}
const canEditBranch = (user, branchId) => isSuper(user) || (branchId && user && user.branchId === branchId);

// GET /api/billing/payment?branchId=BR-001 (empty / "firm" = the firm default)
router.get('/payment', async (req, res) => {
  try {
    const Branch = require('../models/Branch');
    const firm = await billing.firmDetails();
    const firmPay = { accountName: firm.accountName, bankName: firm.bankName, accountNo: firm.accountNo, ifsc: firm.ifsc, upi: firm.upi, qrDataUrl: firm.qrDataUrl };
    let branchId = String(req.query.branchId || '');
    if (!isSuper(req.user)) branchId = req.user.branchId || '';
    if (!branchId || branchId === 'firm') return res.json({ scope: 'firm', canEdit: isSuper(req.user), payment: firmPay });
    const br = await Branch.findOne({ id: branchId }).select('id name payment').lean();
    if (!br) return res.status(404).json({ error: 'Branch not found.' });
    const p = br.payment || {};
    const own = !!(p.accountNo || p.upi || p.qrDataUrl);
    res.json({ scope: 'branch', branchId: br.id, branchName: br.name, canEdit: canEditBranch(req.user, br.id), usesFirm: !own, firm: firmPay,
      payment: own ? { accountName: p.accountName, bankName: p.bankName, accountNo: p.accountNo, ifsc: p.ifsc, upi: p.upi, qrDataUrl: p.qrDataUrl } : { accountName: '', bankName: '', accountNo: '', ifsc: '', upi: '', qrDataUrl: '' },
      updatedAt: p.updatedAt, updatedByName: p.updatedByName, history: (p.history || []).slice(-10).reverse() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/billing/payment { branchId | "firm", accountName, bankName, accountNo, ifsc, upi, qrDataUrl }
router.put('/payment', async (req, res) => {
  try {
    const Branch = require('../models/Branch');
    const { notify } = require('../services/notify');
    const branchId = String((req.body || {}).branchId || '');
    const p = cleanPayment(req.body);
    const who = req.user.name || req.user.username || req.user.id;
    if (!branchId || branchId === 'firm') {
      if (!isSuper(req.user)) return res.status(403).json({ error: 'Only the Super Admin can change the firm default.' });
      const set = Object.fromEntries(Object.entries(p).map(([k, v]) => [`billing.${k}`, v]));
      await AppConfig.updateOne({ key: 'global' }, { $set: set }, { upsert: true });
      notify({ to: 'ADMIN', title: 'Payment details changed', message: `${who} changed the firm's default payment details on invoices${p.accountNo ? ` (account ${maskAcc(p.accountNo)})` : ''}${p.upi ? `, UPI ${p.upi}` : ''}.`, type: 'billing', priority: 'urgent' }).catch(() => {});
      return res.json({ ok: true });
    }
    if (!canEditBranch(req.user, branchId)) return res.status(403).json({ error: 'You can change only your own branch\'s payment details.' });
    const br = await Branch.findOne({ id: branchId });
    if (!br) return res.status(404).json({ error: 'Branch not found.' });
    const old = (br.payment && br.payment.toObject ? br.payment.toObject() : br.payment) || {};
    const changed = Object.keys(PAY_LABELS).filter((k) => String(old[k] || '') !== String(p[k] || ''));
    if (!changed.length) return res.json({ ok: true, unchanged: true });
    const entry = { at: new Date(), by: req.user.id, byName: who,
      changed: changed.map((k) => ({ field: PAY_LABELS[k], from: k === 'accountNo' ? maskAcc(old[k]) : k === 'qrDataUrl' ? (old[k] ? 'picture' : '') : (old[k] || ''), to: k === 'accountNo' ? maskAcc(p[k]) : k === 'qrDataUrl' ? (p[k] ? 'new picture' : 'removed') : (p[k] || '') })) };
    br.payment = { ...old, ...p, updatedAt: entry.at, updatedBy: req.user.id, updatedByName: who, history: [...(old.history || []), entry].slice(-20) };
    await br.save();
    // A change of where money goes: the Super Admin and this branch's admins are told at once
    notify({ to: 'ADMIN', branchId, title: `Payment details changed — ${br.name}`,
      message: `${who} changed ${changed.map((k) => PAY_LABELS[k]).join(', ')} on ${br.name} branch invoices${p.accountNo ? ` (account ${maskAcc(p.accountNo)})` : ''}${p.upi ? `, UPI ${p.upi}` : ''}.`,
      type: 'billing', priority: 'urgent' }).catch(() => {});
    res.json({ ok: true, changed: changed.map((k) => PAY_LABELS[k]) });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

// Firm details printed on invoices
router.get('/settings', async (req, res) => {
  res.json(await billing.firmDetails());
});
router.put('/settings', async (req, res) => {
  try {
    if (!isSuper(req.user)) return res.status(403).json({ error: 'Only the Super Admin can change firm details.' });
    const b = req.body || {};
    const str = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);
    const gstin = str(b.gstin, 15).toUpperCase();
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)) return res.status(400).json({ error: 'GSTIN should be 15 characters, e.g. 37ABCDE1234F1Z5.' });
    const pan = str(b.pan, 10).toUpperCase();
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return res.status(400).json({ error: 'PAN should look like ABCDE1234F.' });
    const pct = b.gstPercent === '' || b.gstPercent == null ? 18 : Number(b.gstPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 28) return res.status(400).json({ error: 'GST % should be between 0 and 28.' });
    const next = {
      name: str(b.name, 120) || 'Gouru Valuations', address: str(b.address, 400), phone: str(b.phone, 40), email: str(b.email, 120),
      gstin, pan, sac: str(b.sac, 10), gstPercent: pct, bankName: str(b.bankName, 80), accountName: str(b.accountName, 120),
      accountNo: str(b.accountNo, 30).replace(/\s/g, ''), ifsc: str(b.ifsc, 11).toUpperCase(), upi: str(b.upi, 80),
      prefix: (str(b.prefix, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GV'), terms: str(b.terms, 300),
    };
    // The firm's default QR picture is changed in Payment details; keep it here
    const cur = await AppConfig.findOne({ key: 'global' }).select('billing.qrDataUrl').lean();
    next.qrDataUrl = (cur && cur.billing && cur.billing.qrDataUrl) || '';
    await AppConfig.updateOne({ key: 'global' }, { $set: { billing: next } }, { upsert: true });
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function visibleCase(req, res) {
  const c = await ValuationCase.findOne({ id: req.params.id }).lean();
  if (!c || !canSeeCase(req.user, c)) { res.status(404).json({ error: 'Case not found.' }); return null; }
  return c;
}

// Create the invoice (approved cases from before invoices existed)
router.post('/:id/invoice', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    if (c.status !== 'Approved') return res.status(400).json({ error: 'Invoices are made for approved reports only.' });
    res.json(await billing.createInvoice(c.id, { by: actor(req) }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cancel a wrong invoice (a new one can then be created)
router.post('/:id/cancel', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    res.json(await billing.cancelInvoice(c.id, { reason: req.body?.reason, by: actor(req) }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Change the fee for this case
router.put('/:id/fee', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    const fee = Number(String(req.body?.fee ?? '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(fee) || fee < 0) return res.status(400).json({ error: 'Enter the fee in rupees.' });
    res.json(await billing.setFee(c.id, fee, { by: actor(req) }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Record money received
router.post('/:id/payment', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    res.json(await billing.addPayment(c.id, { ...req.body, by: actor(req) }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.delete('/:id/payment', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    res.json(await billing.removeLastPayment(c.id));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Invoice PDF
router.get('/:id/invoice.pdf', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    if (!c.billing || !c.billing.invoiceNo) return res.status(404).json({ error: 'No invoice on this case yet.' });
    const pdf = await billing.invoicePdf(c, { link: billing.payLink(baseUrlOf(req), c) });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice_${c.billing.invoiceNo.replace(/[^A-Za-z0-9]+/g, '-')}.pdf"`);
    res.send(pdf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const baseUrlOf = (req) => `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;

// Ready-to-send message for the bank or the customer: amount, file no, payment link (WhatsApp / email)
router.get('/:id/send', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    if (!c.billing || !c.billing.invoiceNo || c.billing.status === 'cancelled') return res.status(400).json({ error: 'No invoice to send.' });
    const to = req.query.to === 'customer' ? 'customer' : 'bank';
    const { contactFor, emailReady } = require('../services/reportDelivery');
    const contact = to === 'bank' ? await contactFor(c) : { email: '', phone: c.clientPhone || '' };
    res.json({ to, email: contact.email || '', phone: contact.phone || '', canEmail: !!(emailReady() && contact.email), ...billing.invoiceMessage(c, { to, link: billing.payLink(baseUrlOf(req), c) }) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Email the invoice now (PDF attached) — when the firm's email is set up
router.post('/:id/email', async (req, res) => {
  try {
    const c = await visibleCase(req, res); if (!c) return;
    const r = await billing.emailInvoice(c, { to: String(req.body?.email || ''), link: billing.payLink(baseUrlOf(req), c), by: actor(req) });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
