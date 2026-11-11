/**
 * GCR PHASE 3.5.5.2 CRITICAL SECURITY REMEDIATION TEST SUITE
 * 
 * Verifies Remediations:
 * - F-01: Manifest self-verification & cross-checking
 * - F-02: Removal of hardcoded signing secrets (fail-safe on missing key)
 * - F-03: Keyring versioning, historical verification, and key rotation
 * 
 * Executes 15 mandatory security & integrity tests in an isolated sandbox.
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
  getArchivedReport,
  recordArchiveDecision,
  getKeyring,
  getActiveSigningKey,
  getVerificationKey,
  KmsSignerAdapter
} = require('../services/reportArchiveService');

const SANDBOX_DIR = path.join('/tmp', 'gcr_remediation_test_sandbox_' + Date.now());
const results = [];

function recordTest(testId, name, passed, details = {}) {
  results.push({ testId, name, passed, details });
  console.log(`[TEST ${testId}] ${name}: ${passed ? 'PASS' : 'FAIL'}`);
  if (details && Object.keys(details).length > 0) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

async function runRemediationTests() {
  console.log('================================================================');
  console.log('GCR PHASE 3.5.5.2 CRITICAL SECURITY REMEDIATION TEST SUITE');
  console.log('Isolated Sandbox:', SANDBOX_DIR);
  console.log('================================================================\n');

  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:62884/test';
  await mongoose.connect(mongoUri);

  // Set standard development environment keys for baseline testing
  process.env.ARCHIVE_SIGNING_KEY_ID = 'gcr-2026-k1';
  process.env.ARCHIVE_SIGNING_KEY = 'gcr_enterprise_immutable_archive_signing_key_2026';

  try {
    // -------------------------------------------------------------
    // SETUP HELPER: Create an isolated test archive in sandbox
    // -------------------------------------------------------------
    async function setupIsolatedArchive(caseId, version, options = {}) {
      const caseDir = path.join(SANDBOX_DIR, `case_${caseId}_v${version}`);
      fs.mkdirSync(caseDir, { recursive: true });

      const docxBuf = Buffer.from(`DOCX_CONTENT_CASE_${caseId}_V${version}`);
      const pdfBuf = Buffer.from(`PDF_CONTENT_CASE_${caseId}_V${version}`);
      const docxPath = path.join(caseDir, `report_${caseId}_v${version}.docx`);
      const pdfPath = path.join(caseDir, `report_${caseId}_v${version}.pdf`);
      const manifestPath = path.join(caseDir, `manifest_${caseId}_v${version}.json`);

      fs.writeFileSync(docxPath, docxBuf);
      fs.writeFileSync(pdfPath, pdfBuf);

      const docxSha = computeSha256(docxBuf);
      const pdfSha = computeSha256(pdfBuf);
      const keyId = options.keyId || 'gcr-2026-k1';

      const canonicalData = {
        caseId: String(caseId),
        version: Number(version),
        docxSha256: docxSha,
        pdfSha256: pdfSha,
        templateId: options.templateId || 'HOUSE_APGB_NEW_FORMAT',
        approvalStatus: options.approvalStatus || 'Pending',
        approvedBy: options.approvedBy || '',
        approvedAt: options.approvedAt || null
      };

      const digitalSignature = signArchiveManifest(canonicalData, keyId);

      const manifestPayload = {
        archiveStandard: 'GCR_SEC_ARCHIVE_V1',
        caseId: String(caseId),
        version: Number(version),
        generatedAt: new Date().toISOString(),
        templateId: options.templateId || 'HOUSE_APGB_NEW_FORMAT',
        templateVersion: '1.0.0',
        bankName: options.bankName || 'State Bank of India',
        bankBranch: 'RACPC Kurnool',
        propertyType: 'Independent House',
        artifacts: {
          docx: { filename: path.basename(docxPath), sha256: docxSha, sizeBytes: docxBuf.length },
          pdf: { filename: path.basename(pdfPath), sha256: pdfSha, sizeBytes: pdfBuf.length }
        },
        approval: {
          status: options.approvalStatus || 'Pending',
          approvedBy: options.approvedBy || null,
          approvedAt: options.approvedAt ? new Date(options.approvedAt).toISOString() : null,
          decisionComment: options.decisionComment || null
        },
        tamperProtection: {
          algorithm: 'HMAC-SHA256',
          keyId,
          digitalSignature
        }
      };

      fs.writeFileSync(manifestPath, JSON.stringify(manifestPayload, null, 2), 'utf-8');

      await ReportArchive.deleteOne({ caseId: String(caseId), version: Number(version) });
      const record = await ReportArchive.create({
        caseId: String(caseId),
        version: Number(version),
        docxStoragePath: docxPath,
        pdfStoragePath: pdfPath,
        manifestStoragePath: manifestPath,
        docxSha256: docxSha,
        pdfSha256: pdfSha,
        digitalSignature,
        keyId,
        docxSizeBytes: docxBuf.length,
        pdfSizeBytes: pdfBuf.length,
        templateId: options.templateId || 'HOUSE_APGB_NEW_FORMAT',
        templateVersion: '1.0.0',
        approvalStatus: options.approvalStatus || 'Pending',
        approvedBy: options.approvedBy || null,
        approvedAt: options.approvedAt || null,
        decisionComment: options.decisionComment || null,
        auditTrail: [{ action: 'ARCHIVED', actor: 'TEST_ENGINEER', role: 'ENGINEER', timestamp: new Date() }]
      });

      return { docxPath, pdfPath, manifestPath, docxSha, pdfSha, digitalSignature, keyId, record };
    }

    // =========================================================================
    // TEST 1: F-01 REGRESSION — MANIFEST APPROVAL-STATUS MODIFICATION
    // =========================================================================
    console.log('\n--- 1. F-01 MANIFEST SELF-VERIFICATION TESTS ---');
    const t1 = await setupIsolatedArchive('88880001', 1);

    // Tamper: change manifest approval.status to 'Approved' while keeping original signature
    const t1Manifest = JSON.parse(fs.readFileSync(t1.manifestPath, 'utf-8'));
    t1Manifest.approval.status = 'Approved';
    fs.writeFileSync(t1.manifestPath, JSON.stringify(t1Manifest, null, 2), 'utf-8');

    const t1Fetch = await getArchivedReport('88880001', 1, 'pdf', { username: 'test_sec_auditor' });
    const t1Passed = t1Fetch.corrupted === true && t1Fetch.error === 'ARCHIVE_MANIFEST_TAMPERED';
    recordTest('1.1', 'Manifest Approval-Status Modification Detection (F-01)', t1Passed, {
      corrupted: t1Fetch.corrupted,
      error: t1Fetch.error,
      message: t1Fetch.message
    });
    await ReportArchive.deleteOne({ caseId: '88880001', version: 1 });

    // =========================================================================
    // TEST 2: MANIFEST CASE-ID MODIFICATION
    // =========================================================================
    const t2 = await setupIsolatedArchive('88880002', 1);
    const t2Manifest = JSON.parse(fs.readFileSync(t2.manifestPath, 'utf-8'));
    t2Manifest.caseId = '99990009'; // Tampered Case ID
    fs.writeFileSync(t2.manifestPath, JSON.stringify(t2Manifest, null, 2), 'utf-8');

    const t2Fetch = await getArchivedReport('88880002', 1, 'pdf', { username: 'test_sec_auditor' });
    const t2Passed = t2Fetch.corrupted === true && t2Fetch.error === 'ARCHIVE_MANIFEST_TAMPERED';
    recordTest('1.2', 'Manifest Case-ID Modification Detection', t2Passed, {
      corrupted: t2Fetch.corrupted,
      error: t2Fetch.error
    });
    await ReportArchive.deleteOne({ caseId: '88880002', version: 1 });

    // =========================================================================
    // TEST 3: MANIFEST VERSION MODIFICATION
    // =========================================================================
    const t3 = await setupIsolatedArchive('88880003', 1);
    const t3Manifest = JSON.parse(fs.readFileSync(t3.manifestPath, 'utf-8'));
    t3Manifest.version = 99; // Tampered Version
    fs.writeFileSync(t3.manifestPath, JSON.stringify(t3Manifest, null, 2), 'utf-8');

    const t3Fetch = await getArchivedReport('88880003', 1, 'pdf', { username: 'test_sec_auditor' });
    const t3Passed = t3Fetch.corrupted === true && t3Fetch.error === 'ARCHIVE_MANIFEST_TAMPERED';
    recordTest('1.3', 'Manifest Version Modification Detection', t3Passed, {
      corrupted: t3Fetch.corrupted,
      error: t3Fetch.error
    });
    await ReportArchive.deleteOne({ caseId: '88880003', version: 1 });

    // =========================================================================
    // TEST 4: MANIFEST HASH MODIFICATION
    // =========================================================================
    const t4 = await setupIsolatedArchive('88880004', 1);
    const t4Manifest = JSON.parse(fs.readFileSync(t4.manifestPath, 'utf-8'));
    t4Manifest.artifacts.pdf.sha256 = 'f'.repeat(64); // Tampered Hash
    fs.writeFileSync(t4.manifestPath, JSON.stringify(t4Manifest, null, 2), 'utf-8');

    const t4Fetch = await getArchivedReport('88880004', 1, 'pdf', { username: 'test_sec_auditor' });
    const t4Passed = t4Fetch.corrupted === true && t4Fetch.error === 'ARCHIVE_MANIFEST_TAMPERED';
    recordTest('1.4', 'Manifest Hash Modification Detection', t4Passed, {
      corrupted: t4Fetch.corrupted,
      error: t4Fetch.error
    });
    await ReportArchive.deleteOne({ caseId: '88880004', version: 1 });

    // =========================================================================
    // TEST 5: INVALID / FORGED MANIFEST SIGNATURE
    // =========================================================================
    const t5 = await setupIsolatedArchive('88880005', 1);
    const t5Manifest = JSON.parse(fs.readFileSync(t5.manifestPath, 'utf-8'));
    t5Manifest.tamperProtection.digitalSignature = 'deadbeef'.repeat(8);
    fs.writeFileSync(t5.manifestPath, JSON.stringify(t5Manifest, null, 2), 'utf-8');

    const t5Fetch = await getArchivedReport('88880005', 1, 'pdf', { username: 'test_sec_auditor' });
    const t5Passed = t5Fetch.corrupted === true && t5Fetch.error === 'ARCHIVE_MANIFEST_TAMPERED';
    recordTest('1.5', 'Forged Manifest Signature Rejection', t5Passed, {
      corrupted: t5Fetch.corrupted,
      error: t5Fetch.error
    });
    await ReportArchive.deleteOne({ caseId: '88880005', version: 1 });

    // =========================================================================
    // TEST 6: F-02 — MISSING SIGNING KEY (FAIL SECURE)
    // =========================================================================
    console.log('\n--- 2. F-02 REMOVE HARDCODED SIGNING SECRET TESTS ---');
    const savedKey = process.env.ARCHIVE_SIGNING_KEY;
    const savedKeyring = process.env.ARCHIVE_KEYRING;
    delete process.env.ARCHIVE_SIGNING_KEY;
    delete process.env.ARCHIVE_KEYRING;

    let failSecureCaught = false;
    let failSecureMessage = '';
    try {
      getActiveSigningKey();
    } catch (secErr) {
      failSecureCaught = true;
      failSecureMessage = secErr.message;
    }

    // Restore environment keys
    process.env.ARCHIVE_SIGNING_KEY = savedKey;
    if (savedKeyring) process.env.ARCHIVE_KEYRING = savedKeyring;

    const t6Passed = failSecureCaught && failSecureMessage.includes('Hardcoded key fallback is strictly disabled');
    recordTest('2.1', 'Missing Signing Key Fail-Secure Rejection (F-02)', t6Passed, {
      failSecureCaught,
      message: failSecureMessage
    });

    // =========================================================================
    // TEST 7: F-03 — UNKNOWN KEY ID REJECTION
    // =========================================================================
    console.log('\n--- 3. F-03 KEYRING AND ROTATION TESTS ---');
    const t7 = await setupIsolatedArchive('88880007', 1);
    const t7Manifest = JSON.parse(fs.readFileSync(t7.manifestPath, 'utf-8'));
    t7Manifest.tamperProtection.keyId = 'gcr-unknown-revoked-k99'; // Unknown key ID
    fs.writeFileSync(t7.manifestPath, JSON.stringify(t7Manifest, null, 2), 'utf-8');

    const t7Fetch = await getArchivedReport('88880007', 1, 'pdf', { username: 'test_sec_auditor' });
    const t7Passed = t7Fetch.corrupted === true && t7Fetch.error === 'ARCHIVE_KEY_UNKNOWN';
    recordTest('3.1', 'Unknown Key ID Rejection (F-03)', t7Passed, {
      corrupted: t7Fetch.corrupted,
      error: t7Fetch.error,
      message: t7Fetch.message
    });
    await ReportArchive.deleteOne({ caseId: '88880007', version: 1 });

    // =========================================================================
    // TEST 8: HISTORICAL KEY VERIFICATION ACROSS ROTATION
    // =========================================================================
    // Configure a multi-key keyring with historical key k1 and active key k2
    const historicalKey1 = 'key_secret_historical_k1_2026';
    const activeKey2 = 'key_secret_new_rotation_k2_2026';
    process.env.ARCHIVE_KEYRING = JSON.stringify({
      'gcr-2026-k1': historicalKey1,
      'gcr-2026-k2': activeKey2
    });
    process.env.ARCHIVE_SIGNING_KEY_ID = 'gcr-2026-k2'; // Active is now k2
    process.env.ARCHIVE_SIGNING_KEY = activeKey2;

    // Create an archive signed with historical k1
    const t8 = await setupIsolatedArchive('88880008', 1, { keyId: 'gcr-2026-k1' });
    const t8Fetch = await getArchivedReport('88880008', 1, 'pdf', { username: 'auditor' });
    const t8Passed = t8Fetch.found === true && t8Fetch.corrupted === false;
    recordTest('3.2', 'Historical Key Verification from Multi-Key Keyring', t8Passed, {
      found: t8Fetch.found,
      corrupted: t8Fetch.corrupted,
      historicalKeyIdUsed: 'gcr-2026-k1',
      activeKeyId: 'gcr-2026-k2'
    });
    await ReportArchive.deleteOne({ caseId: '88880008', version: 1 });

    // =========================================================================
    // TEST 9: CONTROLLED KEY ROTATION TO NEW KEY
    // =========================================================================
    // Now create a new archive using the rotated active key k2
    const t9 = await setupIsolatedArchive('88880009', 1, { keyId: 'gcr-2026-k2' });
    const t9Manifest = JSON.parse(fs.readFileSync(t9.manifestPath, 'utf-8'));
    const t9Fetch = await getArchivedReport('88880009', 1, 'pdf', { username: 'auditor' });
    const t9Passed = (t9Manifest.tamperProtection.keyId === 'gcr-2026-k2') && t9Fetch.found && !t9Fetch.corrupted;
    recordTest('3.3', 'Controlled Key Rotation (New Report uses Rotated Key)', t9Passed, {
      keyIdInManifest: t9Manifest.tamperProtection.keyId,
      retrievalSuccess: !t9Fetch.corrupted
    });
    await ReportArchive.deleteOne({ caseId: '88880009', version: 1 });

    // Restore standard environment keys
    process.env.ARCHIVE_SIGNING_KEY_ID = 'gcr-2026-k1';
    process.env.ARCHIVE_SIGNING_KEY = 'gcr_enterprise_immutable_archive_signing_key_2026';
    delete process.env.ARCHIVE_KEYRING;

    // =========================================================================
    // TEST 10: DOCX CORRUPTION DETECTION
    // =========================================================================
    console.log('\n--- 4. BINARY & ARCHIVE REPLACEMENT TESTS ---');
    const t10 = await setupIsolatedArchive('88880010', 1);
    const t10Docx = Buffer.from(fs.readFileSync(t10.docxPath));
    t10Docx[0] = t10Docx[0] ^ 0xFF; // corrupt 1 byte
    fs.writeFileSync(t10.docxPath, t10Docx);

    const t10Fetch = await getArchivedReport('88880010', 1, 'docx', { username: 'auditor' });
    const t10Passed = t10Fetch.corrupted === true && t10Fetch.error === 'ARCHIVE_FILE_CORRUPTED';
    recordTest('4.1', 'DOCX Binary 1-Byte Corruption Detection', t10Passed, {
      corrupted: t10Fetch.corrupted,
      error: t10Fetch.error
    });
    await ReportArchive.deleteOne({ caseId: '88880010', version: 1 });

    // =========================================================================
    // TEST 11: PDF CORRUPTION DETECTION
    // =========================================================================
    const t11 = await setupIsolatedArchive('88880011', 1);
    const t11Pdf = Buffer.from(fs.readFileSync(t11.pdfPath));
    t11Pdf[t11Pdf.length - 1] = t11Pdf[t11Pdf.length - 1] ^ 0xFF; // corrupt 1 byte
    fs.writeFileSync(t11.pdfPath, t11Pdf);

    const t11Fetch = await getArchivedReport('88880011', 1, 'pdf', { username: 'auditor' });
    const t11Passed = t11Fetch.corrupted === true && t11Fetch.error === 'ARCHIVE_FILE_CORRUPTED';
    recordTest('4.2', 'PDF Binary 1-Byte Corruption Detection', t11Passed, {
      corrupted: t11Fetch.corrupted,
      error: t11Fetch.error
    });
    await ReportArchive.deleteOne({ caseId: '88880011', version: 1 });

    // =========================================================================
    // TEST 12: UNAUTHORIZED ARCHIVE REPLACEMENT
    // =========================================================================
    const t12 = await setupIsolatedArchive('88880012', 1);
    fs.writeFileSync(t12.pdfPath, Buffer.from('FRAUDULENT_PDF_CONTENT'));
    const t12Fetch = await getArchivedReport('88880012', 1, 'pdf', { username: 'attacker' });
    const t12Passed = t12Fetch.corrupted === true && t12Fetch.error === 'ARCHIVE_FILE_CORRUPTED';
    recordTest('4.3', 'Unauthorized Archive Replacement Detection', t12Passed, {
      corrupted: t12Fetch.corrupted,
      error: t12Fetch.error
    });
    await ReportArchive.deleteOne({ caseId: '88880012', version: 1 });

    // =========================================================================
    // TEST 13: HISTORICAL VERSION RETRIEVAL WITHOUT REGENERATION
    // =========================================================================
    console.log('\n--- 5. APPROVAL & DATA PRESERVATION INTEGRITY ---');
    // Retrieve live historical Case 20261101 Version 1 and Version 2
    const v1Fetch = await getArchivedReport('20261101', 1, 'pdf', { username: 'auditor' });
    const v2Fetch = await getArchivedReport('20261101', 2, 'pdf', { username: 'auditor' });
    const t13Passed = v1Fetch.found && !v1Fetch.corrupted && v2Fetch.found && !v2Fetch.corrupted;
    recordTest('5.1', 'Historical Version Retrieval Without Regeneration', t13Passed, {
      v1Sha: v1Fetch.sha256,
      v2Sha: v2Fetch.sha256,
      v1Filename: v1Fetch.filename,
      v2Filename: v2Fetch.filename
    });

    // =========================================================================
    // TEST 14: APPROVAL-TO-BINARY BINDING INTEGRITY
    // =========================================================================
    const liveV2 = await ReportArchive.findOne({ caseId: '20261101', version: 2 });
    const t14Passed =
      liveV2 &&
      liveV2.approvalStatus === 'Approved' &&
      liveV2.approvedBy === 'admin' &&
      liveV2.docxSha256 === '813a013f7cba0cfafc18fb8ccefccafcd9733ddf705244261612fa46edf9a58c' &&
      liveV2.pdfSha256 === '6bb83e92e71cb03264744218546395900dcb152d99ed74c22bcd5bb050c94c0f' &&
      liveV2.digitalSignature !== null;
    recordTest('5.2', 'Approval-to-Binary Binding Verification', t14Passed, {
      caseId: liveV2.caseId,
      version: liveV2.version,
      approvalStatus: liveV2.approvalStatus,
      approvedBy: liveV2.approvedBy,
      approvedAt: liveV2.approvedAt
    });

    // =========================================================================
    // TEST 15: METADATA CROSS-CHECK MISMATCH (MANIFEST VS DB)
    // =========================================================================
    const t15 = await setupIsolatedArchive('88880015', 1, { approvalStatus: 'Pending' });
    // Legitimate signature computed for 'Approved', written to manifest file, BUT DB remains 'Pending'
    const legitimateApprovedSig = signArchiveManifest({
      caseId: '88880015',
      version: 1,
      docxSha256: t15.docxSha,
      pdfSha256: t15.pdfSha,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      approvalStatus: 'Approved',
      approvedBy: 'attacker_admin',
      approvedAt: null
    }, 'gcr-2026-k1');

    const t15Manifest = JSON.parse(fs.readFileSync(t15.manifestPath, 'utf-8'));
    t15Manifest.approval.status = 'Approved';
    t15Manifest.approval.approvedBy = 'attacker_admin';
    t15Manifest.tamperProtection.digitalSignature = legitimateApprovedSig;
    fs.writeFileSync(t15.manifestPath, JSON.stringify(t15Manifest, null, 2), 'utf-8');

    const t15Fetch = await getArchivedReport('88880015', 1, 'pdf', { username: 'auditor' });
    const t15Passed = t15Fetch.corrupted === true && t15Fetch.error === 'ARCHIVE_METADATA_INCONSISTENT';
    recordTest('5.3', 'Manifest vs DB Metadata Discrepancy Cross-Check', t15Passed, {
      corrupted: t15Fetch.corrupted,
      error: t15Fetch.error,
      message: t15Fetch.message
    });
    await ReportArchive.deleteOne({ caseId: '88880015', version: 1 });

  } finally {
    try { fs.rmSync(SANDBOX_DIR, { recursive: true, force: true }); } catch (_) {}
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log('REMEDIATION TEST SUITE SUMMARY');
  console.log('================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`FINAL RESULT: ${allPassed ? 'ALL 15 TESTS PASSED (100%)' : 'TESTS FAILED'}`);

  return { allPassed, results };
}

if (require.main === module) {
  runRemediationTests().then(res => {
    process.exit(res.allPassed ? 0 : 1);
  }).catch(err => {
    console.error('Fatal Remediation Test Error:', err);
    process.exit(1);
  });
}

module.exports = { runRemediationTests };
