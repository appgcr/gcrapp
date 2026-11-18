// Bank employees (role BANK): send valuation requests to their Gouru branch and follow them.
//   GET  /api/bank/me                 — account, bank, Gouru branch, property types
//   POST /api/bank/requests           — new valuation request → Gouru branch admin's "Unassigned" list
//   GET  /api/bank/requests           — my requests with their progress
//   GET  /api/bank/requests/:id/report — the approved report (only once Gouru Valuations has approved it)
// Everything else is refused for bank logins (see middleware/auth.js).
const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const Branch = require('../models/Branch');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { nextFileNumber } = require('../services/fileNumber');
const { findBank, reportFormatFor } = require('../services/banks');
const { notifyLater } = require('../services/notify');

const onlyBank = [authenticateToken, requireRole('BANK')];
const PROPERTY_TYPES = ['Open Site', 'Independent House', 'Apartment / Flat', 'Agricultural Land', 'Commercial Building', 'Industrial Unit'];
const clean = (v, n = 200) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
const PHONE = /^[6-9]\d{9}$/;

// Where a request is in the process, in the bank's words
function stage(c) {
  const assigned = c.assignedEngineerId && c.assignedEngineerId !== 'UNASSIGNED';
  if (c.status === 'Approved') return { key: 'approved', label: 'Report ready', step: 5 };
  if (c.status === 'Rejected') return { key: 'closed', label: 'Closed by Gouru', step: 5 };
  if (c.status === 'Reviewing' || c.status === 'Completed') return { key: 'review', label: 'Under Gouru review', step: 4 };
  if (c.status === 'Returned') return { key: 'review', label: 'Being corrected', step: 4 };
  if (assigned && (c.sitePhotos || []).length) return { key: 'visit', label: 'Site visit done', step: 3 };
  if (assigned) return { key: 'assigned', label: 'Engineer assigned', step: 2 };
  return { key: 'received', label: 'Received by Gouru', step: 1 };
}

function view(c) {
  const s = stage(c);
  return {
    id: c.id, fileNumber: c.fileNumber, clientName: c.clientName, clientPhone: c.clientPhone,
    propertyType: c.propertyDetails && c.propertyDetails.propertyType, bankName: c.bankName, bankBranch: c.bankBranch,
    requestDetails: c.requestDetails || {}, requestedAt: c.requestedAt || c.createdAt,
    engineerName: s.step >= 2 && c.assignedEngineerName && c.assignedEngineerName !== 'Unknown' ? c.assignedEngineerName : '',
    inspectionDate: c.inspectionDate || '', stage: s.key, stageLabel: s.label, step: s.step,
    reportReady: c.status === 'Approved', approvedAt: c.approvedAt || null,
    visitPlanned: c.customerNotified && c.customerNotified.at ? { at: c.customerNotified.at, etaMin: c.customerNotified.etaMin || null } : null,
    invoice: c.billing && c.billing.invoiceNo && c.billing.status !== 'cancelled' && c.billing.feeSet
      ? { no: c.billing.invoiceNo, date: c.billing.invoiceDate, total: c.billing.total, received: c.billing.received || 0, paid: (c.billing.received || 0) >= c.billing.total }
      : null,
  };
}

router.get('/me', onlyBank, async (req, res) => {
  const b = await Branch.findOne({ id: req.user.branchId }).select('id name code address phone').lean();
  res.json({
    name: req.user.name, phone: req.user.phone, email: req.user.email, designation: req.user.designation,
    bankName: req.user.bankName, bankBranch: req.user.bankBranch, gcrBranch: b, propertyTypes: PROPERTY_TYPES,
  });
});

router.post('/requests', onlyBank, async (req, res) => {
  try {
    const u = req.user;
    const b = req.body || {};
    const branch = await Branch.findOne({ id: u.branchId, status: { $ne: 'Inactive' } });
    if (!branch) return res.status(400).json({ error: 'Your account is not linked to an active Gouru branch. Please contact Gouru Valuations.' });
    const bank = await findBank(u.bankName);
    if (!bank) return res.status(400).json({ error: 'Your bank is not set up with Gouru Valuations yet. Please contact Gouru Valuations.' });

    // Only the customer's name and mobile are needed; documents and notes are optional
    const clientName = clean(b.clientName, 120);
    const clientPhone = clean(b.clientPhone, 15).replace(/\D/g, '');
    const propertyType = PROPERTY_TYPES.includes(clean(b.propertyType, 60)) ? clean(b.propertyType, 60) : '';
    const propertyAddress = clean(b.propertyAddress, 400);
    const errors = [];
    if (clientName.length < 3) errors.push('customer name');
    if (!PHONE.test(clientPhone)) errors.push('customer’s 10-digit mobile number');
    if (errors.length) return res.status(400).json({ error: `Please fill: ${errors.join(', ')}.` });

    // Documents the bank attached: only files this bank user uploaded (max 20)
    const fileStore = require('../services/fileStore');
    const bankDocs = [];
    for (const d of (Array.isArray(b.documents) ? b.documents : []).slice(0, 20)) {
      const ref = fileStore.parseFileUrl(d && d.url);
      if (!ref) continue;
      const meta = await fileStore.findFile(ref.id, ref.key).catch(() => null);
      if (!meta || (meta.metadata && meta.metadata.uploadedBy && meta.metadata.uploadedBy !== u.id)) continue;
      const name = clean(d.name || meta.filename || 'document', 160);
      bankDocs.push({ name, url: `/api/files/${ref.id}?k=${ref.key}`, isPdf: /pdf/i.test(meta.contentType || '') || /\.pdf$/i.test(name),
        size: meta.length, extension: (name.split('.').pop() || '').toUpperCase(), uploadedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), fromBank: true });
    }

    // The same customer already open from this bank → probably a double submit
    const open = await ValuationCase.findOne({
      'requestedBy.id': u.id, clientPhone, ...(propertyAddress ? { 'requestDetails.propertyAddress': propertyAddress } : {}),
      status: { $nin: ['Approved', 'Rejected'] },
    }).select('fileNumber').lean();
    if (open) return res.status(409).json({ error: `A request for this customer is already open as ${open.fileNumber}. Track it in "My requests".` });

    const today = new Date();
    const newId = await require('../services/fileNumber').nextCaseId(today);
    const typeForReport = propertyType === 'Apartment / Flat' ? 'Apartment' : propertyType === 'Agricultural Land' ? 'Agricultural Land' : propertyType;

    const saved = await ValuationCase.create({
      id: newId,
      fileNumber: await nextFileNumber(branch.code, today),
      branchId: branch.id,
      source: 'BANK',
      status: 'Pending',
      assignedEngineerId: 'UNASSIGNED',
      clientName, clientPhone,
      clientFatherName: clean(b.clientFatherName, 120),
      address: clean(b.clientAddress, 400),
      bankName: bank.name, bankId: bank.id, bankStatus: 'Assigned',
      bankBranch: clean(b.bankBranch, 120) || u.bankBranch,
      reportFormat: await reportFormatFor(bank.name),
      propertyDetails: { propertyType: typeForReport || '' },
      documents: bankDocs.length ? { bankDocs } : {},
      requestedAt: today,
      requestedBy: { id: u.id, name: u.name, phone: u.phone, email: u.email, bankName: bank.name, bankBranch: u.bankBranch, designation: u.designation },
      requestDetails: {
        loanPurpose: clean(b.loanPurpose, 80), loanAmount: clean(b.loanAmount, 30), propertyAddress,
        surveyNo: clean(b.surveyNo, 80), extent: clean(b.extent, 80),
        contactPerson: clean(b.contactPerson, 120), contactPhone: clean(b.contactPhone, 15).replace(/\D/g, ''),
        notes: clean(b.notes, 1000), urgency: b.urgency === 'Urgent' ? 'Urgent' : 'Normal',
      },
    });
    notifyLater({
      to: 'ADMIN', branchId: saved.branchId, type: 'case_created', caseId: saved.id,
      priority: saved.requestDetails.urgency === 'Urgent' ? 'urgent' : 'normal',
      title: `New request from ${bank.name}`,
      message: `${saved.fileNumber} · ${clientName}${propertyType ? ` (${propertyType})` : ''}${bankDocs.length ? ` · ${bankDocs.length} document${bankDocs.length === 1 ? '' : 's'}` : ''} from ${u.name}, ${u.bankBranch || bank.name}. Assign an engineer.`,
    });
    res.status(201).json(view(saved));
  } catch (err) {
    console.error('POST /api/bank/requests', err);
    res.status(400).json({ error: 'Could not send the request. Please try again.' });
  }
});

router.get('/requests', onlyBank, async (req, res) => {
  const rows = await ValuationCase.find({ 'requestedBy.id': req.user.id })
    .select('id fileNumber clientName clientPhone propertyDetails.propertyType bankName bankBranch requestDetails requestedAt createdAt assignedEngineerId assignedEngineerName inspectionDate status sitePhotos approvedAt billing customerNotified')
    .sort({ requestedAt: -1, createdAt: -1 }).lean();
  res.json(rows.map(view));
});

// The approved report — served through the normal report route, after the ownership + status check
router.get('/requests/:id/report', onlyBank, async (req, res, next) => {
  const c = await ValuationCase.findOne({ id: req.params.id, 'requestedBy.id': req.user.id }).select('id status').lean();
  if (!c) return res.status(404).json({ error: 'Request not found.' });
  if (c.status !== 'Approved') return res.status(403).json({ error: 'The report can be downloaded once Gouru Valuations has approved it.' });
  // Hand over to the normal report route (same archive, same signed file the admin approved).
  // Its own checks still run: the case must belong to this bank employee.
  const casesRouter = require('./cases');
  req.url = `/${encodeURIComponent(c.id)}/report${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return casesRouter(req, res, next);
});

// The invoice for an approved request (same PDF the admin sees)
router.get('/requests/:id/invoice.pdf', onlyBank, async (req, res) => {
  try {
    const c = await ValuationCase.findOne({ id: req.params.id, 'requestedBy.id': req.user.id }).lean();
    if (!c || !c.billing || !c.billing.invoiceNo || c.billing.status === 'cancelled' || !c.billing.feeSet) return res.status(404).json({ error: 'No invoice for this request yet.' });
    const billing = require('../services/billing');
    const base = `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;
    const pdf = await billing.invoicePdf(c, { link: billing.payLink(base, c) });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice_${c.billing.invoiceNo.replace(/[^A-Za-z0-9]+/g, '-')}.pdf"`);
    res.send(pdf);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// The signed payment page for this request's invoice (Pay with UPI / bank details)
router.get('/requests/:id/pay-link', onlyBank, async (req, res) => {
  try {
    const c = await ValuationCase.findOne({ id: req.params.id, 'requestedBy.id': req.user.id }).select('id billing').lean();
    if (!c || !c.billing || !c.billing.invoiceNo || c.billing.status === 'cancelled') return res.status(404).json({ error: 'No invoice for this request.' });
    const base = `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;
    res.json({ url: require('../services/billing').payLink(base, c) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.stage = stage;
