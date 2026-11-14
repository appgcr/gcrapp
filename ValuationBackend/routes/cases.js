const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const ReportArchive = require('../models/ReportArchive');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');
const { notifyLater, notifyCaseChange } = require('../services/notify');
const { calculateValuation } = require('../services/valuationCalculator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const Branch = require('../models/Branch');
const { isSuper, isAdmin, branchScope, caseFilter, canSeeCase } = require('../services/access');
const { nextFileNumber } = require('../services/fileNumber');
const { reportFormatFor, findBank, policyForName, bankInfoForReport } = require('../services/banks');
const { applyBankReportValues } = require('../services/bankReportValues');

const isRealEngineer = (v) => v && v !== 'UNASSIGNED';

// An engineer may only be given cases from their own branch
async function engineerInBranch(engineerId, branchId) {
  if (!isRealEngineer(engineerId)) return true;
  const eng = await User.findOne({ $or: [{ id: engineerId }, { username: engineerId }] }).select('role branchId').lean();
  return !!eng && eng.role === 'ENGINEER' && eng.branchId === branchId;
}

// Every route below that takes :id checks the caller may see that case
async function loadVisibleCase(req, res) {
  const c = await ValuationCase.findOne({ id: req.params.id });
  if (!c) { res.status(404).json({ error: 'Case not found' }); return null; }
  if (!canSeeCase(req.user, c)) { res.status(403).json({ error: 'This case belongs to another branch.' }); return null; }
  return c;
}
const {
  archiveCaseReport,
  getArchivedReport,
  recordArchiveDecision
} = require('../services/reportArchiveService');

// GET /api/cases
router.get('/', authenticateToken, async (req, res) => {
  try {
    const parts = [caseFilter(req)];
    if (req.query.status) parts.push({ status: req.query.status });
    if (req.query.engineerId) {
      parts.push({ $or: [
        { assignedEngineerId: req.query.engineerId },
        { assignedEngineerName: req.query.engineerId }
      ] });
    }
    const cases = await ValuationCase.find({ $and: parts }).sort({ createdAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id
// Fingerprints of the documents / photos on a case (page.hash or page.id from the app's content hash)
function collectHashes(body) {
  const out = new Set();
  const docs = body.documents && typeof body.documents === 'object' ? body.documents : {};
  for (const pages of Object.values(docs)) {
    for (const p of Array.isArray(pages) ? pages : []) {
      const h = p && (p.hash || p.id);
      if (h && /^[a-f0-9]{16,}$/i.test(String(h))) out.add(String(h));
    }
  }
  for (const h of Array.isArray(body.photoHashes) ? body.photoHashes : []) {
    if (h && /^[a-f0-9]{16,}$/i.test(String(h))) out.add(String(h));
  }
  return [...out];
}

const MAX_SITE_PHOTOS = 10;

async function duplicateOwner(hashes, caseId) {
  if (!hashes.length) return null;
  return ValuationCase.findOne({ documentHashes: { $in: hashes }, id: { $ne: caseId || '' } }).select('id fileNumber').lean();
}

// POST /api/cases/check-duplicates  { hashes: [...], caseId }  → files already used on another case
router.post('/check-duplicates', authenticateToken, async (req, res) => {
  try {
    const hashes = (Array.isArray(req.body.hashes) ? req.body.hashes : []).map(String).filter(Boolean).slice(0, 50);
    if (!hashes.length) return res.json({ duplicates: [] });
    const others = await ValuationCase.find({ documentHashes: { $in: hashes }, id: { $ne: req.body.caseId || '' } })
      .select('id fileNumber documentHashes').lean();
    const duplicates = [];
    for (const c of others) {
      for (const h of hashes) if ((c.documentHashes || []).includes(h)) duplicates.push({ hash: h, fileNumber: c.fileNumber || c.id });
    }
    res.json({ duplicates });
  } catch (err) {
    res.status(500).json({ error: 'Could not check for duplicate documents.' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const caseItem = await loadVisibleCase(req, res);
    if (!caseItem) return;
    res.json(caseItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cases — Initial Case Creation (Bank is Optional)
// Who may create a case: admins, or an engineer an admin has allowed to file self cases
async function canCreateCase(req, res, next) {
  if (['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role)) return next();
  if (req.user?.role === 'ENGINEER') {
    const me = await User.findOne({ id: req.user.id }).select('id name username branchId canSelfCase status').lean();
    if (me?.canSelfCase && me.status !== 'Inactive' && me.branchId) { req.selfCaseEngineer = me; return next(); }
    return res.status(403).json({ error: 'Your admin has not allowed you to file your own cases.' });
  }
  return res.status(403).json({ error: 'Access denied.' });
}

router.post('/', authenticateToken, canCreateCase, async (req, res) => {
  try {
    // Self case: only the basic request details; the case is the engineer's own and goes to their branch
    const selfEng = req.selfCaseEngineer;
    if (selfEng) {
      const pick = ['clientName', 'clientPhone', 'bankName', 'address', 'locationData', 'note'];
      const body = {};
      for (const k of pick) if (req.body[k] !== undefined) body[k] = typeof req.body[k] === 'string' ? req.body[k].slice(0, 500) : req.body[k];
      if (!String(body.clientName || '').trim()) return res.status(400).json({ error: 'Enter the customer name.' });
      req.body = { ...body, branchId: selfEng.branchId, assignedEngineerId: selfEng.id, assignedEngineerName: selfEng.name || selfEng.username, status: 'Pending', selfFiled: true };
    }
    // Which branch owns the case: a Branch Admin's own; the Super Admin chooses
    // (or it's the branch they're viewing / the only branch)
    let branchId = selfEng ? selfEng.branchId : isSuper(req.user) ? (req.body.branchId || branchScope(req)) : req.user.branchId;
    if (!branchId && isSuper(req.user)) {
      const all = await Branch.find({ status: { $ne: 'Inactive' } }).select('id').lean();
      if (all.length === 1) branchId = all[0].id;
    }
    const branch = branchId ? await Branch.findOne({ id: branchId }) : null;
    if (!branch) return res.status(400).json({ error: 'Choose which branch this case belongs to.' });
    if (!(await engineerInBranch(req.body.assignedEngineerId, branch.id))) {
      return res.status(400).json({ error: `That engineer isn’t in the ${branch.name} branch.` });
    }

    const today = new Date();
    const prefix = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, '0');

    const count = await ValuationCase.countDocuments({ id: new RegExp(`^${prefix}`) });
    const nextSeq = (count + 1).toString().padStart(2, '0');
    const newId = prefix + nextSeq;

    const config = (await AppConfig.findOne({ key: 'global' })) || {};
    const caseData = { ...req.body, id: newId, branchId: branch.id, fileNumber: await nextFileNumber(branch.code, today) };
    if (Array.isArray(req.body.sitePhotos) && req.body.sitePhotos.length > MAX_SITE_PHOTOS) {
      return res.status(400).json({ error: `A case can have at most ${MAX_SITE_PHOTOS} site photos.` });
    }
    caseData.documentHashes = collectHashes(req.body);
    const dupCase = await duplicateOwner(caseData.documentHashes, newId);
    if (dupCase) {
      return res.status(409).json({ error: `A document or photo on this case is already used on case ${dupCase.fileNumber || dupCase.id}. Each case needs its own documents.` });
    }

    // Bank resolution logic: Bank is strictly optional at initial creation
    const rawBankName = (caseData.bankName && typeof caseData.bankName === 'string') ? caseData.bankName.trim() : '';
    const isAssigned = rawBankName !== '' && 
                       rawBankName.toLowerCase() !== 'unassigned' && 
                       !rawBankName.toLowerCase().includes('pending');

    caseData.bankName = isAssigned ? rawBankName : '';
    caseData.bankStatus = isAssigned ? 'Assigned' : 'Unassigned';
    // Use the bank's official name from Settings → Banks (any spelling the admin typed maps to it)
    const bankRec = isAssigned ? await findBank(rawBankName) : null;
    if (isAssigned && !bankRec) {
      return res.status(400).json({ error: `“${rawBankName}” is not in the bank list. Choose a bank from the list — the Super Admin can add banks in Settings → Banks.` });
    }
    if (bankRec) caseData.bankName = bankRec.name;
    caseData.bankId = bankRec ? bankRec.id : null;
    caseData.reportFormat = isAssigned ? await reportFormatFor(caseData.bankName) : undefined;

    if (caseData.propertyDetails) {
      const calcResult = calculateValuation(caseData.propertyDetails, { ...config, bankName: caseData.bankName, bankPolicy: await policyForName(caseData.bankName) });
      if (calcResult.valuationStatus === 'INVALID_INPUT') {
        return res.status(422).json({
          error: 'Invalid Financial Input',
          details: calcResult.error || 'Financial inputs contain invalid, negative, or malformed decimal numbers.'
        });
      }
      caseData.valuation = calcResult;
    }

    const newCase = new ValuationCase(caseData);
    const saved = await newCase.save();
    if (selfEng) {
      notifyLater({
        to: 'ADMIN', branchId: saved.branchId, type: 'case_created', caseId: saved.id, priority: 'normal',
        title: 'Self case filed',
        message: `${selfEng.name || selfEng.username} filed their own case ${saved.fileNumber}${saved.clientName ? ` · ${saved.clientName}` : ''}${saved.bankName ? ` (${saved.bankName})` : ''}. It comes to you for review when they submit it.`,
      });
      return res.status(201).json(saved);
    }
    notifyLater({
      to: 'ADMIN', branchId: saved.branchId, type: 'case_created', caseId: saved.id, priority: 'normal',
      title: 'New case request',
      message: `Case ${saved.fileNumber}${saved.clientName ? ` · ${saved.clientName}` : ''}${saved.bankName ? ` (${saved.bankName})` : ''} needs a valuer.`,
    });
    // Created already assigned → tell the engineer too (same rules as a later assignment)
    if (saved.assignedEngineerId && saved.assignedEngineerId !== 'UNASSIGNED') {
      notifyCaseChange({ assignedEngineerId: 'UNASSIGNED', status: '' }, saved.toObject());
    }
    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/cases ERROR:', err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/cases/:id — Update / Submit / Resubmit Case
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existingCase = await loadVisibleCase(req, res);
    if (!existingCase) return;

    const updateData = { ...req.body };
    if (Array.isArray(req.body.sitePhotos) && req.body.sitePhotos.length > MAX_SITE_PHOTOS) {
      return res.status(400).json({ error: `A case can have at most ${MAX_SITE_PHOTOS} site photos.` });
    }
    if (updateData.documents !== undefined || updateData.photoHashes !== undefined) {
      updateData.documentHashes = collectHashes({ documents: updateData.documents || existingCase.documents, photoHashes: updateData.photoHashes });
      const dupCase = await duplicateOwner(updateData.documentHashes, existingCase.id);
      if (dupCase) {
        return res.status(409).json({ error: `A document or photo on this case is already used on case ${dupCase.fileNumber || dupCase.id}. Each case needs its own documents.` });
      }
    }
    // Ownership and numbering never change through an edit
    delete updateData.id;
    delete updateData.branchId;
    delete updateData.fileNumber;
    delete updateData.reportFormat;
    if (!isAdmin(req.user)) {
      // Engineers can't reassign cases or make decisions
      delete updateData.assignedEngineerId;
      delete updateData.assignedEngineerName;
      delete updateData.selfFiled;
      // On a case the admin assigned, the client and bank the admin entered stay as they are
      if (!existingCase.selfFiled) {
        if (existingCase.clientName) { delete updateData.clientName; delete updateData.borrowerName; }
        if (existingCase.bankName) delete updateData.bankName;
        if (existingCase.clientPhone) delete updateData.clientPhone;
      }
      if (['Approved', 'Rejected', 'Returned', 'Completed'].includes(updateData.status)) {
        return res.status(403).json({ error: 'Only an admin can approve, reject or return a case.' });
      }
      // Once submitted, the figures belong to the admin's review: the engineer edits again only if it is returned
      if (!['Pending', 'Returned'].includes(existingCase.status)) {
        const msg = existingCase.status === 'Approved' ? 'This case is approved and locked. Ask your admin if something must change.'
          : existingCase.status === 'Rejected' ? 'This case is closed.'
          : 'This case is with your admin for review. You can edit it again only if it is returned to you.';
        return res.status(409).json({ error: msg });
      }
    }
    if (updateData.assignedEngineerId !== undefined && !(await engineerInBranch(updateData.assignedEngineerId, existingCase.branchId))) {
      return res.status(400).json({ error: 'That engineer belongs to a different branch.' });
    }
    const config = (await AppConfig.findOne({ key: 'global' })) || {};

    // Prevent Engineer or non-Super Admin from approving cases
    if (updateData.status === 'Approved') {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: 'Field engineers cannot approve valuation cases. Only an admin can approve.' });
      }
    }
    // A decision needs a submitted report: the engineer must have sent it for review first
    // (Rejecting = closing the case, e.g. the bank cancelled it — allowed at any time)
    if (['Approved', 'Returned'].includes(updateData.status) && updateData.status !== existingCase.status
        && !['Reviewing', 'Completed'].includes(existingCase.status)) {
      return res.status(400).json({ error: 'This case has not been submitted by the engineer yet. It can be approved or returned only after the report is submitted for review.' });
    }

    // Handle bank updates
    if (updateData.bankName !== undefined) {
      const rawBankName = typeof updateData.bankName === 'string' ? updateData.bankName.trim() : '';
      const isAssigned = rawBankName !== '' && 
                         rawBankName.toLowerCase() !== 'unassigned' && 
                         !rawBankName.toLowerCase().includes('pending');
      updateData.bankName = isAssigned ? rawBankName : '';
      updateData.bankStatus = isAssigned ? 'Assigned' : 'Unassigned';
      // The chosen bank decides which bank's report format is used
      const bankRec = isAssigned ? await findBank(rawBankName) : null;
      if (isAssigned && !bankRec) {
        return res.status(400).json({ error: `“${rawBankName}” is not in the bank list. Choose a bank from the list — the Super Admin can add banks in Settings → Banks.` });
      }
      if (bankRec) updateData.bankName = bankRec.name;
      updateData.bankId = bankRec ? bankRec.id : null;
      updateData.reportFormat = isAssigned ? await reportFormatFor(updateData.bankName) : null;
    }

    // Versioning logic on submission / resubmission
    let isResubmission = false;
    if (updateData.status === 'Reviewing') {
      if (existingCase.status === 'Returned') {
        // Resubmission after corrections: Increment version number
        isResubmission = true;
        updateData.version = (existingCase.version || 1) + 1;
        updateData.rejectionReason = ''; // Clear rejection reason on active case
      }
    }

    const targetBankName = updateData.bankName !== undefined ? updateData.bankName : existingCase.bankName;
    const bankPolicy = await policyForName(existingCase.bankId && updateData.bankName === undefined ? existingCase.bankId : targetBankName);
    const targetPropertyDetails = updateData.propertyDetails || existingCase.propertyDetails;

    // Guard against silent recalculation:
    // Only recalculate valuation if propertyDetails are actively updated or if in draft/returned status
    if (updateData.propertyDetails) {
      updateData.valuation = calculateValuation(updateData.propertyDetails, { ...config, bankName: targetBankName, bankPolicy });
      // Same figures as the bank's own report (APGB…)
      updateData.valuation = await applyBankReportValues({ ...existingCase.toObject(), ...updateData, bankName: targetBankName }, updateData.valuation);
    } else if (existingCase.valuation) {
      // Preserve existing valuation snapshot
      updateData.valuation = existingCase.valuation;
    }

    // POLICY GUARD: When submitting for review or approving, reject unconfigured policies.
    // Always recalculate from the property details (the saved figures may be blank from an earlier failed calculation).
    if (updateData.status === 'Reviewing' || updateData.status === 'Approved') {
      const activeValuation = targetPropertyDetails ? calculateValuation(targetPropertyDetails, { ...config, bankName: targetBankName, bankPolicy }) : updateData.valuation;
      if (activeValuation) {
        if (activeValuation.valuationStatus === 'POLICY_NOT_CONFIGURED') {
          return res.status(422).json({
            error: 'Policy Not Configured',
            details: activeValuation.error || 'The selected Bank and Property Category combination has no approved valuation policy in the whitelist. Universal fallback is prohibited.'
          });
        }
        if (activeValuation.valuationStatus === 'BANK_UNASSIGNED') {
          return res.status(400).json({
            error: 'Bank Unassigned',
            details: 'A bank must be assigned before submitting for review or approval.'
          });
        }
        if (activeValuation.valuationStatus === 'INVALID_INPUT') {
          return res.status(422).json({
            error: 'Invalid Financial Input',
            details: activeValuation.error || 'Financial inputs contain invalid, negative, or malformed decimal numbers.'
          });
        }
      }
      const fmvNow = Number((updateData.valuation || existingCase.valuation || {}).fairMarketValue) || 0;
      if (fmvNow <= 0) {
        return res.status(422).json({ error: 'The valuation is ₹0. Fill the extent, rates and building details, then save before submitting.' });
      }
    }
    if (updateData.status === 'Approved' && existingCase.status !== 'Approved') updateData.approvedAt = new Date();

    const updated = await ValuationCase.findOneAndUpdate(
      { id: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Case not found' });

    // Snapshot creation: Whenever a case enters 'Reviewing', create an immutable snapshot
    if (updated.status === 'Reviewing') {
      const currentV = updated.version || 1;
      await ValuationCaseVersion.findOneAndUpdate(
        { caseId: updated.id, version: currentV },
        {
          caseId: updated.id,
          version: currentV,
          snapshotData: updated.toObject(),
          submittedBy: req.user?.id || updated.assignedEngineerId || 'ENGINEER',
          submittedByName: req.user?.name || updated.assignedEngineerName || 'Field Engineer',
          submittedAt: new Date(),
          statusAtSubmission: 'Reviewing',
          adminDecision: 'Pending',
          valuationSummary: {
            landValue: updated.valuation?.landValue || 0,
            replacementCost: updated.valuation?.replacementCost || 0,
            depreciationAmount: updated.valuation?.depreciationAmount || 0,
            netStructureValue: updated.valuation?.netStructureValue || 0,
            amenitiesValue: updated.valuation?.amenitiesValue || 0,
            fairMarketValue: updated.valuation?.fairMarketValue || 0,
            realizableValue: updated.valuation?.realizableValue || 0,
            distressSaleValue: updated.valuation?.distressSaleValue || 0
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Permanent Report Archival (Phase 3.5.4): Compile & archive original binaries upon submission
      if (updated.bankName && updated.bankName.trim() && updated.bankStatus === 'Assigned') {
        try {
          await archiveCaseReport(updated.toObject(), currentV, {
            id: req.user?.id || updated.assignedEngineerId,
            username: req.user?.username || updated.assignedEngineerName,
            name: req.user?.name || updated.assignedEngineerName,
            role: req.user?.role || 'ENGINEER'
          });
        } catch (archiveErr) {
          console.error(`⚠️ Report archival failed for Case #${updated.id} v${currentV}:`, archiveErr.message);
        }
      }
    } else if (updated.status === 'Approved') {
      // Mark current version as Approved in ValuationCaseVersion
      await ValuationCaseVersion.findOneAndUpdate(
        { caseId: updated.id, version: updated.version || 1 },
        {
          adminDecision: 'Approved',
          decisionBy: req.user?.name || req.user?.username || 'Super Admin',
          decisionAt: new Date()
        }
      );

      // Record Approval in ReportArchive
      try {
        await recordArchiveDecision(
          updated.id,
          updated.version || 1,
          'Approved',
          { name: req.user?.name || req.user?.username || 'Super Admin', role: req.user?.role || 'SUPER_ADMIN' }
        );
      } catch (archiveErr) {
        console.warn('⚠️ Record archive approval warning:', archiveErr.message);
      }
    }

    notifyCaseChange(existingCase.toObject(), updated.toObject(), { name: req.user?.name || req.user?.username });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cases/:id/return — Super Admin returns case for corrections (Defect 02)
router.post('/:id/return', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Only an admin can return cases for correction.' });
    }
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'A meaningful correction comment is required.' });
    }
    const caseItem = await loadVisibleCase(req, res);
    if (!caseItem) return;

    if (caseItem.status !== 'Reviewing') {
      return res.status(400).json({ error: `Invalid status transition: Only cases in 'Reviewing' status can be returned for corrections. Current status is '${caseItem.status}'.` });
    }

    const adminName = req.user.name || req.user.username || 'Super Admin';
    caseItem.status = 'Returned';
    caseItem.rejectionReason = comment.trim();
    caseItem.returnedBy = adminName;
    caseItem.returnedAt = new Date();
    const saved = await caseItem.save();

    // Update decision on current version snapshot in ValuationCaseVersion
    await ValuationCaseVersion.findOneAndUpdate(
      { caseId: caseItem.id, version: caseItem.version || 1 },
      {
        adminDecision: 'Returned',
        decisionBy: adminName,
        decisionAt: new Date(),
        decisionComment: comment.trim()
      }
    );

    // Record Return Decision in ReportArchive
    try {
      await recordArchiveDecision(
        caseItem.id,
        caseItem.version || 1,
        'Returned',
        { name: adminName, role: req.user.role },
        comment.trim()
      );
    } catch (archiveErr) {
      console.warn('⚠️ Record archive return warning:', archiveErr.message);
    }

    // Notify assigned engineer (in-app + phone push)
    if (caseItem.assignedEngineerId && caseItem.assignedEngineerId !== 'UNASSIGNED') {
      notifyLater({
        to: caseItem.assignedEngineerId, type: 'report_returned', caseId: caseItem.id, priority: 'urgent',
        title: 'Report returned for corrections',
        message: `Case ${caseItem.fileNumber || `#${caseItem.id}`} — ${adminName}: "${comment.trim()}"`,
      });
    }

    res.json({
      success: true,
      message: 'Case returned to engineer for corrections.',
      case: saved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id/versions — Retrieve all immutable historical versions of a case (Defect 03)
router.get('/:id/versions', authenticateToken, async (req, res) => {
  try {
    if (!(await loadVisibleCase(req, res))) return;
    const versions = await ValuationCaseVersion.find({ caseId: req.params.id }).sort({ version: 1 });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id/versions/:vNum — Retrieve a specific version snapshot
router.get('/:id/versions/:vNum', authenticateToken, async (req, res) => {
  try {
    if (!(await loadVisibleCase(req, res))) return;
    const versionItem = await ValuationCaseVersion.findOne({
      caseId: req.params.id,
      version: parseInt(req.params.vNum, 10)
    });
    if (!versionItem) return res.status(404).json({ error: `Version ${req.params.vNum} not found for Case #${req.params.id}` });
    res.json(versionItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id/archives — Retrieve all permanent report archival records (Phase 3.5.4)
router.get('/:id/archives', authenticateToken, async (req, res) => {
  try {
    if (!(await loadVisibleCase(req, res))) return;
    const archives = await ReportArchive.find({ caseId: req.params.id }).sort({ version: 1 });
    res.json(archives);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id/archives/:vNum — Retrieve archive metadata & audit trail for a specific version
router.get('/:id/archives/:vNum', authenticateToken, async (req, res) => {
  try {
    if (!(await loadVisibleCase(req, res))) return;
    const archive = await ReportArchive.findOne({
      caseId: req.params.id,
      version: parseInt(req.params.vNum, 10)
    });
    if (!archive) {
      return res.status(404).json({ error: `Archive not found for Case #${req.params.id} Version ${req.params.vNum}` });
    }
    res.json(archive);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id/report — generates reference-faithful .docx or .pdf
router.get('/:id/report', authenticateToken, async (req, res) => {
  try {
    const { format, version } = req.query;
    if (format && !['pdf', 'docx'].includes(format.toLowerCase())) {
      return res.status(400).json({ error: `Unsupported report format: '${format}'. Supported formats: 'docx', 'pdf'` });
    }

    // Super Admin: any case. Branch Admin: their branch. Engineer: their assigned cases.
    const caseItem = await loadVisibleCase(req, res);
    if (!caseItem) return;

    // SAFEGUARD (Defect 01): Block report generation if bank is unresolved
    const isBankUnassigned = !caseItem.bankName ||
                             caseItem.bankName.trim() === '' ||
                             caseItem.bankName.toLowerCase() === 'unassigned' ||
                             caseItem.bankName.toLowerCase().includes('pending') ||
                             caseItem.bankStatus === 'Unassigned';
    if (isBankUnassigned) {
      return res.status(400).json({
        error: 'Cannot generate final bank report: Bank has not been assigned to this case. Please assign a bank before generating the valuation report.'
      });
    }

    // 1. If a historical version is requested, retrieve strictly from permanent archive (Phase 3.5.4)
    if (version) {
      const vNum = parseInt(version, 10);
      const archiveRes = await getArchivedReport(caseItem.id, vNum, format, {
        username: req.user?.username || req.user?.name || 'ANONYMOUS',
        role: req.user?.role || ''
      });

      if (archiveRes.found) {
        if (archiveRes.corrupted) {
          return res.status(422).json({
            error: archiveRes.error,
            message: archiveRes.message
          });
        }
        res.setHeader('Content-Disposition', `inline; filename="${archiveRes.filename}"`);
        res.setHeader('Content-Type', archiveRes.mimeType);
        res.setHeader('X-Report-Sha256', archiveRes.sha256);
        res.setHeader('X-Report-Version', String(vNum));
        return res.send(archiveRes.buffer);
      }

      // Check if DB snapshot exists
      const historicalVer = await ValuationCaseVersion.findOne({ caseId: caseItem.id, version: vNum });
      if (!historicalVer) {
        return res.status(404).json({ error: `Version ${vNum} snapshot not found for Case #${caseItem.id}.` });
      }

      // Unarchived legacy records: do not silently regenerate
      return res.status(404).json({
        error: 'HISTORICAL_ARCHIVE_UNAVAILABLE',
        message: `Original historical report binary was not archived for Case #${caseItem.id} Version ${vNum}. In accordance with banking compliance, unarchived historical reports cannot be regenerated dynamically.`
      });
    }

    // 2. Active version download: check if permanent archive already exists.
    // Only a submitted / approved report is archived; before that it is always built fresh.
    const currentV = caseItem.version || 1;
    const isFinal = ['Reviewing', 'Approved', 'Completed'].includes(caseItem.status);
    const activeArchiveRes = !isFinal ? { found: false } : await getArchivedReport(caseItem.id, currentV, format, {
      username: req.user?.username || req.user?.name || 'ANONYMOUS',
      role: req.user?.role || ''
    });

    if (activeArchiveRes.found) {
      if (activeArchiveRes.corrupted) {
        return res.status(422).json({
          error: activeArchiveRes.error,
          message: activeArchiveRes.message
        });
      }
      res.setHeader('Content-Disposition', `inline; filename="${activeArchiveRes.filename}"`);
      res.setHeader('Content-Type', activeArchiveRes.mimeType);
      res.setHeader('X-Report-Sha256', activeArchiveRes.sha256);
      res.setHeader('X-Report-Version', String(currentV));
      return res.send(activeArchiveRes.buffer);
    }

    // 3. Fallback: If not yet archived, archive on-the-fly and serve the verified archive
    if (isFinal) try {
      const newArchive = await archiveCaseReport(caseItem.toObject(), currentV, {
        id: req.user?.id || caseItem.assignedEngineerId,
        username: req.user?.username || 'SYSTEM',
        name: req.user?.name || 'System Archiver',
        role: req.user?.role || 'SYSTEM'
      });
      const verified = await getArchivedReport(caseItem.id, currentV, format, {
        username: req.user?.username || 'SYSTEM',
        role: req.user?.role || ''
      });
      if (verified.found && !verified.corrupted) {
        res.setHeader('Content-Disposition', `inline; filename="${verified.filename}"`);
        res.setHeader('Content-Type', verified.mimeType);
        res.setHeader('X-Report-Sha256', verified.sha256);
        res.setHeader('X-Report-Version', String(currentV));
        return res.send(verified.buffer);
      }
    } catch (archErr) {
      console.warn(`Dynamic archival fallback warning for Case #${caseItem.id}:`, archErr.message);
    }

    let reportCaseData = await bankInfoForReport(caseItem.toObject());

    // Fetch dynamic system config and assigned engineer details
    const config = await AppConfig.findOne({ key: 'global' });
    let engineer = null;
    if (caseItem.assignedEngineerId) {
      engineer = await User.findOne({ $or: [{ id: caseItem.assignedEngineerId }, { username: caseItem.assignedEngineerId }] });
    }
    if (!engineer && caseItem.assignedEngineerName) {
      engineer = await User.findOne({ $or: [{ name: caseItem.assignedEngineerName }, { username: caseItem.assignedEngineerName }] });
    }

    const fs = require('fs');
    const path = require('path');
    const { spawnSync } = require('child_process');
    const { convertDocxToPdf } = require('../services/docxToPdfConverter');

    const tempJsonPath = path.join('/tmp', `case_${caseItem.id}_${Date.now()}.json`);
    const tempDocxPath = path.join('/tmp', `report_${caseItem.id}_${Date.now()}.docx`);
    fs.writeFileSync(tempJsonPath, JSON.stringify(reportCaseData, null, 2), 'utf-8');

    const scriptPath = path.join(__dirname, '../services/masterDocxGenerator.py');
    const pyResult = spawnSync('python3', [scriptPath, tempJsonPath, tempDocxPath]);
    try { fs.unlinkSync(tempJsonPath); } catch (_) {}

    if (pyResult.status === 0 && fs.existsSync(tempDocxPath)) {
      const safeBankName = (caseItem.bankName || 'Valuation').replace(/[^a-zA-Z0-9_-]/g, '_');

      if (format === 'pdf') {
        const tempPdfPath = path.join('/tmp', `report_${caseItem.id}_${Date.now()}.pdf`);
        try {
          await convertDocxToPdf(tempDocxPath, tempPdfPath);
          const pdfBuffer = fs.readFileSync(tempPdfPath);
          try { fs.unlinkSync(tempDocxPath); } catch (_) {}
          try { fs.unlinkSync(tempPdfPath); } catch (_) {}

          res.setHeader('Content-Disposition', `inline; filename="${safeBankName}_Valuation_Report_${caseItem.id}.pdf"`);
          res.setHeader('Content-Type', 'application/pdf');
          return res.send(pdfBuffer);
        } catch (pdfErr) {
          try { fs.unlinkSync(tempDocxPath); } catch (_) {}
          try { fs.unlinkSync(tempPdfPath); } catch (_) {}
          console.error('PDF Conversion Error:', pdfErr);
          return res.status(500).json({ error: 'Complete PDF report conversion failed', details: pdfErr.message });
        }
      }

      const docxBuffer = fs.readFileSync(tempDocxPath);
      try { fs.unlinkSync(tempDocxPath); } catch (_) {}
      res.setHeader('Content-Disposition', `attachment; filename="${safeBankName}_Valuation_Report_${caseItem.id}.docx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      return res.send(docxBuffer);
    }
    console.warn('Falling back to imperative docx builder:', pyResult.stderr ? pyResult.stderr.toString() : '');

    const {
      Document, Packer, Paragraph, Table, TableRow, TableCell,
      TextRun, WidthType, AlignmentType, BorderStyle,
      ImageRun, ShadingType, VerticalAlign
    } = require('docx');

    const p = caseItem.propertyDetails || {};

    // ── helpers ──────────────────────────────────────────────────────────
    const val = (v) => (v != null && v !== '' ? String(v) : 'N/A');

    const bold = (text, size = 20, color = '000000') =>
      new TextRun({ text, bold: true, size, color, font: 'Times New Roman' });

    const normal = (text, size = 20, color = '000000') =>
      new TextRun({ text, size, color, font: 'Times New Roman' });

    const para = (children, alignment = AlignmentType.LEFT, spacingAfter = 100) =>
      new Paragraph({
        children: Array.isArray(children) ? children : [children],
        alignment,
        spacing: { after: spacingAfter }
      });

    const heading = (text) =>
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 24, color: '003087', font: 'Times New Roman' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '003087' } }
      });

    const cellShaded = (text, isHeader = false) =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({
            text: val(text),
            bold: isHeader,
            size: 18,
            font: 'Times New Roman',
            color: isHeader ? 'FFFFFF' : '1a1a1a'
          })],
          alignment: AlignmentType.CENTER
        })],
        shading: isHeader
          ? { fill: '003087', type: ShadingType.CLEAR, color: '003087' }
          : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 100, right: 100 }
      });

    const cellPlain = (text, widthPct, isBold = false, bg = 'FFFFFF') =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: val(text), bold: isBold, size: 18, font: 'Times New Roman' })],
          alignment: AlignmentType.LEFT
        })],
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        shading: bg !== 'FFFFFF' ? { fill: bg, type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER
      });

    const twoColRow = (label, value, labelBg = 'EEF2FF') =>
      new TableRow({
        children: [
          cellPlain(label, 35, true, labelBg),
          cellPlain(value, 65, false, 'FFFFFF')
        ]
      });

    // ── totals ────────────────────────────────────────────────────────────
    const additions = p.additionsWork || [];
    const additionsTotal = additions.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const floors = p.siteValue?.floors || [];
    const buildingValue = floors.reduce((sum, f) => {
      const numMatch = String(f.value || 0).replace(/,/g, '').match(/-?[0-9]+(?:\.[0-9]+)?/);
      const val = numMatch ? parseFloat(numMatch[0]) : 0;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    const plinthArea = p.siteValue?.plinthArea || 'N/A';
    const grandTotal = buildingValue + additionsTotal;

    // ── site photo buffers ────────────────────────────────────────────────
    const photoBuffers = [];
    for (const photo of (caseItem.sitePhotos || []).slice(0, 4)) {
      if (photo && photo.startsWith('data:image')) {
        try {
          const b64 = photo.replace(/^data:image\/\w+;base64,/, '');
          photoBuffers.push(Buffer.from(b64, 'base64'));
        } catch (_) { /* skip */ }
      }
    }

    // ── document children ─────────────────────────────────────────────────
    const children = [];

    // Header
    const bankHeader = (caseItem.bankName || 'BANK VALUATION REPORT').toUpperCase();
    const branchSubheader = [
      caseItem.bankBranch ? `${caseItem.bankBranch} Branch` : '',
      caseItem.bankDistrict ? `${caseItem.bankDistrict} Dist.` : '',
      config?.valuerProfile?.state || ''
    ].filter(Boolean).join(', ');

    children.push(para([bold(bankHeader, 28, '003087')], AlignmentType.CENTER, 0));
    if (branchSubheader) {
      children.push(para([normal(branchSubheader, 20, '003087')], AlignmentType.CENTER, 0));
    }
    children.push(para([bold('VALUATION REPORT OF IMMOVABLE PROPERTY', 22, '1a1a1a')], AlignmentType.CENTER, 200));
    children.push(new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '003087' } },
      spacing: { after: 160 }
    }));

    // 1. Reference Details
    children.push(heading('1. REFERENCE DETAILS'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Case / Account No.', val(caseItem.id)),
        twoColRow('Date of Valuation', new Date(caseItem.createdAt).toLocaleDateString('en-IN')),
        twoColRow('Bank Name', val(caseItem.bankName)),
        twoColRow('Bank Branch', val(caseItem.bankBranch)),
        twoColRow('Bank District', val(caseItem.bankDistrict)),
        twoColRow('Inspection Date', val(caseItem.inspectionDate)),
        twoColRow('Inspection Time', val(caseItem.inspectionTime))
      ]
    }));

    // 2. Client Details
    children.push(heading('2. CLIENT DETAILS'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Client Name', val(caseItem.clientName)),
        twoColRow("Father's / Husband's Name", val(caseItem.clientFatherName)),
        twoColRow('Contact Phone', val(caseItem.clientPhone)),
        twoColRow('Property Address', val(caseItem.address || caseItem.locationData)),
        twoColRow('Additional Notes', val(caseItem.note))
      ]
    }));

    // 3. Property Details
    children.push(heading('3. PROPERTY DETAILS'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Property Type', val(p.propertyType)),
        twoColRow('Survey No.', val(p.surveyNo)),
        twoColRow('Plot No.', val(p.plotNo)),
        twoColRow('Khatha No.', val(p.khathaNo)),
        twoColRow('Tax Assessment No.', val(p.assessmentNo)),
        twoColRow('Door No.', val(p.doorNo)),
        twoColRow('Net Extent', val(p.netExtent)),
        twoColRow('Deed No.', val(p.deedNo)),
        twoColRow('Deed Year', val(p.deedYear)),
        twoColRow('Approval Plan No.', val(p.approvalPlanNo)),
        twoColRow('Approval Plan Date', val(p.approvalPlanDate)),
        twoColRow('Building Age', val(p.buildingAge)),
        twoColRow('Structure Type', val(p.structureType)),
        twoColRow('Flooring Type', val(p.flooringType)),
        twoColRow('Road Width', val(p.roadWidth)),
        twoColRow('Road Type', val(p.roadType)),
        twoColRow('Plot Type', val(p.plotType)),
        twoColRow('Builder Name', val(p.builderName)),
        twoColRow('Flat No.', val(p.flatNo)),
        twoColRow('Floor No.', val(p.floorNo))
      ]
    }));

    // 4. Boundaries
    if (p.boundariesDoc || p.boundariesActual) {
      const bd = p.boundariesDoc || {};
      const ba = p.boundariesActual || {};
      children.push(heading('4. BOUNDARIES'));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cellShaded('Direction', true), cellShaded('As Per Document', true), cellShaded('Actual', true)] }),
          new TableRow({ children: [cellShaded('North'), cellPlain(bd.north, 40), cellPlain(ba.north, 40)] }),
          new TableRow({ children: [cellShaded('South'), cellPlain(bd.south, 40), cellPlain(ba.south, 40)] }),
          new TableRow({ children: [cellShaded('East'), cellPlain(bd.east, 40), cellPlain(ba.east, 40)] }),
          new TableRow({ children: [cellShaded('West'), cellPlain(bd.west, 40), cellPlain(ba.west, 40)] })
        ]
      }));
    }

    // 5. Building Valuation
    if (floors.length > 0) {
      children.push(heading('5. BUILDING VALUATION (FLOOR-WISE)'));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cellShaded('Floor', true), cellShaded('Built-up Area (sq.ft)', true), cellShaded('Value (Rs.)', true)] }),
          ...floors.map(f => new TableRow({
            children: [
              cellPlain(f.label || f.id, 30),
              cellPlain(plinthArea, 35),
              cellPlain(f.value ? `Rs. ${Number(f.value).toLocaleString('en-IN')}` : 'N/A', 35)
            ]
          })),
          new TableRow({
            children: [
              cellPlain('TOTAL', 30, true, 'EEF2FF'),
              cellPlain('', 35, false, 'EEF2FF'),
              cellPlain(`Rs. ${buildingValue.toLocaleString('en-IN')}`, 35, true, 'EEF2FF')
            ]
          })
        ]
      }));
    }

    // 6. Additions & Extra Works
    if (additions.length > 0) {
      children.push(heading('6. ADDITIONS & EXTRA WORKS'));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              cellShaded('#', true), cellShaded('Description', true), cellShaded('Qty', true),
              cellShaded('Rate (Rs.)', true), cellShaded('Amount (Rs.)', true)
            ]
          }),
          ...additions.map((a, i) => new TableRow({
            children: [
              cellPlain(String(i + 1), 8),
              cellPlain(a.description, 40),
              cellPlain(a.quantity, 12),
              cellPlain(a.rate ? `Rs. ${Number(a.rate).toLocaleString('en-IN')}` : 'N/A', 20),
              cellPlain(a.amount ? `Rs. ${Number(a.amount).toLocaleString('en-IN')}` : 'N/A', 20)
            ]
          })),
          new TableRow({
            children: [
              cellPlain('', 8, false, 'EEF2FF'),
              cellPlain('TOTAL', 40, true, 'EEF2FF'),
              cellPlain('', 12, false, 'EEF2FF'),
              cellPlain('', 20, false, 'EEF2FF'),
              cellPlain(`Rs. ${additionsTotal.toLocaleString('en-IN')}`, 20, true, 'EEF2FF')
            ]
          })
        ]
      }));
    }

    // 7. Valuation Summary (Comprehensive Bank Panel Appraisal)
    const valuationData = caseItem.valuation || {};
    const landVal = Number(valuationData.landValue || 0);
    const structCost = Number(valuationData.structureReplacementCost || buildingValue || 0);
    const deprAmt = Number(valuationData.depreciationAmount || 0);
    const netStructVal = Number(valuationData.netStructureValue || (structCost - deprAmt) || 0);
    const amenVal = Number(valuationData.amenitiesValue || additionsTotal || 0);
    const fmv = Number(valuationData.fairMarketValue || (landVal + netStructVal + amenVal) || grandTotal);
    const realVal = Number(valuationData.realizableValue || Math.round(fmv * 0.90));
    const distVal = Number(valuationData.distressSaleValue || Math.round(fmv * 0.85));
    const insVal = Number(valuationData.insurableValue || structCost);

    children.push(heading('7. VALUATION SUMMARY & PROPERTY APPRAISAL'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('A. Value of Land', `Rs. ${landVal.toLocaleString('en-IN')}`),
        twoColRow('B. Structure Replacement Cost', `Rs. ${structCost.toLocaleString('en-IN')}`),
        twoColRow('   Less: Depreciation', `- Rs. ${deprAmt.toLocaleString('en-IN')}`),
        twoColRow('C. Net Depreciated Structure Value', `Rs. ${netStructVal.toLocaleString('en-IN')}`),
        twoColRow('D. Extra Amenities & Services', `Rs. ${amenVal.toLocaleString('en-IN')}`),
        new TableRow({
          children: [
            cellPlain('FAIR MARKET VALUE (A + C + D)', 45, true, 'D4EDDA'),
            cellPlain(`Rs. ${fmv.toLocaleString('en-IN')}`, 55, true, 'D4EDDA')
          ]
        }),
        twoColRow('REALIZABLE VALUE (90% of Market Value)', `Rs. ${realVal.toLocaleString('en-IN')}`),
        twoColRow('DISTRESS SALE VALUE (85% of Market Value)', `Rs. ${distVal.toLocaleString('en-IN')}`),
        twoColRow('INSURABLE VALUE (Structure Replacement)', `Rs. ${insVal.toLocaleString('en-IN')}`)
      ]
    }));

    // 8. Site Photographs
    if (photoBuffers.length > 0) {
      children.push(heading('8. SITE PHOTOGRAPHS'));
      for (const buf of photoBuffers) {
        try {
          children.push(new Paragraph({
            children: [new ImageRun({ data: buf, transformation: { width: 400, height: 280 }, type: 'jpg' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 }
          }));
        } catch (_) { /* skip bad images */ }
      }
    }

    // 9. Valuer's Declaration
    const bankNorms = caseItem.bankName ? `${caseItem.bankName} panel norms` : 'bank panel norms';
    const valuerOrg = config?.valuerProfile?.organization || 'the Indian Institution of Valuers';
    const engineerName = caseItem.assignedEngineerName || engineer?.name || engineer?.username || config?.valuerProfile?.name || 'Authorized Valuer';
    const engineerLicense = engineer?.licenseNo || config?.valuerProfile?.licenseNo || 'Approved Bank Valuer';
    const reportPlace = [caseItem.bankDistrict, config?.valuerProfile?.state].filter(Boolean).join(', ') || config?.valuerProfile?.district || 'Registered Office';

    children.push(heading("9. VALUER'S DECLARATION"));
    children.push(para(
      [normal(`I hereby certify that I have inspected the above property and that the valuation has been made to the best of my knowledge and belief, in accordance with the guidelines laid down by ${valuerOrg} and ${bankNorms}.`)],
      AlignmentType.JUSTIFY, 240
    ));
    children.push(new Paragraph({ children: [], spacing: { after: 400 } }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                para([bold('Signature:', 18)]),
                para([normal('_________________________', 20)], AlignmentType.LEFT, 0),
                para([bold('Name:', 18)]),
                para([normal(val(engineerName), 18)], AlignmentType.LEFT, 0),
                para([bold('License No.:', 18)]),
                para([normal(val(engineerLicense), 18)], AlignmentType.LEFT, 0)
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
              }
            }),
            new TableCell({
              children: [
                para([bold('Date:', 18)]),
                para([normal(new Date().toLocaleDateString('en-IN'), 18)], AlignmentType.LEFT, 0),
                para([bold('Place:', 18)]),
                para([normal(val(reportPlace), 18)], AlignmentType.LEFT, 0)
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
              }
            })
          ]
        })
      ]
    }));

    // ── pack & send ───────────────────────────────────────────────────────
    const doc = new Document({
      sections: [{
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } }
        },
        children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const safeBankName = (caseItem.bankName || 'Valuation').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeBankName}_Valuation_Report_${caseItem.id}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);

  } catch (error) {
    console.error('Report Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cases/:id/track
router.post('/:id/track', authenticateToken, async (req, res) => {
  try {
    if (!(await loadVisibleCase(req, res))) return;
    const { lat, lng, status } = req.body;
    const updateData = { 'currentLocation.lastUpdated': new Date() };

    if (lat !== undefined && lng !== undefined) {
      updateData['currentLocation.lat'] = lat;
      updateData['currentLocation.lng'] = lng;
    }
    if (status !== undefined) {
      updateData.trackingStatus = status;
    }

    const updated = await ValuationCase.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cases/:id/report-preview — the bank-format report built from what the engineer has
// entered so far (not saved). Lets the engineer see the exact document before submitting.
router.post('/:id/report-preview', authenticateToken, async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { spawnSync } = require('child_process');
  try {
    const caseItem = await loadVisibleCase(req, res);
    if (!caseItem) return;
    const draft = { ...caseItem.toObject() };
    const ALLOWED = ['clientName', 'clientFatherName', 'bankName', 'bankBranch', 'bankDistrict', 'address',
      'propertyDetails', 'sitePhotos', 'signatureDataUrl', 'currentLocation', 'locationData'];
    for (const k of ALLOWED) if (req.body[k] !== undefined) draft[k] = req.body[k];
    if (req.body.bankName !== undefined) {
      const bank = await findBank(req.body.bankName);
      draft.bankId = bank ? bank.id : null;
      if (bank) draft.bankName = bank.name;
    }
    if (!draft.bankName) return res.status(400).json({ error: 'Choose the bank first — the report format depends on it.' });

    const data = await bankInfoForReport(draft);
    // ?values=1 → only the report's figures (fast), for the engineer's final-step summary
    if (req.query.values) {
      const v = await applyBankReportValues(draft, { valuationStatus: 'SUCCESS' });
      return res.json(v.source ? { fairMarketValue: v.fairMarketValue, realizableValue: v.realizableValue, distressSaleValue: v.distressSaleValue, landValue: v.landValue, netStructureValue: v.netStructureValue, amenitiesValue: v.amenitiesValue, reportTotal: v.reportTotal } : {});
    }
    const stamp = `${caseItem.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const jsonPath = path.join(os.tmpdir(), `preview_${stamp}.json`);
    const docxPath = path.join(os.tmpdir(), `preview_${stamp}.docx`);
    fs.writeFileSync(jsonPath, JSON.stringify(data), 'utf-8');
    const py = spawnSync('python3', [path.join(__dirname, '../services/masterDocxGenerator.py'), jsonPath, docxPath], { timeout: 120000 });
    try { fs.unlinkSync(jsonPath); } catch (_) {}
    if (py.status !== 0 || !fs.existsSync(docxPath)) {
      console.error('Report preview failed:', py.stderr ? py.stderr.toString().slice(-800) : '');
      return res.status(500).json({ error: 'Could not prepare the report preview.' });
    }
    const buf = fs.readFileSync(docxPath);
    try { fs.unlinkSync(docxPath); } catch (_) {}
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="Preview_${caseItem.id}.docx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
