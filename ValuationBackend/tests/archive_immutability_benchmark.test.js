const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiveService = require('../services/reportArchiveService');

describe('Phase 5 — Archive Protection & Immutability Benchmark Test Suite', () => {
  const baselinePath = path.resolve(__dirname, 'fixtures/frozen_archive_baseline.json');
  const reportsDir = path.resolve(__dirname, '../uploads/reports');

  let baseline;

  beforeAll(() => {
    expect(fs.existsSync(baselinePath)).toBe(true);
    baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  });

  test('1. All 4 historical report binaries exist and match frozen SHA-256 digests byte-for-byte', () => {
    for (const [filename, expected] of Object.entries(baseline.archives)) {
      const filePath = path.join(reportsDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const buffer = fs.readFileSync(filePath);
      expect(buffer.length).toBe(expected.sizeBytes);

      const actualSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(actualSha256).toBe(expected.sha256);
    }
  });

  test('2. Historical manifest v1 exists, matches expected metadata, and passes HMAC verification', () => {
    const v1Path = path.join(reportsDir, 'manifest_20261101_v1.json');
    expect(fs.existsSync(v1Path)).toBe(true);

    const manifestV1 = JSON.parse(fs.readFileSync(v1Path, 'utf8'));
    const expected = baseline.manifests['manifest_20261101_v1.json'];
    expect(manifestV1.tamperProtection.digitalSignature).toBe(expected.digitalSignature);

    const canonicalData = {
      caseId: String(manifestV1.caseId),
      version: Number(manifestV1.version),
      docxSha256: String(manifestV1.artifacts?.docx?.sha256 || ''),
      pdfSha256: String(manifestV1.artifacts?.pdf?.sha256 || ''),
      templateId: String(manifestV1.templateId || 'HOUSE_APGB_NEW_FORMAT'),
      approvalStatus: String(manifestV1.approval?.status || 'Pending'),
      approvedBy: String(manifestV1.approval?.approvedBy || ''),
      approvedAt: manifestV1.approval?.approvedAt || null
    };

    const isValid = archiveService.verifyArchiveManifest(canonicalData, manifestV1.tamperProtection.digitalSignature, null);
    expect(isValid).toBe(true);
  });

  test('3. Historical manifest v2 exists, matches expected metadata, and passes HMAC verification with Key ID', () => {
    const v2Path = path.join(reportsDir, 'manifest_20261101_v2.json');
    expect(fs.existsSync(v2Path)).toBe(true);

    const manifestV2 = JSON.parse(fs.readFileSync(v2Path, 'utf8'));
    const expected = baseline.manifests['manifest_20261101_v2.json'];
    expect(manifestV2.tamperProtection.digitalSignature).toBe(expected.digitalSignature);
    expect(manifestV2.tamperProtection.keyId).toBe(expected.keyId);

    const canonicalData = {
      caseId: String(manifestV2.caseId),
      version: Number(manifestV2.version),
      docxSha256: String(manifestV2.artifacts?.docx?.sha256 || ''),
      pdfSha256: String(manifestV2.artifacts?.pdf?.sha256 || ''),
      templateId: String(manifestV2.templateId || 'HOUSE_APGB_NEW_FORMAT'),
      approvalStatus: String(manifestV2.approval?.status || 'Pending'),
      approvedBy: String(manifestV2.approval?.approvedBy || ''),
      approvedAt: manifestV2.approval?.approvedAt || null
    };

    const isValid = archiveService.verifyArchiveManifest(canonicalData, manifestV2.tamperProtection.digitalSignature, manifestV2.tamperProtection.keyId);
    expect(isValid).toBe(true);
  });
});
