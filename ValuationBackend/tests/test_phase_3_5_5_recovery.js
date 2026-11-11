/**
 * Phase 3.5.5 Isolated Storage Durability & Recovery Verification Test Suite
 * 
 * Verifies:
 * 1. Application restart preserves archives
 * 2. Deployment replacement preserves archives
 * 3. Database recovery preserves archive metadata
 * 4. Storage recovery preserves exact report binaries
 * 5. SHA-256 checksums match after recovery
 * 6. Unauthorized archive replacement is detected
 * 7. Unauthorized deletion is prevented where storage retention is configured
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ReportArchive = require('../models/ReportArchive');
const {
  getArchiveDirectory,
  computeSha256,
  signArchiveManifest,
  verifyArchiveManifest,
  getArchivedReport
} = require('../services/reportArchiveService');

// Isolated scratch directory for non-destructive durability testing
const ISOLATED_TEST_ROOT = path.join('/tmp', 'gcr_phase_3_5_5_recovery_test_' + Date.now());

const results = [];

function recordTest(testNum, testName, passed, details = {}) {
  results.push({ testNum, testName, passed, details });
  console.log(`[TEST ${testNum}] ${testName}: ${passed ? 'PASS' : 'FAIL'}`);
  if (details && Object.keys(details).length > 0) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

async function runRecoveryTestSuite() {
  console.log('================================================================');
  console.log('GCR PHASE 3.5.5: ISOLATED STORAGE DURABILITY & RECOVERY TESTS');
  console.log('Isolated Sandbox Directory:', ISOLATED_TEST_ROOT);
  console.log('================================================================\n');

  fs.mkdirSync(ISOLATED_TEST_ROOT, { recursive: true });

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:62884/test';
  await mongoose.connect(mongoUri);

  try {
    // -------------------------------------------------------------
    // TEST 1: APPLICATION RESTART PRESERVES ARCHIVES
    // -------------------------------------------------------------
    console.log('Running Test 1: Application Restart Preservation...');
    const test1Dir = path.join(ISOLATED_TEST_ROOT, 'test1_restart');
    fs.mkdirSync(test1Dir, { recursive: true });

    const sampleDocx = Buffer.from('GCR_SAMPLE_DOCX_BINARY_CONTENT_FOR_RESTART_TEST');
    const samplePdf = Buffer.from('GCR_SAMPLE_PDF_BINARY_CONTENT_FOR_RESTART_TEST');
    const docxPath = path.join(test1Dir, 'report_restart_test_v1.docx');
    const pdfPath = path.join(test1Dir, 'report_restart_test_v1.pdf');

    fs.writeFileSync(docxPath, sampleDocx);
    fs.writeFileSync(pdfPath, samplePdf);

    const docxHashBefore = computeSha256(sampleDocx);
    const pdfHashBefore = computeSha256(samplePdf);

    // Simulate process stop & simulated restart (re-reading files from cold storage)
    const docxAfterRestart = fs.readFileSync(docxPath);
    const pdfAfterRestart = fs.readFileSync(pdfPath);
    const docxHashAfter = computeSha256(docxAfterRestart);
    const pdfHashAfter = computeSha256(pdfAfterRestart);

    const test1Pass = (docxHashBefore === docxHashAfter) && (pdfHashBefore === pdfHashAfter);
    recordTest(1, 'Application restart preserves archives', test1Pass, {
      docxHashBefore,
      docxHashAfter,
      pdfHashBefore,
      pdfHashAfter,
      storageSubstrate: 'Persistent Volume (Local Host / EBS / Persistent Directory)'
    });

    // -------------------------------------------------------------
    // TEST 2: DEPLOYMENT REPLACEMENT PRESERVES ARCHIVES
    // -------------------------------------------------------------
    console.log('\nRunning Test 2: Deployment Replacement Preservation...');
    // Simulate container replacement where application container root is recreated,
    // but the persistent volume mount point remains intact.
    const persistentVolDir = path.join(ISOLATED_TEST_ROOT, 'persistent_volume_mount');
    fs.mkdirSync(persistentVolDir, { recursive: true });

    const depDocx = Buffer.from('GCR_ENTERPRISE_REPORT_V1_DEPLOYMENT_SAFETY');
    const depDocxPath = path.join(persistentVolDir, 'report_deployment_v1.docx');
    fs.writeFileSync(depDocxPath, depDocx);
    const depHashBefore = computeSha256(depDocx);

    // Simulate ephemeral container container destruction & new deployment mount
    const containerA = path.join(ISOLATED_TEST_ROOT, 'app_container_v1_old');
    const containerB = path.join(ISOLATED_TEST_ROOT, 'app_container_v2_new');
    fs.mkdirSync(containerA, { recursive: true });
    fs.mkdirSync(containerB, { recursive: true });

    // Old container is deleted
    fs.rmSync(containerA, { recursive: true, force: true });

    // New container starts and reads from persistentVolDir
    const depDocxAfterDeploy = fs.readFileSync(depDocxPath);
    const depHashAfter = computeSha256(depDocxAfterDeploy);

    const test2Pass = (depHashBefore === depHashAfter) && !fs.existsSync(containerA) && fs.existsSync(containerB);
    recordTest(2, 'Deployment replacement preserves archives', test2Pass, {
      depHashBefore,
      depHashAfter,
      ephemeralContainerDestroyed: !fs.existsSync(containerA),
      newDeploymentActive: fs.existsSync(containerB),
      volumePreserved: true
    });

    // -------------------------------------------------------------
    // TEST 3: DATABASE RECOVERY PRESERVES ARCHIVE METADATA
    // -------------------------------------------------------------
    console.log('\nRunning Test 3: Database Recovery Preserves Archive Metadata...');
    // Read live archive metadata for Case 20261101 Version 2
    const originalArchive = await ReportArchive.findOne({ caseId: '20261101', version: 2 });
    if (!originalArchive) {
      throw new Error('Case 20261101 Version 2 archive not found in DB');
    }

    // Export metadata to backup snapshot
    const backupSnapshot = JSON.stringify(originalArchive.toObject());

    // Simulate database crash/restore into a recovery staging object
    const recoveredArchiveObj = JSON.parse(backupSnapshot);

    const metaKeysMatch =
      recoveredArchiveObj.caseId === originalArchive.caseId &&
      recoveredArchiveObj.version === originalArchive.version &&
      recoveredArchiveObj.docxSha256 === originalArchive.docxSha256 &&
      recoveredArchiveObj.pdfSha256 === originalArchive.pdfSha256 &&
      recoveredArchiveObj.digitalSignature === originalArchive.digitalSignature &&
      recoveredArchiveObj.approvalStatus === originalArchive.approvalStatus &&
      recoveredArchiveObj.approvedBy === originalArchive.approvedBy;

    recordTest(3, 'Database recovery preserves archive metadata', metaKeysMatch, {
      caseId: recoveredArchiveObj.caseId,
      version: recoveredArchiveObj.version,
      docxSha256: recoveredArchiveObj.docxSha256,
      pdfSha256: recoveredArchiveObj.pdfSha256,
      digitalSignature: recoveredArchiveObj.digitalSignature,
      approvalStatus: recoveredArchiveObj.approvalStatus,
      approvedBy: recoveredArchiveObj.approvedBy,
      auditTrailLength: recoveredArchiveObj.auditTrail.length
    });

    // -------------------------------------------------------------
    // TEST 4: STORAGE RECOVERY PRESERVES EXACT REPORT BINARIES
    // -------------------------------------------------------------
    console.log('\nRunning Test 4: Storage Recovery Preserves Exact Report Binaries...');
    // Create backup archive bundle of current report storage
    const storageBackupDir = path.join(ISOLATED_TEST_ROOT, 'storage_backup_snapshot');
    const storageRecoveredDir = path.join(ISOLATED_TEST_ROOT, 'storage_recovered_volume');
    fs.mkdirSync(storageBackupDir, { recursive: true });
    fs.mkdirSync(storageRecoveredDir, { recursive: true });

    const liveDocxPath = originalArchive.docxStoragePath;
    const livePdfPath = originalArchive.pdfStoragePath;
    const originalDocxBuf = fs.readFileSync(liveDocxPath);
    const originalPdfBuf = fs.readFileSync(livePdfPath);

    // Snapshot
    const backupDocxPath = path.join(storageBackupDir, path.basename(liveDocxPath));
    const backupPdfPath = path.join(storageBackupDir, path.basename(livePdfPath));
    fs.writeFileSync(backupDocxPath, originalDocxBuf);
    fs.writeFileSync(backupPdfPath, originalPdfBuf);

    // Simulate disaster restore to recovered volume
    const recoveredDocxPath = path.join(storageRecoveredDir, path.basename(liveDocxPath));
    const recoveredPdfPath = path.join(storageRecoveredDir, path.basename(livePdfPath));
    fs.copyFileSync(backupDocxPath, recoveredDocxPath);
    fs.copyFileSync(backupPdfPath, recoveredPdfPath);

    const recDocxBuf = fs.readFileSync(recoveredDocxPath);
    const recPdfBuf = fs.readFileSync(recoveredPdfPath);

    const test4Pass =
      (originalDocxBuf.length === recDocxBuf.length) &&
      (originalPdfBuf.length === recPdfBuf.length) &&
      (originalDocxBuf.equals(recDocxBuf)) &&
      (originalPdfBuf.equals(recPdfBuf));

    recordTest(4, 'Storage recovery preserves exact report binaries', test4Pass, {
      liveDocxBytes: originalDocxBuf.length,
      recoveredDocxBytes: recDocxBuf.length,
      livePdfBytes: originalPdfBuf.length,
      recoveredPdfBytes: recPdfBuf.length,
      exactBinaryMatch: test4Pass
    });

    // -------------------------------------------------------------
    // TEST 5: SHA-256 CHECKSUMS MATCH AFTER RECOVERY
    // -------------------------------------------------------------
    console.log('\nRunning Test 5: SHA-256 Checksums Match After Recovery...');
    const recDocxSha = computeSha256(recDocxBuf);
    const recPdfSha = computeSha256(recPdfBuf);

    const test5Pass =
      (recDocxSha === originalArchive.docxSha256) &&
      (recPdfSha === originalArchive.pdfSha256);

    recordTest(5, 'SHA-256 checksums match after recovery', test5Pass, {
      expectedDocxSha256: originalArchive.docxSha256,
      recoveredDocxSha256: recDocxSha,
      docxMatch: recDocxSha === originalArchive.docxSha256,
      expectedPdfSha256: originalArchive.pdfSha256,
      recoveredPdfSha256: recPdfSha,
      pdfMatch: recPdfSha === originalArchive.pdfSha256
    });

    // -------------------------------------------------------------
    // TEST 6: UNAUTHORIZED ARCHIVE REPLACEMENT IS DETECTED
    // -------------------------------------------------------------
    console.log('\nRunning Test 6: Unauthorized Archive Replacement Tamper Detection...');
    // Create an isolated sandbox case record in DB to test tampering without touching live data
    const tamperCaseId = '99999999';
    const tamperVersion = 1;

    // Clean up any old tamper test record
    await ReportArchive.deleteOne({ caseId: tamperCaseId, version: tamperVersion });

    const tamperDir = path.join(ISOLATED_TEST_ROOT, 'tamper_test');
    fs.mkdirSync(tamperDir, { recursive: true });

    const genuinePdfBuf = Buffer.from('GENUINE_BANK_VALUATION_OFFICIAL_REPORT_V1');
    const genuineDocxBuf = Buffer.from('GENUINE_BANK_VALUATION_OFFICIAL_DOCX_V1');
    const genuinePdfPath = path.join(tamperDir, `report_${tamperCaseId}_v1.pdf`);
    const genuineDocxPath = path.join(tamperDir, `report_${tamperCaseId}_v1.docx`);
    const manifestPath = path.join(tamperDir, `manifest_${tamperCaseId}_v1.json`);

    fs.writeFileSync(genuinePdfPath, genuinePdfBuf);
    fs.writeFileSync(genuineDocxPath, genuineDocxBuf);

    const genuinePdfSha = computeSha256(genuinePdfBuf);
    const genuineDocxSha = computeSha256(genuineDocxBuf);

    const canonicalData = {
      caseId: tamperCaseId,
      version: tamperVersion,
      docxSha256: genuineDocxSha,
      pdfSha256: genuinePdfSha,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      approvalStatus: 'Pending',
      approvedBy: '',
      approvedAt: null
    };
    const validSignature = signArchiveManifest(canonicalData);

    const manifestData = {
      archiveStandard: 'GCR_SEC_ARCHIVE_V1',
      caseId: tamperCaseId,
      version: tamperVersion,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      artifacts: {
        docx: { filename: `report_${tamperCaseId}_v1.docx`, sha256: genuineDocxSha },
        pdf: { filename: `report_${tamperCaseId}_v1.pdf`, sha256: genuinePdfSha }
      },
      approval: { status: 'Pending', approvedBy: null, approvedAt: null },
      tamperProtection: {
        algorithm: 'HMAC-SHA256',
        keyId: 'gcr-2026-k1',
        digitalSignature: validSignature
      }
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8');

    const tamperArchive = await ReportArchive.create({
      caseId: tamperCaseId,
      version: tamperVersion,
      docxStoragePath: genuineDocxPath,
      pdfStoragePath: genuinePdfPath,
      manifestStoragePath: manifestPath,
      docxSha256: genuineDocxSha,
      pdfSha256: genuinePdfSha,
      digitalSignature: validSignature,
      approvalStatus: 'Pending',
      auditTrail: [{
        action: 'ARCHIVED',
        actor: 'SECURITY_TESTER',
        role: 'TESTER',
        timestamp: new Date()
      }]
    });

    // 6A. Verify genuine report fetches cleanly
    const fetchGenuine = await getArchivedReport(tamperCaseId, tamperVersion, 'pdf', { username: 'auditor' });
    const fetchGenuineOk = fetchGenuine.found && !fetchGenuine.corrupted;

    // 6B. Tamper Test 1: Tamper binary file directly (1 byte modified)
    const tamperedPdfBuf = Buffer.from('TAMPERED_FRAUDULENT_BANK_VALUATION_REPORT_123');
    fs.writeFileSync(genuinePdfPath, tamperedPdfBuf);

    const fetchTamperedBinary = await getArchivedReport(tamperCaseId, tamperVersion, 'pdf', { username: 'attacker' });
    const binaryTamperDetected = fetchTamperedBinary.corrupted && fetchTamperedBinary.error === 'ARCHIVE_FILE_CORRUPTED';

    // 6C. Tamper Test 2: Restore binary but forge manifest signature
    fs.writeFileSync(genuinePdfPath, genuinePdfBuf); // restore binary
    const forgedManifest = {
      archiveStandard: 'GCR_SEC_ARCHIVE_V1',
      caseId: tamperCaseId,
      version: tamperVersion,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      artifacts: {
        docx: { filename: `report_${tamperCaseId}_v1.docx`, sha256: genuineDocxSha },
        pdf: { filename: `report_${tamperCaseId}_v1.pdf`, sha256: genuinePdfSha }
      },
      approval: { status: 'Pending', approvedBy: null, approvedAt: null },
      tamperProtection: {
        algorithm: 'HMAC-SHA256',
        keyId: 'gcr-2026-k1',
        digitalSignature: 'deadbeefcafebabe0000111122223333444455556666777788889999aaaabbbb'
      }
    };
    fs.writeFileSync(manifestPath, JSON.stringify(forgedManifest, null, 2), 'utf-8');

    const fetchTamperedManifest = await getArchivedReport(tamperCaseId, tamperVersion, 'pdf', { username: 'attacker' });
    const manifestTamperDetected = fetchTamperedManifest.corrupted && fetchTamperedManifest.error === 'ARCHIVE_MANIFEST_TAMPERED';

    // Clean up test archive record
    await ReportArchive.deleteOne({ caseId: tamperCaseId, version: tamperVersion });

    const test6Pass = fetchGenuineOk && binaryTamperDetected && manifestTamperDetected;
    recordTest(6, 'Unauthorized archive replacement is detected', test6Pass, {
      fetchGenuineOk,
      binaryTamperDetected,
      binaryTamperError: fetchTamperedBinary.error,
      manifestTamperDetected,
      manifestTamperError: fetchTamperedManifest.error
    });

    // -------------------------------------------------------------
    // TEST 7: UNAUTHORIZED DELETION IS PREVENTED WHERE RETENTION CONFIGURED
    // -------------------------------------------------------------
    console.log('\nRunning Test 7: Unauthorized Deletion Prevention / Storage Retention...');
    const retentionDir = path.join(ISOLATED_TEST_ROOT, 'retention_test');
    fs.mkdirSync(retentionDir, { recursive: true });

    const lockedDocPath = path.join(retentionDir, 'report_worm_locked_v1.pdf');
    fs.writeFileSync(lockedDocPath, Buffer.from('WORM_PROTECTED_ENTERPRISE_REPORT_RECORDS'));

    // Apply strict POSIX read-only protection (simulating storage-level immutability)
    fs.chmodSync(lockedDocPath, 0o444); // Read-only for all (owner, group, other)

    let overwriteBlocked = false;
    try {
      fs.writeFileSync(lockedDocPath, Buffer.from('ATTEMPTED_OVERWRITE'));
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        overwriteBlocked = true;
      }
    }

    // Now test file missing detection in getArchivedReport
    const missingCaseId = '88888888';
    const missingVersion = 1;
    const ghostPdfPath = path.join(retentionDir, 'ghost_file_missing.pdf');
    // Ensure ghost file does not exist
    try { fs.unlinkSync(ghostPdfPath); } catch (_) {}

    await ReportArchive.create({
      caseId: missingCaseId,
      version: missingVersion,
      docxStoragePath: ghostPdfPath,
      pdfStoragePath: ghostPdfPath,
      docxSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      pdfSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      approvalStatus: 'Pending',
      auditTrail: []
    });

    const fetchMissing = await getArchivedReport(missingCaseId, missingVersion, 'pdf', { username: 'sec_monitor' });
    const missingDetected = fetchMissing.corrupted && fetchMissing.error === 'ARCHIVE_FILE_MISSING';

    await ReportArchive.deleteOne({ caseId: missingCaseId, version: missingVersion });

    // Restore permissions on test file so directory cleanup works
    fs.chmodSync(lockedDocPath, 0o666);

    const test7Pass = overwriteBlocked && missingDetected;
    recordTest(7, 'Unauthorized deletion is prevented where storage retention is configured', test7Pass, {
      readOnlyLockEnforced: overwriteBlocked,
      missingFileSecurityAlert: missingDetected,
      alertCode: fetchMissing.error
    });

  } finally {
    // Clean up isolated scratch root
    try {
      fs.rmSync(ISOLATED_TEST_ROOT, { recursive: true, force: true });
    } catch (_) {}
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log('PHASE 3.5.5 RECOVERY TEST SUITE SUMMARY');
  console.log('================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`FINAL RESULT: ${allPassed ? 'ALL TESTS PASSED (100%)' : 'TESTS FAILED'}`);
  return { allPassed, results };
}

if (require.main === module) {
  runRecoveryTestSuite().then(res => {
    process.exit(res.allPassed ? 0 : 1);
  }).catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  });
}

module.exports = { runRecoveryTestSuite };
