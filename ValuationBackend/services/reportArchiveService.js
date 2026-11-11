const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const ReportArchive = require('../models/ReportArchive');
const ValuationCaseVersion = require('../models/ValuationCaseVersion');
const { convertDocxToPdf } = require('./docxToPdfConverter');
const { config } = require('../config/env');

// Determine persistent storage root for reports
function getArchiveDirectory() {
  const dir = config.REPORT_ARCHIVE_DIRECTORY || path.join(__dirname, '..', 'uploads', 'reports');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Compute SHA-256 of file buffer
function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Retrieves the active cryptographic keyring containing current and historical verification keys.
 * Structure: { [keyId: string]: string }
 */
function getKeyring() {
  const keyring = {};

  // 1. Load explicit multi-key JSON keyring if configured (e.g. ARCHIVE_KEYRING='{"gcr-2026-k1":"...","gcr-2026-k2":"..."}')
  if (process.env.ARCHIVE_KEYRING) {
    try {
      const parsed = typeof process.env.ARCHIVE_KEYRING === 'string'
        ? JSON.parse(process.env.ARCHIVE_KEYRING)
        : process.env.ARCHIVE_KEYRING;
      Object.assign(keyring, parsed);
    } catch (err) {
      console.error('Failed to parse ARCHIVE_KEYRING JSON:', err.message);
    }
  }

  // 2. Primary signing key from environment
  const primaryKey = process.env.ARCHIVE_SIGNING_KEY;
  const primaryKeyId = process.env.ARCHIVE_SIGNING_KEY_ID || 'gcr-2026-k1';

  if (primaryKey) {
    keyring[primaryKeyId] = primaryKey;
  }

  return keyring;
}

/**
 * Returns the active signing key ID and secret.
 * FAILS SECURELY if no signing key is configured in the environment.
 */
function getActiveSigningKey() {
  const keyring = getKeyring();
  const primaryKeyId = process.env.ARCHIVE_SIGNING_KEY_ID || 'gcr-2026-k1';

  if (!keyring[primaryKeyId]) {
    throw new Error(`ARCHIVE_SECURITY_ERROR: Archive signing key '${primaryKeyId}' is not configured in the environment keyring. Hardcoded key fallback is strictly disabled.`);
  }

  return {
    keyId: primaryKeyId,
    secret: keyring[primaryKeyId]
  };
}

/**
 * Resolves a verification key by its keyId from the keyring.
 * Rejects unknown key IDs.
 */
function getVerificationKey(keyId) {
  const effectiveKeyId = keyId || process.env.ARCHIVE_SIGNING_KEY_ID || 'gcr-2026-k1';
  const keyring = getKeyring();

  if (!keyring[effectiveKeyId]) {
    throw new Error(`ARCHIVE_SECURITY_ERROR: Unknown key ID '${effectiveKeyId}'. Verification key not found in active keyring.`);
  }

  return keyring[effectiveKeyId];
}

/**
 * AWS KMS Asymmetric Signer Adapter (Prepared for Enterprise Cloud Deployment)
 */
class KmsSignerAdapter {
  constructor(kmsKeyArn) {
    this.kmsKeyArn = kmsKeyArn;
  }
  async sign(canonicalPayload) {
    throw new Error('KmsSignerAdapter: AWS KMS asymmetric signing interface prepared. KMS resources not yet provisioned in development environment.');
  }
  async verify(canonicalPayload, signature, publicKey) {
    throw new Error('KmsSignerAdapter: AWS KMS asymmetric verification interface prepared. KMS resources not yet provisioned in development environment.');
  }
}

/**
 * Computes a cryptographic HMAC-SHA256 digital signature over canonical archive metadata.
 */
function signArchiveManifest(canonicalData, explicitKeyId = null) {
  const active = explicitKeyId
    ? { keyId: explicitKeyId, secret: getVerificationKey(explicitKeyId) }
    : getActiveSigningKey();

  const canonicalString = [
    String(canonicalData.caseId),
    String(canonicalData.version),
    String(canonicalData.docxSha256),
    String(canonicalData.pdfSha256),
    String(canonicalData.templateId || 'HOUSE_APGB_NEW_FORMAT'),
    String(canonicalData.approvalStatus || 'Pending'),
    String(canonicalData.approvedBy || ''),
    canonicalData.approvedAt ? new Date(canonicalData.approvedAt).toISOString() : ''
  ].join('|');

  const digitalSignature = crypto.createHmac('sha256', active.secret).update(canonicalString).digest('hex');
  return digitalSignature;
}

/**
 * Verifies the cryptographic HMAC-SHA256 digital signature of a manifest.
 */
function verifyArchiveManifest(canonicalData, signature, keyId = null) {
  if (!signature || typeof signature !== 'string') {
    return false;
  }
  try {
    const secret = getVerificationKey(keyId);
    const canonicalString = [
      String(canonicalData.caseId),
      String(canonicalData.version),
      String(canonicalData.docxSha256),
      String(canonicalData.pdfSha256),
      String(canonicalData.templateId || 'HOUSE_APGB_NEW_FORMAT'),
      String(canonicalData.approvalStatus || 'Pending'),
      String(canonicalData.approvedBy || ''),
      canonicalData.approvedAt ? new Date(canonicalData.approvedAt).toISOString() : ''
    ].join('|');

    const expected = crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
    if (expected.length !== signature.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch (err) {
    return false;
  }
}

/**
 * Permanently archives original DOCX and PDF binaries for a submitted case version.
 */
async function archiveCaseReport(caseData, version, submitterInfo = {}) {
  const caseId = String(caseData.id);
  const vNum = parseInt(version, 10) || 1;

  // 1. Guard against duplicate archival attempts
  const existingArchive = await ReportArchive.findOne({ caseId, version: vNum });
  if (existingArchive) {
    return {
      success: true,
      alreadyArchived: true,
      archive: existingArchive
    };
  }

  const archiveDir = getArchiveDirectory();
  const permanentDocxName = `report_${caseId}_v${vNum}.docx`;
  const permanentPdfName = `report_${caseId}_v${vNum}.pdf`;
  const permanentDocxPath = path.join(archiveDir, permanentDocxName);
  const permanentPdfPath = path.join(archiveDir, permanentPdfName);

  // 2. Generate DOCX via python generator into isolated temp file
  const tempJsonPath = path.join('/tmp', `archive_src_${caseId}_v${vNum}_${Date.now()}.json`);
  const tempDocxPath = path.join('/tmp', `archive_out_${caseId}_v${vNum}_${Date.now()}.docx`);
  const tempPdfPath = path.join('/tmp', `archive_out_${caseId}_v${vNum}_${Date.now()}.pdf`);

  const { bankInfoForReport } = require('./banks');
  fs.writeFileSync(tempJsonPath, JSON.stringify(await bankInfoForReport(caseData), null, 2), 'utf-8');

  try {
    const scriptPath = path.join(__dirname, 'masterDocxGenerator.py');
    const pyResult = spawnSync('python3', [scriptPath, tempJsonPath, tempDocxPath]);
    try { fs.unlinkSync(tempJsonPath); } catch (_) {}

    if (pyResult.status !== 0 || !fs.existsSync(tempDocxPath)) {
      throw new Error(`Master DOCX generator failed: ${pyResult.stderr ? pyResult.stderr.toString() : 'Unknown error'}`);
    }

    // 3. Convert DOCX to PDF via LibreOffice
    await convertDocxToPdf(tempDocxPath, tempPdfPath);

    // 4. Read generated binaries and copy to permanent archival location
    const docxBuffer = fs.readFileSync(tempDocxPath);
    const pdfBuffer = fs.readFileSync(tempPdfPath);

    fs.writeFileSync(permanentDocxPath, docxBuffer);
    fs.writeFileSync(permanentPdfPath, pdfBuffer);

    // Clean up temporary files
    try { fs.unlinkSync(tempDocxPath); } catch (_) {}
    try { fs.unlinkSync(tempPdfPath); } catch (_) {}

    // 5. Compute cryptographic checksums
    const docxSha256 = computeSha256(docxBuffer);
    const pdfSha256 = computeSha256(pdfBuffer);

    // 5b. Generate and independently sign cryptographic archive manifest
    const permanentManifestName = `manifest_${caseId}_v${vNum}.json`;
    const permanentManifestPath = path.join(archiveDir, permanentManifestName);
    const generatedAt = new Date();
    const canonicalData = {
      caseId,
      version: vNum,
      docxSha256,
      pdfSha256,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      approvalStatus: 'Pending',
      approvedBy: '',
      approvedAt: null
    };
    const activeKey = getActiveSigningKey();
    const keyId = activeKey.keyId;
    const digitalSignature = signArchiveManifest(canonicalData, keyId);

    const manifestPayload = {
      archiveStandard: 'GCR_SEC_ARCHIVE_V1',
      caseId,
      version: vNum,
      generatedAt: generatedAt.toISOString(),
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      templateVersion: '1.0.0',
      bankName: caseData.bankName || 'State Bank of India',
      bankBranch: caseData.bankBranch || '',
      propertyType: caseData.propertyDetails?.propertyType || 'Independent House',
      artifacts: {
        docx: {
          filename: permanentDocxName,
          sha256: docxSha256,
          sizeBytes: docxBuffer.length
        },
        pdf: {
          filename: permanentPdfName,
          sha256: pdfSha256,
          sizeBytes: pdfBuffer.length
        }
      },
      approval: {
        status: 'Pending',
        approvedBy: null,
        approvedAt: null,
        decisionComment: null
      },
      tamperProtection: {
        algorithm: 'HMAC-SHA256',
        keyId,
        digitalSignature
      }
    };

    fs.writeFileSync(permanentManifestPath, JSON.stringify(manifestPayload, null, 2), 'utf-8');

    // 6. Persist ReportArchive metadata in MongoDB
    const reportArchive = await ReportArchive.create({
      caseId,
      version: vNum,
      docxStoragePath: permanentDocxPath,
      pdfStoragePath: permanentPdfPath,
      manifestStoragePath: permanentManifestPath,
      docxSha256,
      pdfSha256,
      digitalSignature,
      keyId,
      docxSizeBytes: docxBuffer.length,
      pdfSizeBytes: pdfBuffer.length,
      templateId: 'HOUSE_APGB_NEW_FORMAT',
      templateVersion: '1.0.0',
      generatedAt,
      submittedBy: submitterInfo.id || submitterInfo.username || 'ENGINEER',
      submittedByName: submitterInfo.name || submitterInfo.username || 'Field Engineer',
      bankName: caseData.bankName || 'State Bank of India',
      bankBranch: caseData.bankBranch || '',
      propertyType: caseData.propertyDetails?.propertyType || 'Independent House',
      approvalStatus: 'Pending',
      auditTrail: [{
        action: 'ARCHIVED',
        actor: submitterInfo.name || submitterInfo.username || 'ENGINEER',
        role: submitterInfo.role || 'ENGINEER',
        timestamp: new Date(),
        details: {
          docxSha256,
          pdfSha256,
          digitalSignature,
          keyId,
          docxSizeBytes: docxBuffer.length,
          pdfSizeBytes: pdfBuffer.length
        }
      }]
    });

    // 7. Update ValuationCaseVersion reportMetadata
    await ValuationCaseVersion.findOneAndUpdate(
      { caseId, version: vNum },
      {
        'reportMetadata.docxAvailable': true,
        'reportMetadata.pdfAvailable': true,
        'reportMetadata.lastGeneratedAt': new Date(),
        'reportMetadata.docxSha256': docxSha256,
        'reportMetadata.pdfSha256': pdfSha256
      }
    );

    return {
      success: true,
      alreadyArchived: false,
      archive: reportArchive
    };
  } catch (err) {
    // Clean up any temp or partial files on failure
    try { fs.unlinkSync(tempJsonPath); } catch (_) {}
    try { fs.unlinkSync(tempDocxPath); } catch (_) {}
    try { fs.unlinkSync(tempPdfPath); } catch (_) {}
    throw err;
  }
}

/**
 * Retrieves an archived report binary with strict cryptographic SHA-256 verification.
 */
async function getArchivedReport(caseId, version, format = 'pdf', actorInfo = {}) {
  const vNum = parseInt(version, 10);
  const archive = await ReportArchive.findOne({ caseId: String(caseId), version: vNum });

  if (!archive) {
    return {
      found: false,
      error: 'ARCHIVE_NOT_FOUND',
      message: `Historical report archive not found for Case #${caseId} Version ${vNum}.`
    };
  }

  const isPdf = format.toLowerCase() === 'pdf';
  const targetPath = isPdf ? archive.pdfStoragePath : archive.docxStoragePath;
  const expectedSha256 = isPdf ? archive.pdfSha256 : archive.docxSha256;

  // 1. File existence check
  if (!fs.existsSync(targetPath)) {
    archive.auditTrail.push({
      action: 'INTEGRITY_FAILED',
      actor: actorInfo.username || 'ANONYMOUS',
      role: actorInfo.role || '',
      timestamp: new Date(),
      details: { reason: 'MISSING_FILE', targetPath, format }
    });
    await archive.save();

    return {
      found: true,
      corrupted: true,
      error: 'ARCHIVE_FILE_MISSING',
      message: `The archived ${format.toUpperCase()} report file is missing from permanent storage: ${path.basename(targetPath)}.`
    };
  }

  // 2. Read file and compute hash
  const buffer = fs.readFileSync(targetPath);
  const computedSha256 = computeSha256(buffer);

  // 3. Cryptographic checksum verification
  if (computedSha256 !== expectedSha256) {
    archive.auditTrail.push({
      action: 'INTEGRITY_FAILED',
      actor: actorInfo.username || 'ANONYMOUS',
      role: actorInfo.role || '',
      timestamp: new Date(),
      details: {
        reason: 'CHECKSUM_MISMATCH',
        expected: expectedSha256,
        actual: computedSha256,
        format
      }
    });
    await archive.save();

    return {
      found: true,
      corrupted: true,
      error: 'ARCHIVE_FILE_CORRUPTED',
      message: `Security violation: The archived ${format.toUpperCase()} report failed cryptographic SHA-256 verification. Expected: ${expectedSha256}, Actual: ${computedSha256}.`
    };
  }

  // 3b. Independent Manifest Verification & Metadata Cross-Check (F-01 Remediation)
  if (archive.manifestStoragePath) {
    // 3b.1 Check manifest physical file existence
    if (!fs.existsSync(archive.manifestStoragePath)) {
      archive.auditTrail.push({
        action: 'INTEGRITY_FAILED',
        actor: actorInfo.username || 'ANONYMOUS',
        role: actorInfo.role || '',
        timestamp: new Date(),
        details: {
          reason: 'MANIFEST_FILE_MISSING',
          manifestPath: archive.manifestStoragePath
        }
      });
      await archive.save();

      return {
        found: true,
        corrupted: true,
        error: 'ARCHIVE_MANIFEST_MISSING',
        message: `Security violation: Independent cryptographic manifest file is missing from permanent storage.`
      };
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(archive.manifestStoragePath, 'utf-8'));
    } catch (parseErr) {
      archive.auditTrail.push({
        action: 'INTEGRITY_FAILED',
        actor: actorInfo.username || 'ANONYMOUS',
        role: actorInfo.role || '',
        timestamp: new Date(),
        details: {
          reason: 'MANIFEST_PARSE_ERROR',
          error: parseErr.message
        }
      });
      await archive.save();

      return {
        found: true,
        corrupted: true,
        error: 'ARCHIVE_MANIFEST_CORRUPTED',
        message: `Security violation: Independent cryptographic manifest file is unreadable or malformed JSON.`
      };
    }

    // 3b.2 Validate manifest structure
    if (!manifest || !manifest.caseId || manifest.version === undefined || !manifest.artifacts || !manifest.tamperProtection) {
      archive.auditTrail.push({
        action: 'INTEGRITY_FAILED',
        actor: actorInfo.username || 'ANONYMOUS',
        role: actorInfo.role || '',
        timestamp: new Date(),
        details: { reason: 'MANIFEST_STRUCTURE_INVALID' }
      });
      await archive.save();

      return {
        found: true,
        corrupted: true,
        error: 'ARCHIVE_MANIFEST_MALFORMED',
        message: `Security violation: Independent cryptographic manifest has an invalid or incomplete schema structure.`
      };
    }

    // 3b.3 Resolve Key ID from manifest or archive
    const manifestKeyId = manifest.tamperProtection?.keyId || archive.keyId || 'gcr-2026-k1';
    try {
      getVerificationKey(manifestKeyId);
    } catch (keyErr) {
      archive.auditTrail.push({
        action: 'INTEGRITY_FAILED',
        actor: actorInfo.username || 'ANONYMOUS',
        role: actorInfo.role || '',
        timestamp: new Date(),
        details: {
          reason: 'UNKNOWN_SIGNING_KEY_ID',
          keyId: manifestKeyId
        }
      });
      await archive.save();

      return {
        found: true,
        corrupted: true,
        error: 'ARCHIVE_KEY_UNKNOWN',
        message: `Security violation: Manifest references an unknown or revoked signing key ID: '${manifestKeyId}'.`
      };
    }

    // 3b.4 Construct canonical signing data FROM THE MANIFEST CONTENTS ITSELF
    const manifestCanonicalData = {
      caseId: String(manifest.caseId),
      version: Number(manifest.version),
      docxSha256: String(manifest.artifacts?.docx?.sha256 || ''),
      pdfSha256: String(manifest.artifacts?.pdf?.sha256 || ''),
      templateId: String(manifest.templateId || 'HOUSE_APGB_NEW_FORMAT'),
      approvalStatus: String(manifest.approval?.status || 'Pending'),
      approvedBy: String(manifest.approval?.approvedBy || ''),
      approvedAt: manifest.approval?.approvedAt || null
    };

    const signatureToVerify = manifest.tamperProtection?.digitalSignature;
    const isManifestSignatureValid = verifyArchiveManifest(manifestCanonicalData, signatureToVerify, manifestKeyId);

    if (!isManifestSignatureValid) {
      archive.auditTrail.push({
        action: 'INTEGRITY_FAILED',
        actor: actorInfo.username || 'ANONYMOUS',
        role: actorInfo.role || '',
        timestamp: new Date(),
        details: {
          reason: 'MANIFEST_SIGNATURE_INVALID',
          keyId: manifestKeyId,
          manifestPath: archive.manifestStoragePath
        }
      });
      await archive.save();

      return {
        found: true,
        corrupted: true,
        error: 'ARCHIVE_MANIFEST_TAMPERED',
        message: `Security violation: Independent cryptographic manifest failed digital signature verification. Contents have been modified or forged.`
      };
    }

    // 3b.5 Cross-check manifest metadata against MongoDB archive record
    const discrepancies = [];
    if (String(manifest.caseId) !== String(archive.caseId)) discrepancies.push(`caseId (manifest: ${manifest.caseId}, db: ${archive.caseId})`);
    if (Number(manifest.version) !== Number(archive.version)) discrepancies.push(`version (manifest: ${manifest.version}, db: ${archive.version})`);
    if (String(manifest.artifacts?.docx?.sha256) !== String(archive.docxSha256)) discrepancies.push('docxSha256');
    if (String(manifest.artifacts?.pdf?.sha256) !== String(archive.pdfSha256)) discrepancies.push('pdfSha256');
    if (String(manifest.approval?.status || 'Pending') !== String(archive.approvalStatus || 'Pending')) discrepancies.push(`approvalStatus (manifest: ${manifest.approval?.status}, db: ${archive.approvalStatus})`);
    if (String(manifest.approval?.approvedBy || '') !== String(archive.approvedBy || '')) discrepancies.push(`approvedBy (manifest: ${manifest.approval?.approvedBy}, db: ${archive.approvedBy})`);
    if (manifest.tamperProtection?.digitalSignature !== archive.digitalSignature) discrepancies.push('digitalSignature');

    if (discrepancies.length > 0) {
      archive.auditTrail.push({
        action: 'INTEGRITY_FAILED',
        actor: actorInfo.username || 'ANONYMOUS',
        role: actorInfo.role || '',
        timestamp: new Date(),
        details: {
          reason: 'METADATA_CROSS_CHECK_FAILED',
          discrepancies
        }
      });
      await archive.save();

      return {
        found: true,
        corrupted: true,
        error: 'ARCHIVE_METADATA_INCONSISTENT',
        message: `Security violation: Manifest metadata does not match database archive record. Inconsistencies detected in: ${discrepancies.join(', ')}.`
      };
    }

    // 3b.6 Verify physical binary SHA-256 against manifest recorded hash
    const expectedManifestHash = isPdf ? manifest.artifacts?.pdf?.sha256 : manifest.artifacts?.docx?.sha256;
    if (computedSha256 !== expectedManifestHash) {
      archive.auditTrail.push({
        action: 'INTEGRITY_FAILED',
        actor: actorInfo.username || 'ANONYMOUS',
        role: actorInfo.role || '',
        timestamp: new Date(),
        details: {
          reason: 'BINARY_MANIFEST_HASH_MISMATCH',
          expected: expectedManifestHash,
          actual: computedSha256
        }
      });
      await archive.save();

      return {
        found: true,
        corrupted: true,
        error: 'ARCHIVE_FILE_CORRUPTED',
        message: `Security violation: Physical file SHA-256 hash does not match manifest recorded hash.`
      };
    }
  }

  // 4. Log verified audit events
  archive.auditTrail.push({
    action: 'CHECKSUM_VERIFIED',
    actor: actorInfo.username || 'ANONYMOUS',
    role: actorInfo.role || '',
    timestamp: new Date(),
    details: { format, sha256: computedSha256 }
  });
  archive.auditTrail.push({
    action: 'DOWNLOADED',
    actor: actorInfo.username || 'ANONYMOUS',
    role: actorInfo.role || '',
    timestamp: new Date(),
    details: { format, version: vNum }
  });
  await archive.save();

  const safeBankName = (archive.bankName || 'Valuation').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeBankName}_Valuation_Report_${caseId}_v${vNum}.${isPdf ? 'pdf' : 'docx'}`;
  const mimeType = isPdf
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return {
    found: true,
    corrupted: false,
    buffer,
    filename,
    sha256: computedSha256,
    mimeType
  };
}

/**
 * Updates archive status upon Super Admin decision (Approval or Return).
 */
async function recordArchiveDecision(caseId, version, decision, adminInfo = {}, comment = '') {
  const vNum = parseInt(version, 10);
  const archive = await ReportArchive.findOne({ caseId: String(caseId), version: vNum });

  if (!archive) {
    return null;
  }

  archive.approvalStatus = decision;
  archive.approvedBy = adminInfo.name || adminInfo.username || 'Super Admin';
  archive.approvedAt = new Date();
  if (comment) {
    archive.decisionComment = comment;
  }

  // Re-compute cryptographic signature incorporating approval metadata
  const canonicalData = {
    caseId: archive.caseId,
    version: archive.version,
    docxSha256: archive.docxSha256,
    pdfSha256: archive.pdfSha256,
    templateId: archive.templateId || 'HOUSE_APGB_NEW_FORMAT',
    approvalStatus: archive.approvalStatus,
    approvedBy: archive.approvedBy,
    approvedAt: archive.approvedAt
  };
  const activeKey = getActiveSigningKey();
  const keyId = activeKey.keyId;
  const digitalSignature = signArchiveManifest(canonicalData, keyId);
  archive.digitalSignature = digitalSignature;
  archive.keyId = keyId;

  // Synchronize disk manifest if present
  if (archive.manifestStoragePath && fs.existsSync(archive.manifestStoragePath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(archive.manifestStoragePath, 'utf-8'));
      manifest.approval = {
        status: archive.approvalStatus,
        approvedBy: archive.approvedBy,
        approvedAt: archive.approvedAt.toISOString(),
        decisionComment: archive.decisionComment || null
      };
      manifest.tamperProtection = {
        algorithm: 'HMAC-SHA256',
        keyId,
        digitalSignature
      };
      fs.writeFileSync(archive.manifestStoragePath, JSON.stringify(manifest, null, 2), 'utf-8');
    } catch (manifestErr) {
      console.error('Error synchronizing manifest file on decision:', manifestErr);
    }
  }

  archive.auditTrail.push({
    action: decision.toUpperCase() === 'APPROVED' ? 'APPROVED' : 'RETURNED',
    actor: adminInfo.name || adminInfo.username || 'Super Admin',
    role: adminInfo.role || 'SUPER_ADMIN',
    timestamp: new Date(),
    details: {
      comment: comment || '',
      digitalSignature,
      keyId,
      docxSha256: archive.docxSha256,
      pdfSha256: archive.pdfSha256
    }
  });

  await archive.save();
  return archive;
}

module.exports = {
  getArchiveDirectory,
  computeSha256,
  archiveCaseReport,
  getArchivedReport,
  recordArchiveDecision,
  signArchiveManifest,
  verifyArchiveManifest,
  getKeyring,
  getActiveSigningKey,
  getVerificationKey,
  getSigningKey: () => getActiveSigningKey().secret,
  KmsSignerAdapter
};
