const express = require('express');
const router = express.Router();
const Branch = require('../models/Branch');
const User = require('../models/User');
const ValuationCase = require('../models/ValuationCase');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { isSuper } = require('../services/access');
const { istParts } = require('../services/istTime');

const cleanCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

async function nextBranchId() {
  const rows = await Branch.find({}).select('id').lean();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ''), 10) || 0), 0);
  return `BR-${String(max + 1).padStart(3, '0')}`;
}

// GET /api/branches — Super Admin: all branches with live numbers. Others: their own branch.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filter = isSuper(req.user) ? {} : { id: req.user.branchId || '__none__' };
    const branches = (await Branch.find(filter).select('-letterhead.dataUrl').sort({ name: 1 }).lean())
      .map((b) => ({ ...b, hasLetterhead: !!(b.letterhead && b.letterhead.updatedAt), hasValuer: !!(b.valuer && b.valuer.name) }));
    if (!req.query.stats) return res.json(branches);

    const ids = branches.map((b) => b.id);
    const [people, cases] = await Promise.all([
      User.find({ branchId: { $in: ids } }).select('id name username role branchId status phone').lean(),
      ValuationCase.find({ branchId: { $in: ids } }).select('branchId status assignedEngineerId createdAt').lean(),
    ]);
    const month = istParts(new Date()).ymd.slice(0, 7);
    const assigned = (c) => c.assignedEngineerId && c.assignedEngineerId !== 'UNASSIGNED';
    res.json(branches.map((b) => {
      const mine = cases.filter((c) => c.branchId === b.id);
      const staff = people.filter((u) => u.branchId === b.id);
      return {
        ...b,
        admins: staff.filter((u) => u.role === 'ADMIN').map(({ id, name, username, phone, status }) => ({ id, name, username, phone, status })),
        engineerCount: staff.filter((u) => u.role === 'ENGINEER').length,
        stats: {
          total: mine.length,
          thisMonth: mine.filter((c) => istParts(new Date(c.createdAt)).ymd.slice(0, 7) === month).length,
          unassigned: mine.filter((c) => !assigned(c) && ['Pending', ''].includes(c.status || '')).length,
          inField: mine.filter((c) => assigned(c) && (c.status === 'Pending' || !c.status)).length,
          review: mine.filter((c) => c.status === 'Reviewing' || c.status === 'Completed').length,
          returned: mine.filter((c) => c.status === 'Returned').length,
          done: mine.filter((c) => c.status === 'Approved' || c.status === 'Rejected').length,
        },
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/branches — Super Admin creates a branch { name, code, address?, phone? }
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const code = cleanCode(req.body?.code);
    if (!name) return res.status(400).json({ error: 'Branch name is required.' });
    if (code.length < 2) return res.status(400).json({ error: 'Branch code must be 2–5 letters, e.g. KDP.' });
    if (await Branch.findOne({ code })) return res.status(400).json({ error: `Code ${code} is already used by another branch.` });
    const branch = await Branch.create({
      id: await nextBranchId(), code, name,
      address: String(req.body?.address || '').trim(),
      phone: String(req.body?.phone || '').trim(),
    });
    res.status(201).json(branch);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/branches/:id — Super Admin edits name / address / phone / status.
// The code is fixed once cases exist, because it is part of every file number.
router.put('/:id', authenticateToken, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const branch = await Branch.findOne({ id: req.params.id });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const set = {};
    ['name', 'address', 'phone'].forEach((k) => { if (req.body?.[k] !== undefined) set[k] = String(req.body[k]).trim(); });
    if (req.body?.status !== undefined) {
      if (!['Active', 'Inactive'].includes(req.body.status)) return res.status(400).json({ error: 'status must be Active or Inactive.' });
      set.status = req.body.status;
    }
    if (req.body?.code !== undefined && cleanCode(req.body.code) !== branch.code) {
      if (await ValuationCase.exists({ branchId: branch.id })) {
        return res.status(400).json({ error: 'The branch code is part of existing file numbers and can’t be changed.' });
      }
      const code = cleanCode(req.body.code);
      if (code.length < 2) return res.status(400).json({ error: 'Branch code must be 2–5 letters.' });
      if (await Branch.findOne({ code })) return res.status(400).json({ error: `Code ${code} is already used.` });
      set.code = code;
    }
    if (set.name === '') return res.status(400).json({ error: 'Branch name is required.' });
    const updated = await Branch.findOneAndUpdate({ id: branch.id }, { $set: set }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- Letterhead & valuer
// A Branch Admin manages their own branch; the Super Admin any branch.
const VALUER_KEYS = ['name', 'fatherName', 'qualification', 'iivNo', 'cell', 'office', 'address'];
const MAX_LETTERHEAD = 2 * 1024 * 1024; // 2 MB picture

function canManage(req, branchId) {
  return isSuper(req.user) || (req.user?.role === 'ADMIN' && req.user.branchId === branchId);
}

function letterheadError(dataUrl) {
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return 'The letterhead must be a PNG or JPG picture (a PDF is turned into a picture in the app).';
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_LETTERHEAD) return 'The letterhead picture is too large (max 2 MB).';
  const png = bytes.length > 24 && bytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  const jpg = bytes.length > 100 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  if (!png && !jpg) return 'This file is not a readable picture.';
  if (png) {
    const w = bytes.readUInt32BE(16); const h = bytes.readUInt32BE(20);
    if (w < 600) return 'The letterhead picture is too small — use at least 600 pixels wide so it prints sharply.';
    if (h > w) return 'This looks like a full page. Crop it to just the letterhead strip at the top.';
  }
  return null;
}

// GET /api/branches/:id/letterhead
router.get('/:id/letterhead', authenticateToken, async (req, res) => {
  if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'Not allowed for this branch.' });
  const b = await Branch.findOne({ id: req.params.id }).select('id name code letterhead valuer').lean();
  if (!b) return res.status(404).json({ error: 'Branch not found' });
  res.json({ id: b.id, name: b.name, code: b.code, letterhead: b.letterhead || {}, valuer: b.valuer || {} });
});

// PUT /api/branches/:id/letterhead  { dataUrl?, fileName?, valuer? }  — dataUrl '' removes the letterhead
router.put('/:id/letterhead', authenticateToken, async (req, res) => {
  try {
    if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'Not allowed for this branch.' });
    const branch = await Branch.findOne({ id: req.params.id });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    const set = {};
    if (req.body?.dataUrl !== undefined) {
      const dataUrl = String(req.body.dataUrl || '');
      if (dataUrl) {
        const err = letterheadError(dataUrl);
        if (err) return res.status(400).json({ error: err });
      }
      set.letterhead = dataUrl
        ? { dataUrl, fileName: String(req.body.fileName || 'letterhead').slice(0, 120), updatedAt: new Date(), updatedBy: req.user.name || req.user.username }
        : { dataUrl: '', fileName: '', updatedAt: null, updatedBy: '' };
    }
    if (req.body?.valuer !== undefined) {
      const v = req.body.valuer || {};
      const clean = {};
      VALUER_KEYS.forEach((k) => { clean[k] = String(v[k] || '').trim().slice(0, k === 'address' ? 300 : 120); });
      const any = VALUER_KEYS.some((k) => clean[k]);
      if (any && !clean.name) return res.status(400).json({ error: 'Enter the valuer’s name (or clear all valuer details).' });
      if (any && !clean.fatherName) return res.status(400).json({ error: 'Enter the valuer’s father’s name — the declaration page needs it.' });
      if (any && !clean.iivNo) return res.status(400).json({ error: 'Enter the valuer’s Indian Institution of Valuers number.' });
      set.valuer = clean;
    }
    const updated = await Branch.findOneAndUpdate({ id: branch.id }, { $set: set }, { new: true }).lean();
    res.json({ id: updated.id, letterhead: updated.letterhead, valuer: updated.valuer });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/branches/:id/letterhead/preview  { dataUrl?, valuer? } — a sample bank report with the
// letterhead/valuer as they are on screen (not saved yet), so the admin sees the result first.
router.post('/:id/letterhead/preview', authenticateToken, async (req, res) => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { spawnSync } = require('child_process');
  if (!canManage(req, req.params.id)) return res.status(403).json({ error: 'Not allowed for this branch.' });
  const b = await Branch.findOne({ id: req.params.id }).lean();
  if (!b) return res.status(404).json({ error: 'Branch not found' });
  const dataUrl = req.body?.dataUrl !== undefined ? String(req.body.dataUrl || '') : (b.letterhead?.dataUrl || '');
  if (dataUrl) { const err = letterheadError(dataUrl); if (err) return res.status(400).json({ error: err }); }
  const demo = JSON.parse(fs.readFileSync(path.join(__dirname, '../services/reports/demo_case.json'), 'utf8'));
  const { bankInfoForReport } = require('../services/banks');
  const data = await bankInfoForReport({ ...demo, branchId: b.id });
  data.branchLetterhead = dataUrl;
  data.branchValuer = req.body?.valuer !== undefined ? req.body.valuer : (b.valuer || {});
  const stamp = `lh_${b.id}_${Date.now()}`;
  const jsonPath = path.join(os.tmpdir(), `${stamp}.json`);
  const docxPath = path.join(os.tmpdir(), `${stamp}.docx`);
  fs.writeFileSync(jsonPath, JSON.stringify(data));
  const py = spawnSync('python3', [path.join(__dirname, '../services/masterDocxGenerator.py'), jsonPath, docxPath], { timeout: 120000 });
  try {
    if (py.status !== 0 || !fs.existsSync(docxPath)) {
      return res.status(500).json({ error: 'Could not build the preview.', detail: String(py.stderr || '').slice(-400) });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(fs.readFileSync(docxPath));
  } finally {
    [jsonPath, docxPath].forEach((p) => { try { fs.unlinkSync(p); } catch { /* gone */ } });
  }
});

module.exports = router;
