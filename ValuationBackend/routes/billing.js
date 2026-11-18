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
