// Bank employees (role BANK): send valuation requests to their GCR branch and follow them.
//   GET  /api/bank/me                 — account, bank, GCR branch, property types
//   POST /api/bank/requests           — new valuation request → GCR branch admin's "Unassigned" list
//   GET  /api/bank/requests           — my requests with their progress
//   GET  /api/bank/requests/:id/report — the approved report (only once GCR has approved it)
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
  if (c.status === 'Rejected') return { key: 'closed', label: 'Closed by GCR', step: 5 };
  if (c.status === 'Reviewing' || c.status === 'Completed') return { key: 'review', label: 'Under GCR review', step: 4 };
  if (c.status === 'Returned') return { key: 'review', label: 'Being corrected', step: 4 };
  if (assigned && (c.sitePhotos || []).length) return { key: 'visit', label: 'Site visit done', step: 3 };
  if (assigned) return { key: 'assigned', label: 'Engineer assigned', step: 2 };
  return { key: 'received', label: 'Received by GCR', step: 1 };
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
    if (!branch) return res.status(400).json({ error: 'Your account is not linked to an active GCR branch. Please contact GCR.' });
    const bank = await findBank(u.bankName);
    if (!bank) return res.status(400).json({ error: 'Your bank is not set up with GCR yet. Please contact GCR.' });

    const clientName = clean(b.clientName, 120);
    const clientPhone = clean(b.clientPhone, 15).replace(/\D/g, '');
    const propertyType = clean(b.propertyType, 60);
    const propertyAddress = clean(b.propertyAddress, 400);
    const errors = [];
    if (clientName.length < 3) errors.push('customer (borrower) name');
    if (!PHONE.test(clientPhone)) errors.push('customer’s 10-digit mobile number');
    if (!PROPERTY_TYPES.includes(propertyType)) errors.push('property type');
    if (propertyAddress.length < 10) errors.push('property address / location');
    if (!clean(b.loanPurpose, 80)) errors.push('purpose of valuation');
    if (errors.length) return res.status(400).json({ error: `Please fill: ${errors.join(', ')}.` });

    // The same customer + property already open from this bank → probably a double submit
    const open = await ValuationCase.findOne({
      'requestedBy.id': u.id, clientPhone, 'requestDetails.propertyAddress': propertyAddress,
      status: { $nin: ['Approved', 'Rejected'] },
    }).select('fileNumber').lean();
    if (open) return res.status(409).json({ error: `This request is already open as ${open.fileNumber}. Track it in "My requests".` });

    const today = new Date();
    const prefix = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, '0');
    const count = await ValuationCase.countDocuments({ id: new RegExp(`^${prefix}`) });
    const typeForReport = propertyType === 'Apartment / Flat' ? 'Apartment' : propertyType === 'Agricultural Land' ? 'Agricultural Land' : propertyType;

    const saved = await ValuationCase.create({
      id: prefix + String(count + 1).padStart(2, '0'),
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
      propertyDetails: { propertyType: typeForReport },
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
      message: `${saved.fileNumber} · ${clientName} (${propertyType}) from ${u.name}, ${u.bankBranch || bank.name}. Assign an engineer.`,
    });
    res.status(201).json(view(saved));
  } catch (err) {
    console.error('POST /api/bank/requests', err);
    res.status(400).json({ error: 'Could not send the request. Please try again.' });
  }
});

router.get('/requests', onlyBank, async (req, res) => {
  const rows = await ValuationCase.find({ 'requestedBy.id': req.user.id })
    .select('id fileNumber clientName clientPhone propertyDetails.propertyType bankName bankBranch requestDetails requestedAt createdAt assignedEngineerId assignedEngineerName inspectionDate status sitePhotos approvedAt')
    .sort({ requestedAt: -1, createdAt: -1 }).lean();
  res.json(rows.map(view));
});

// The approved report — served through the normal report route, after the ownership + status check
router.get('/requests/:id/report', onlyBank, async (req, res, next) => {
  const c = await ValuationCase.findOne({ id: req.params.id, 'requestedBy.id': req.user.id }).select('id status').lean();
  if (!c) return res.status(404).json({ error: 'Request not found.' });
  if (c.status !== 'Approved') return res.status(403).json({ error: 'The report can be downloaded once GCR has approved it.' });
  // Hand over to the normal report route (same archive, same signed file the admin approved).
  // Its own checks still run: the case must belong to this bank employee.
  const casesRouter = require('./cases');
  req.url = `/${encodeURIComponent(c.id)}/report${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  return casesRouter(req, res, next);
});

module.exports = router;
module.exports.stage = stage;
