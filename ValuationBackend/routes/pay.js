// Public, signed invoice page for the bank / customer: amount due, Pay with UPI, QR, bank details, PDF.
// GET /api/pay/:id?e=&s=   GET /api/pay/:id/invoice.pdf?e=&s=
const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const billing = require('../services/billing');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const SELECT = 'id fileNumber clientName bankName bankBranch bankDistrict propertyDetails.propertyType approvedAt billing branchId';

async function load(req, res) {
  const c = await ValuationCase.findOne({ id: req.params.id }).select(SELECT).lean();
  if (!c || !billing.checkPay(c, req.query.e, req.query.s)) { res.status(403).send('This payment link is not valid or has expired. Please ask Gouru Valuations for a new one.'); return null; }
  if (!c.billing || c.billing.status === 'cancelled') { res.status(410).send('This invoice was cancelled. Please contact Gouru Valuations.'); return null; }
  return c;
}

router.get('/:id/invoice.pdf', async (req, res) => {
  try {
    const c = await load(req, res); if (!c) return;
    const pdf = await billing.invoicePdf(c);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice_${String(c.billing.invoiceNo).replace(/[^A-Za-z0-9]+/g, '-')}.pdf"`);
    res.send(pdf);
  } catch { res.status(500).send('Could not open the invoice.'); }
});

router.get('/:id', async (req, res) => {
  try {
    const c = await load(req, res); if (!c) return;
    const firm = await billing.firmDetails();
    const b = c.billing;
    const due = billing.dueOf(b);
    const paid = due <= 0;
    const upi = billing.upiLink(firm, c);
    const qr = upi && !paid ? `data:image/png;base64,${(await billing.upiQrPng(firm, c)).toString('base64')}` : '';
    const q = `e=${encodeURIComponent(req.query.e)}&s=${encodeURIComponent(req.query.s)}`;
    const bank = [firm.accountName && ['Account name', firm.accountName], firm.bankName && ['Bank', firm.bankName], firm.accountNo && ['Account no', firm.accountNo], firm.ifsc && ['IFSC', firm.ifsc], firm.upi && ['UPI ID', firm.upi]].filter(Boolean);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(b.invoiceNo)} · ${esc(firm.name)}</title><meta name="robots" content="noindex">
<style>
 body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f2f4f8;color:#0f172a}
 .w{max-width:460px;margin:0 auto;padding:18px 16px 32px}
 .h{display:flex;align-items:center;gap:12px;margin-bottom:14px}.h img{width:46px;height:46px;border-radius:10px}.h b{font-size:19px;color:#13336f}.h small{display:block;color:#64748b;font-size:12.5px}
 .c{background:#fff;border-radius:16px;padding:16px;box-shadow:0 2px 10px rgba(15,23,42,.06);margin-bottom:12px}
 .k{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;font-weight:700}
 .amt{font-size:34px;font-weight:800;margin:4px 0 2px}.paid{color:#16a34a}
 .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid #f1f5f9;font-size:14px}.row:first-of-type{border-top:0}.row span:first-child{color:#64748b}
 .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;padding:15px;border-radius:12px;background:#16a34a;color:#fff;text-decoration:none;font-weight:800;font-size:17px;margin-top:12px}
 .btn.alt{background:#fff;color:#13336f;border:1px solid #c7d2fe;font-size:15px}
 .qr{display:block;width:220px;height:220px;margin:6px auto}.note{font-size:12.5px;color:#64748b;text-align:center}
</style></head><body><div class="w">
 <div class="h"><img src="data:image/png;base64,${require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'gouru_logo.png')).toString('base64')}" alt=""><div><b>${esc(firm.name)}</b><small>Property valuation · Invoice</small></div></div>
 <div class="c">
  <div class="k">${paid ? 'Paid in full' : 'Amount due'}</div>
  <div class="amt ${paid ? 'paid' : ''}">₹${(paid ? b.total : due).toLocaleString('en-IN')}</div>
  <div class="row"><span>Invoice</span><b>${esc(b.invoiceNo)}</b></div>
  <div class="row"><span>File No</span><b>${esc(c.fileNumber || '#' + c.id)}</b></div>
  <div class="row"><span>Customer</span><span>${esc(c.clientName || '')}</span></div>
  <div class="row"><span>Bank</span><span>${esc([c.bankName, c.bankBranch].filter(Boolean).join(', '))}</span></div>
  ${b.received ? `<div class="row"><span>Received so far</span><span>₹${Number(b.received).toLocaleString('en-IN')}</span></div>` : ''}
  ${!paid && upi ? `<a class="btn" href="${esc(upi)}">Pay ₹${due.toLocaleString('en-IN')} with UPI</a><div class="note" style="margin-top:6px">Opens GPay, PhonePe, Paytm or your bank app</div>` : ''}
  <a class="btn alt" href="/api/pay/${encodeURIComponent(c.id)}/invoice.pdf?${q}">Download invoice (PDF)</a>
 </div>
 ${qr ? `<div class="c"><div class="k" style="text-align:center">Scan to pay</div><img class="qr" src="${qr}" alt="UPI QR code"><div class="note">Amount ₹${due.toLocaleString('en-IN')} and invoice number are filled in.</div></div>` : ''}
 ${bank.length && !paid ? `<div class="c"><div class="k">Bank transfer (NEFT / IMPS)</div>${bank.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}<div class="note" style="margin-top:8px;text-align:left">Please mention ${esc(b.invoiceNo)} in the remarks.</div></div>` : ''}
 ${firm.phone ? `<div class="note">Questions? Call ${esc(firm.phone)}</div>` : ''}
</div></body></html>`);
  } catch (err) { res.status(500).send('Could not open the invoice.'); }
});

module.exports = router;
