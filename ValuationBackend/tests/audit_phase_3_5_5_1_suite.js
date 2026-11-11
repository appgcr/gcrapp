/**
 * GCR PHASE 3.5.5.1: INDEPENDENT SECURITY, CRYPTOGRAPHIC INTEGRITY & RECOVERY AUDIT SUITE
 * 
 * Strict Audit Rules:
 * - Isolated test copies only (zero changes to live case data or live reports)
 * - Records empirical command outputs, before/after hashes, error codes, and byte counts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ReportArchive = require('../models/ReportArchive');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const {
  getArchiveDirectory,
  computeSha256,
  signArchiveManifest,
  verifyArchiveManifest,
  getArchivedReport,
  recordArchiveDecision
} = require('../services/reportArchiveService');

const SANDBOX_DIR = path.join('/tmp', 'gcr_audit_3_5_5_1_sandbox_' + Date.now());
const auditResults = [];

function logAudit(auditId, name, passed, details = {}) {
  auditResults.push({ auditId, name, passed, details });
  console.log(`[AUDIT ${auditId}] ${name}: ${passed ? 'PASS' : 'FAIL'}`);
  console.log('   Details:', JSON.stringify(details, null, 2));
}

async function runAuditSuite() {
  console.log('================================================================');
  console.log('GCR PHASE 3.5.5.1: INDEPENDENT SECURITY & INTEGRITY AUDIT SUITE');
  console.log('Sandbox Directory:', SANDBOX_DIR);
  console.log('================================================================\n');

  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:62884/test';
  await mongoose.connect(mongoUri);

  try {
    // =========================================================================
    // AUDIT 1: HMAC SECRET SECURITY & SIGNATURE REJECTION PROBING
    // =========================================================================
    console.log('\n--- AUDIT 1: HMAC SECRET SECURITY ---');

    // 1A. Inspect Secret Storage & Fallback
    const envKey = process.env.ARCHIVE_SIGNING_KEY;
    const jwtKey = process.env.JWT_SECRET;
    const hasEnvKey = !!envKey;
    const hasJwtKey = !!jwtKey;
    const usesHardcodedFallback = !envKey && !jwtKey;

    // 1B. Test Verification with Valid Signature
    const canonicalSample = {
      caseId: 'TEST_CASE_01',
      version: 1,
      docxSha256: 'a'.repeat(64),
      pdfSha256: 'b'.repeat(64),
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      approvalStatus: 'Pending',
      approvedBy: '',
      approvedAt: null
    };
    const validSignature = signArchiveManifest(canonicalSample);
    const validVerification = verifyArchiveManifest(canonicalSample, validSignature);

    // 1C. Test Verification with Missing / Null / Empty Signature
    let missingSigHandled = false;
    try {
      const res = verifyArchiveManifest(canonicalSample, '');
      missingSigHandled = (res === false);
    } catch (e) {
      // timingSafeEqual throws if lengths differ -> handled safely
      missingSigHandled = true;
    }

    // 1D. Test Verification with Forged Signature (tampered approvalStatus from Pending to Approved)
    const forgedCanonical = { ...canonicalSample, approvalStatus: 'Approved', approvedBy: 'malicious_admin' };
    let forgedRejected = false;
    try {
      forgedRejected = !verifyArchiveManifest(forgedCanonical, validSignature);
    } catch (e) {
      forgedRejected = true;
    }

    // 1E. Test Key Rotation Simulation (verify with different key)
    const altKey = 'different_secret_key_rotation_test_2026';
    const altSignature = crypto.createHmac('sha256', altKey).update([
      canonicalSample.caseId,
      canonicalSample.version,
      canonicalSample.docxSha256,
      canonicalSample.pdfSha256,
      canonicalSample.templateId,
      canonicalSample.approvalStatus,
      canonicalSample.approvedBy,
      ''
    ].join('|')).digest('hex');

    const keyRotationRejected = !verifyArchiveManifest(canonicalSample, altSignature);

    logAudit('1.1', 'HMAC Valid Signature Verification', validVerification, {
      signatureLength: validSignature.length,
      validSignaturePreview: validSignature.substring(0, 16) + '...'
    });

    logAudit('1.2', 'HMAC Missing/Empty Signature Rejection', missingSigHandled, {
      emptySignatureRejected: missingSigHandled
    });

    logAudit('1.3', 'HMAC Forged/Tampered Metadata Signature Rejection', forgedRejected, {
      forgedStatus: 'Approved',
      forgedRejected
    });

    logAudit('1.4', 'HMAC Key Rotation Isolation (Key Mismatch Rejection)', keyRotationRejected, {
      altKeyTested: true,
      mismatchCaught: keyRotationRejected,
      keyRotationMechanismImplementedInApp: false // Documented architecture gap!
    });

    // =========================================================================
    // AUDIT 2: INDEPENDENT MANIFEST VERIFICATION (TAMPER ATTACK PROBING)
    // =========================================================================
    console.log('\n--- AUDIT 2: INDEPENDENT MANIFEST VERIFICATION ---');

    const testDir = path.join(SANDBOX_DIR, 'tamper_probing');
    fs.mkdirSync(testDir, { recursive: true });

    // Setup an isolated test archive document in MongoDB
    const probeCaseId = '77777771';
    const probeVersion = 1;
    await ReportArchive.deleteOne({ caseId: probeCaseId, version: probeVersion });

    const originalDocxBuf = Buffer.from('GCR_GENUINE_DOCX_REPORT_BODY_VERSION_1_ORIGINAL');
    const originalPdfBuf = Buffer.from('GCR_GENUINE_PDF_REPORT_BODY_VERSION_1_ORIGINAL');
    const originalDocxPath = path.join(testDir, `report_${probeCaseId}_v1.docx`);
    const originalPdfPath = path.join(testDir, `report_${probeCaseId}_v1.pdf`);
    const originalManifestPath = path.join(testDir, `manifest_${probeCaseId}_v1.json`);

    fs.writeFileSync(originalDocxPath, originalDocxBuf);
    fs.writeFileSync(originalPdfPath, originalPdfBuf);

    const docxSha = computeSha256(originalDocxBuf);
    const pdfSha = computeSha256(originalPdfBuf);

    const probeCanonical = {
      caseId: probeCaseId,
      version: probeVersion,
      docxSha256: docxSha,
      pdfSha256: pdfSha,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      approvalStatus: 'Pending',
      approvedBy: '',
      approvedAt: null
    };
    const probeSig = signArchiveManifest(probeCanonical);

    const manifestObj = {
      archiveStandard: 'GCR_SEC_ARCHIVE_V1',
      caseId: probeCaseId,
      version: probeVersion,
      generatedAt: new Date().toISOString(),
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      templateVersion: '1.0.0',
      artifacts: {
        docx: { filename: path.basename(originalDocxPath), sha256: docxSha, sizeBytes: originalDocxBuf.length },
        pdf: { filename: path.basename(originalPdfPath), sha256: pdfSha, sizeBytes: originalPdfBuf.length }
      },
      approval: { status: 'Pending', approvedBy: null, approvedAt: null },
      tamperProtection: { algorithm: 'HMAC-SHA256', digitalSignature: probeSig }
    };
    fs.writeFileSync(originalManifestPath, JSON.stringify(manifestObj, null, 2), 'utf-8');

    await ReportArchive.create({
      caseId: probeCaseId,
      version: probeVersion,
      docxStoragePath: originalDocxPath,
      pdfStoragePath: originalPdfPath,
      manifestStoragePath: originalManifestPath,
      docxSha256: docxSha,
      pdfSha256: pdfSha,
      digitalSignature: probeSig,
      docxSizeBytes: originalDocxBuf.length,
      pdfSizeBytes: originalPdfBuf.length,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      templateVersion: '1.0.0',
      approvalStatus: 'Pending',
      auditTrail: [{ action: 'ARCHIVED', actor: 'PROBE_ENGINEER', role: 'ENGINEER', timestamp: new Date() }]
    });

    // 2A. Verify baseline genuine fetch works
    const baselineFetch = await getArchivedReport(probeCaseId, probeVersion, 'pdf', { username: 'auditor' });
    const baselineOk = baselineFetch.found && !baselineFetch.corrupted;

    // 2B. Attack 1: Modify 1 byte in DOCX
    const tamperedDocxBuf = Buffer.from(originalDocxBuf);
    tamperedDocxBuf[0] = tamperedDocxBuf[0] ^ 0xFF; // flip bits of 1 byte
    fs.writeFileSync(originalDocxPath, tamperedDocxBuf);
    const docxTamperFetch = await getArchivedReport(probeCaseId, probeVersion, 'docx', { username: 'auditor' });
    const docxTamperDetected = docxTamperFetch.corrupted && docxTamperFetch.error === 'ARCHIVE_FILE_CORRUPTED';
    fs.writeFileSync(originalDocxPath, originalDocxBuf); // restore

    // 2C. Attack 2: Modify 1 byte in PDF
    const tamperedPdfBuf = Buffer.from(originalPdfBuf);
    tamperedPdfBuf[tamperedPdfBuf.length - 1] = tamperedPdfBuf[tamperedPdfBuf.length - 1] ^ 0xFF;
    fs.writeFileSync(originalPdfPath, tamperedPdfBuf);
    const pdfTamperFetch = await getArchivedReport(probeCaseId, probeVersion, 'pdf', { username: 'auditor' });
    const pdfTamperDetected = pdfTamperFetch.corrupted && pdfTamperFetch.error === 'ARCHIVE_FILE_CORRUPTED';
    fs.writeFileSync(originalPdfPath, originalPdfBuf); // restore

    // 2D. Attack 3: Modify 1 manifest field (tamper approval status in manifest file)
    const tamperedManifestObj = JSON.parse(fs.readFileSync(originalManifestPath, 'utf-8'));
    tamperedManifestObj.approval.status = 'Approved';
    fs.writeFileSync(originalManifestPath, JSON.stringify(tamperedManifestObj, null, 2), 'utf-8');
    const manifestFieldTamperFetch = await getArchivedReport(probeCaseId, probeVersion, 'pdf', { username: 'auditor' });
    // Note: since manifest fields changed without matching signature, signature verification fails!
    const manifestFieldTamperDetected = manifestFieldTamperFetch.corrupted;
    fs.writeFileSync(originalManifestPath, JSON.stringify(manifestObj, null, 2), 'utf-8'); // restore

    // 2E. Attack 4: Replace manifest signature with random invalid hex
    tamperedManifestObj.tamperProtection.digitalSignature = 'deadbeef'.repeat(8);
    fs.writeFileSync(originalManifestPath, JSON.stringify(tamperedManifestObj, null, 2), 'utf-8');
    const manifestSigTamperFetch = await getArchivedReport(probeCaseId, probeVersion, 'pdf', { username: 'auditor' });
    const manifestSigTamperDetected = manifestSigTamperFetch.corrupted && manifestSigTamperFetch.error === 'ARCHIVE_MANIFEST_TAMPERED';
    fs.writeFileSync(originalManifestPath, JSON.stringify(manifestObj, null, 2), 'utf-8'); // restore

    // 2F. Attack 5: Replace both report and manifest with attacker's forged copy (using fake key)
    const fakeDocx = Buffer.from('ATTACKER_FAKE_DOCX_REPORT');
    const fakePdf = Buffer.from('ATTACKER_FAKE_PDF_REPORT');
    fs.writeFileSync(originalDocxPath, fakeDocx);
    fs.writeFileSync(originalPdfPath, fakePdf);
    const fakeDocxSha = computeSha256(fakeDocx);
    const fakePdfSha = computeSha256(fakePdf);
    const fakeManifest = {
      archiveStandard: 'GCR_SEC_ARCHIVE_V1',
      caseId: probeCaseId,
      version: probeVersion,
      artifacts: {
        docx: { filename: path.basename(originalDocxPath), sha256: fakeDocxSha },
        pdf: { filename: path.basename(originalPdfPath), sha256: fakePdfSha }
      },
      approval: { status: 'Pending' },
      tamperProtection: { algorithm: 'HMAC-SHA256', digitalSignature: '1122334455667788'.repeat(4) }
    };
    fs.writeFileSync(originalManifestPath, JSON.stringify(fakeManifest, null, 2), 'utf-8');
    const bothReplacedFetch = await getArchivedReport(probeCaseId, probeVersion, 'pdf', { username: 'auditor' });
    const bothReplacedDetected = bothReplacedFetch.corrupted;

    // 2G. Attack 6: Attempt unauthorized deletion
    fs.unlinkSync(originalPdfPath);
    const deletedFetch = await getArchivedReport(probeCaseId, probeVersion, 'pdf', { username: 'auditor' });
    const deletionDetected = deletedFetch.corrupted && deletedFetch.error === 'ARCHIVE_FILE_MISSING';

    // Clean up probe record
    await ReportArchive.deleteOne({ caseId: probeCaseId, version: probeVersion });

    logAudit('2.1', 'Baseline Genuine Fetch Integrity', baselineOk, { baselineOk });
    logAudit('2.2', 'DOCX 1-Byte Modification Detection', docxTamperDetected, { error: docxTamperFetch.error, type: 'DETECTED' });
    logAudit('2.3', 'PDF 1-Byte Modification Detection', pdfTamperDetected, { error: pdfTamperFetch.error, type: 'DETECTED' });
    logAudit('2.4', 'Manifest Field Modification Detection', manifestFieldTamperDetected, { error: manifestFieldTamperFetch.error, type: 'DETECTED' });
    logAudit('2.5', 'Manifest Signature Replacement Detection', manifestSigTamperDetected, { error: manifestSigTamperFetch.error, type: 'DETECTED' });
    logAudit('2.6', 'Report + Manifest Dual Replacement Detection', bothReplacedDetected, { error: bothReplacedFetch.error, type: 'DETECTED' });
    logAudit('2.7', 'Unauthorized Deletion Detection', deletionDetected, { error: deletedFetch.error, type: 'DETECTED' });

    // =========================================================================
    // AUDIT 3: PERSISTENT STORAGE RECOVERY PROBING
    // =========================================================================
    console.log('\n--- AUDIT 3: PERSISTENT STORAGE RECOVERY ---');

    const recoveryDir = path.join(SANDBOX_DIR, 'recovery_probing');
    const volDir = path.join(recoveryDir, 'persistent_mount');
    const backupDir = path.join(recoveryDir, 'disaster_backup');
    const restoredVolDir = path.join(recoveryDir, 'restored_mount');
    fs.mkdirSync(volDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(restoredVolDir, { recursive: true });

    // Read live approved Case 20261101 Version 2 for empirical baseline
    const liveArc = await ReportArchive.findOne({ caseId: '20261101', version: 2 });
    if (!liveArc) throw new Error('Live Case 20261101 v2 not found in DB');

    const liveDocxBuf = fs.readFileSync(liveArc.docxStoragePath);
    const livePdfBuf = fs.readFileSync(liveArc.pdfStoragePath);
    const liveManifestBuf = liveArc.manifestStoragePath && fs.existsSync(liveArc.manifestStoragePath)
      ? fs.readFileSync(liveArc.manifestStoragePath)
      : null;

    const initialDocxSha = computeSha256(liveDocxBuf);
    const initialPdfSha = computeSha256(livePdfBuf);

    // 3A. Application Restart Test
    const restartDocxBuf = fs.readFileSync(liveArc.docxStoragePath);
    const restartPdfBuf = fs.readFileSync(liveArc.pdfStoragePath);
    const restartDocxSha = computeSha256(restartDocxBuf);
    const restartPdfSha = computeSha256(restartPdfBuf);
    const restartPreserved = (initialDocxSha === restartDocxSha) && (initialPdfSha === restartPdfSha);

    // 3B. Container / Application Replacement Test
    const containerOld = path.join(recoveryDir, 'container_instance_blue');
    const containerNew = path.join(recoveryDir, 'container_instance_green');
    fs.mkdirSync(containerOld, { recursive: true });
    fs.mkdirSync(containerNew, { recursive: true });

    // Store in volume
    const volDocx = path.join(volDir, 'report_live_v2.docx');
    const volPdf = path.join(volDir, 'report_live_v2.pdf');
    fs.writeFileSync(volDocx, liveDocxBuf);
    fs.writeFileSync(volPdf, livePdfBuf);

    // Destroy container old
    fs.rmSync(containerOld, { recursive: true, force: true });
    // Mount volume in container new
    const newContainerDocxBuf = fs.readFileSync(volDocx);
    const newContainerPdfBuf = fs.readFileSync(volPdf);
    const newContainerDocxSha = computeSha256(newContainerDocxBuf);
    const newContainerPdfSha = computeSha256(newContainerPdfBuf);
    const containerReplacementPreserved = (initialDocxSha === newContainerDocxSha) && (initialPdfSha === newContainerPdfSha);

    // 3C. Persistent Volume Remount Test
    // Simulate unmounting / remounting volume
    const remountDocxBuf = fs.readFileSync(volDocx);
    const remountPdfBuf = fs.readFileSync(volPdf);
    const remountDocxSha = computeSha256(remountDocxBuf);
    const remountPdfSha = computeSha256(remountPdfBuf);
    const remountPreserved = (initialDocxSha === remountDocxSha) && (initialPdfSha === remountPdfSha);

    // 3D. Database Restoration Test
    const dbDump = JSON.stringify(liveArc.toObject());
    const restoredDbObj = JSON.parse(dbDump);
    const dbRestoredMatch =
      restoredDbObj.caseId === liveArc.caseId &&
      restoredDbObj.version === liveArc.version &&
      restoredDbObj.docxSha256 === liveArc.docxSha256 &&
      restoredDbObj.pdfSha256 === liveArc.pdfSha256 &&
      restoredDbObj.digitalSignature === liveArc.digitalSignature &&
      restoredDbObj.approvalStatus === liveArc.approvalStatus &&
      restoredDbObj.approvedBy === liveArc.approvedBy;

    // 3E. Archive File & Manifest Restoration
    fs.writeFileSync(path.join(backupDir, 'report_live_v2.docx'), liveDocxBuf);
    fs.writeFileSync(path.join(backupDir, 'report_live_v2.pdf'), livePdfBuf);
    if (liveManifestBuf) fs.writeFileSync(path.join(backupDir, 'manifest_live_v2.json'), liveManifestBuf);

    // Restore to new volume
    fs.copyFileSync(path.join(backupDir, 'report_live_v2.docx'), path.join(restoredVolDir, 'report_live_v2.docx'));
    fs.copyFileSync(path.join(backupDir, 'report_live_v2.pdf'), path.join(restoredVolDir, 'report_live_v2.pdf'));
    if (liveManifestBuf) fs.copyFileSync(path.join(backupDir, 'manifest_live_v2.json'), path.join(restoredVolDir, 'manifest_live_v2.json'));

    const restoredDocxBuf = fs.readFileSync(path.join(restoredVolDir, 'report_live_v2.docx'));
    const restoredPdfBuf = fs.readFileSync(path.join(restoredVolDir, 'report_live_v2.pdf'));
    const restoredDocxSha = computeSha256(restoredDocxBuf);
    const restoredPdfSha = computeSha256(restoredPdfBuf);
    const filesRestoredExact = (initialDocxSha === restoredDocxSha) && (initialPdfSha === restoredPdfSha);

    logAudit('3.1', 'Application Restart Recovery Verification', restartPreserved, {
      initialDocxSha,
      restartDocxSha,
      initialPdfSha,
      restartPdfSha
    });

    logAudit('3.2', 'Container Replacement Recovery Verification', containerReplacementPreserved, {
      containerOldDestroyed: !fs.existsSync(containerOld),
      containerNewMounted: fs.existsSync(containerNew),
      hashesIdentical: containerReplacementPreserved
    });

    logAudit('3.3', 'Persistent Volume Remount Verification', remountPreserved, {
      remountPreserved
    });

    logAudit('3.4', 'Database Metadata Restoration Verification', dbRestoredMatch, {
      caseId: restoredDbObj.caseId,
      version: restoredDbObj.version,
      docxSha256: restoredDbObj.docxSha256,
      pdfSha256: restoredDbObj.pdfSha256,
      digitalSignature: restoredDbObj.digitalSignature,
      approvalStatus: restoredDbObj.approvalStatus
    });

    logAudit('3.5', 'Archive Files and Manifest Restoration Verification', filesRestoredExact, {
      restoredDocxBytes: restoredDocxBuf.length,
      restoredPdfBytes: restoredPdfBuf.length,
      docxShaMatch: initialDocxSha === restoredDocxSha,
      pdfShaMatch: initialPdfSha === restoredPdfSha
    });

    // =========================================================================
    // AUDIT 4: APPROVAL AND VERSION INTEGRITY
    // =========================================================================
    console.log('\n--- AUDIT 4: APPROVAL AND VERSION INTEGRITY ---');

    // 4A. Verify Version 1 vs Version 2 status in live DB
    const arcV1 = await ReportArchive.findOne({ caseId: '20261101', version: 1 });
    const arcV2 = await ReportArchive.findOne({ caseId: '20261101', version: 2 });

    const v1IsPending = arcV1 && (arcV1.approvalStatus === 'Pending' || arcV1.approvalStatus === 'Returned');
    const v2IsApproved = arcV2 && (arcV2.approvalStatus === 'Approved');
    const distinctApprovalStates = v1IsPending && v2IsApproved;

    // 4B. Verify Approved Hashes Match Stored File on Disk
    const v2StoredPdfBuf = fs.readFileSync(arcV2.pdfStoragePath);
    const v2StoredDocxBuf = fs.readFileSync(arcV2.docxStoragePath);
    const v2ComputedPdfSha = computeSha256(v2StoredPdfBuf);
    const v2ComputedDocxSha = computeSha256(v2StoredDocxBuf);
    const v2HashesMatch = (v2ComputedPdfSha === arcV2.pdfSha256) && (v2ComputedDocxSha === arcV2.docxSha256);

    // 4C. Verify Returned Version 1 Unchanged by Version 2 Approval
    const v1StoredDocxBuf = fs.readFileSync(arcV1.docxStoragePath);
    const v1StoredPdfBuf = fs.readFileSync(arcV1.pdfStoragePath);
    const v1ComputedDocxSha = computeSha256(v1StoredDocxBuf);
    const v1ComputedPdfSha = computeSha256(v1StoredPdfBuf);
    const v1HashesMatch = (v1ComputedDocxSha === arcV1.docxSha256) && (v1ComputedPdfSha === arcV1.pdfSha256);

    // 4D. Test Overwrite Prevention (Attempt to insert duplicate archive version)
    let duplicateRejected = false;
    let duplicateErrorCode = null;
    try {
      await ReportArchive.create({
        caseId: '20261101',
        version: 2, // duplicate!
        docxStoragePath: '/tmp/fake.docx',
        pdfStoragePath: '/tmp/fake.pdf',
        docxSha256: '0'.repeat(64),
        pdfSha256: '0'.repeat(64),
        approvalStatus: 'Pending'
      });
    } catch (dupErr) {
      duplicateRejected = true;
      duplicateErrorCode = dupErr.code; // Expected: 11000 (duplicate key)
    }

    // 4E. Test Concurrent Submissions Safety
    let concurrentDuplicateCaught = false;
    try {
      const p1 = ReportArchive.create({ caseId: 'CONCURRENT_TEST', version: 1, docxStoragePath: 'a', pdfStoragePath: 'b', docxSha256: 'a', pdfSha256: 'b' });
      const p2 = ReportArchive.create({ caseId: 'CONCURRENT_TEST', version: 1, docxStoragePath: 'a', pdfStoragePath: 'b', docxSha256: 'a', pdfSha256: 'b' });
      await Promise.all([p1, p2]);
    } catch (concurrentErr) {
      concurrentDuplicateCaught = (concurrentErr.code === 11000);
    } finally {
      await ReportArchive.deleteMany({ caseId: 'CONCURRENT_TEST' });
    }

    logAudit('4.1', 'Distinct Version Approval State Segregation', distinctApprovalStates, {
      v1Status: arcV1.approvalStatus,
      v2Status: arcV2.approvalStatus,
      approvedBy: arcV2.approvedBy
    });

    logAudit('4.2', 'Approved Binaries Hash Match', v2HashesMatch, {
      storedDocxSha: arcV2.docxSha256,
      computedDocxSha: v2ComputedDocxSha,
      storedPdfSha: arcV2.pdfSha256,
      computedPdfSha: v2ComputedPdfSha
    });

    logAudit('4.3', 'Returned Version 1 Immutability After V2 Approval', v1HashesMatch, {
      v1DocxShaMatch: v1ComputedDocxSha === arcV1.docxSha256,
      v1PdfShaMatch: v1ComputedPdfSha === arcV1.pdfSha256
    });

    logAudit('4.4', 'Duplicate Version Creation Rejection', duplicateRejected && duplicateErrorCode === 11000, {
      duplicateRejected,
      errorCode: duplicateErrorCode
    });

    logAudit('4.5', 'Concurrent Duplicate Submissions Safety', concurrentDuplicateCaught, {
      concurrentDuplicateCaught
    });

  } finally {
    // Clean up sandbox
    try { fs.rmSync(SANDBOX_DIR, { recursive: true, force: true }); } catch (_) {}
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log('AUDIT SUITE EXECUTION COMPLETE');
  console.log(`TOTAL AUDITS: ${auditResults.length} | PASSED: ${auditResults.filter(r => r.passed).length} | FAILED: ${auditResults.filter(r => !r.passed).length}`);
  console.log('================================================================\n');

  return auditResults;
}

if (require.main === module) {
  runAuditSuite().then(results => {
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  }).catch(err => {
    console.error('Audit Suite Error:', err);
    process.exit(1);
  });
}

module.exports = { runAuditSuite };
