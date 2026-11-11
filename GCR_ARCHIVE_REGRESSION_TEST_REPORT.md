# GCR — ARCHIVE SECURITY & INTEGRITY REGRESSION TEST REPORT
**Document ID:** `GCR_ARCHIVE_REGRESSION_TEST_REPORT.md`  
**Phase:** 3.5.5.2 — Critical Security Remediation & Cryptographic Verification  
**Role:** Principal Application Security Engineer, Cryptographic Systems Architect, and Banking Records Security Specialist  
**Test Execution Date:** November 4, 2026  
**Status:** 100% PASS ACROSS ALL 53 EMPIRICAL TESTS  

---

## 1. Executive Summary

This report delivers the comprehensive empirical test evidence for Phase 3.5.5.2, validating the complete remediation of:
- **Finding F-01:** Manifest self-verification and database cross-checking.
- **Finding F-02:** Elimination of hardcoded signing-secret fallback strings and fail-secure operation.
- **Finding F-03:** Versioned keyring resolution, historical archive verification across key rotations, and unknown key rejection.

A total of **53 rigorous tests** across 4 distinct regression suites were executed in isolated test sandboxes. Every test was conducted against live binaries, live MongoDB documents, and cryptographic HMAC-SHA256 calculations. **Zero tests failed (100% pass rate).**

---

## 2. Phase 3.5.5.2 Primary Remediation Test Suite (`test_phase_3_5_5_2_remediation.js`)

Sandbox: `/tmp/gcr_remediation_test_sandbox_1793782203658`  
Total Tests: 15 | Passed: 15 | Failed: 0 (100% Pass)

### 2.1 F-01 Manifest Self-Verification & Cryptographic Tamper Tests

#### Test 1.1: Manifest Approval-Status Modification Detection (F-01 Mandatory Test)
- **Objective:** Verify that changing the manifest `approval.status` on disk from `Pending` to `Approved` while keeping the original signature causes `getArchivedReport()` to reject delivery.
- **Procedure:**
  1. Create an isolated copy of genuine archive `20261101 v1` and its manifest.
  2. Parse the manifest JSON on disk and modify `manifest.approval.status = 'Approved'` without updating `digitalSignature`.
  3. Call `getArchivedReport('20261101', 1, 'pdf', { storageDir, skipAuditTrail: true })`.
- **Expected Result:** Cryptographic verification fails. `getArchivedReport` returns `corrupted: true`, `error: 'ARCHIVE_MANIFEST_TAMPERED'`, report delivery is rejected.
- **Actual Result:** Delivery rejected with `ARCHIVE_MANIFEST_TAMPERED`.
  ```json
  {
    "corrupted": true,
    "error": "ARCHIVE_MANIFEST_TAMPERED",
    "message": "Security violation: Independent cryptographic manifest failed digital signature verification. Contents have been modified or forged."
  }
  ```
- **Status:** **PASS**

#### Test 1.2: Manifest Case-ID Modification Detection
- **Objective:** Verify that tampering with `manifest.caseId` on disk is detected and rejected.
- **Procedure:** Modify `manifest.caseId = '99999999'` in test manifest while preserving original signature; call `getArchivedReport`.
- **Expected Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Actual Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Status:** **PASS**

#### Test 1.3: Manifest Version Modification Detection
- **Objective:** Verify that tampering with `manifest.version` on disk is detected and rejected.
- **Procedure:** Modify `manifest.version = 99` in test manifest while preserving original signature; call `getArchivedReport`.
- **Expected Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Actual Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Status:** **PASS**

#### Test 1.4: Manifest Artifact Hash Modification Detection
- **Objective:** Verify that altering recorded binary checksums in `manifest.artifacts.pdf.sha256` is detected.
- **Procedure:** Set `manifest.artifacts.pdf.sha256 = '0000000000000000000000000000000000000000000000000000000000000000'`; call `getArchivedReport`.
- **Expected Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Actual Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Status:** **PASS**

#### Test 1.5: Forged Manifest Signature Rejection
- **Objective:** Verify that an invalid or arbitrary signature string is rejected by `verifyArchiveManifest`.
- **Procedure:** Set `manifest.tamperProtection.digitalSignature = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'`; call `getArchivedReport`.
- **Expected Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Actual Result:** Rejected with `ARCHIVE_MANIFEST_TAMPERED`.
- **Status:** **PASS**

---

### 2.2 F-02 Hardcoded Secret Removal & Fail-Secure Tests

#### Test 2.1: Missing Signing Key Fail-Secure Rejection
- **Objective:** Verify that if `ARCHIVE_SIGNING_KEY` and `ARCHIVE_KEYRING` are missing from the environment, the system fails securely instead of falling back to a hardcoded default string.
- **Procedure:**
  1. Temporarily delete `ARCHIVE_SIGNING_KEY` and `ARCHIVE_KEYRING` from `process.env`.
  2. Invoke `getActiveSigningKey()`.
- **Expected Result:** Throws `ARCHIVE_SECURITY_ERROR`. No fallback string used.
- **Actual Result:** Throws fatal security error:
  `ARCHIVE_SECURITY_ERROR: Archive signing key 'gcr-2026-k1' is not configured in the environment keyring. Hardcoded key fallback is strictly disabled.`
- **Status:** **PASS**

---

### 2.3 F-03 Keyring Resolution & Key Rotation Tests

#### Test 3.1: Unknown or Revoked Key ID Rejection
- **Objective:** Verify that a manifest referencing an unknown `keyId` is rejected without verification attempts.
- **Procedure:**
  1. Construct manifest with `tamperProtection.keyId = 'gcr-unknown-revoked-k99'`.
  2. Sign with dummy secret and call `getArchivedReport`.
- **Expected Result:** Rejected with `ARCHIVE_KEY_UNKNOWN`.
- **Actual Result:** Rejected with `ARCHIVE_KEY_UNKNOWN`:
  `Security violation: Manifest references an unknown or revoked signing key ID: 'gcr-unknown-revoked-k99'.`
- **Status:** **PASS**

#### Test 3.2: Historical Key Verification from Multi-Key Keyring
- **Objective:** Verify that when the active signing key is rotated to `gcr-2026-k2`, historical archives signed with `gcr-2026-k1` remain verifiable via the historical keyring.
- **Procedure:**
  1. Configure `ARCHIVE_KEYRING = JSON.stringify({ "gcr-2026-k1": historicalSecret })`.
  2. Set active key `ARCHIVE_SIGNING_KEY_ID = 'gcr-2026-k2'`, `ARCHIVE_SIGNING_KEY = newSecret`.
  3. Call `getArchivedReport` for a historical report signed with `gcr-2026-k1`.
- **Expected Result:** Resolves historical key `gcr-2026-k1` from keyring; returns `found: true, corrupted: false`.
- **Actual Result:** Historical report successfully verified and delivered using historical key without modifying binaries or re-signing.
- **Status:** **PASS**

#### Test 3.3: Controlled Key Rotation (New Reports Sign with New Key)
- **Objective:** Verify that newly created archives automatically receive the rotated active key ID.
- **Procedure:**
  1. With `ARCHIVE_SIGNING_KEY_ID = 'gcr-2026-k2'`, call `archiveCaseReport` for a test case.
  2. Inspect the created manifest on disk and call `getArchivedReport`.
- **Expected Result:** Manifest contains `tamperProtection.keyId: 'gcr-2026-k2'`; retrieval verifies successfully.
- **Actual Result:** Manifest created with `keyId: 'gcr-2026-k2'`; verified successfully.
- **Status:** **PASS**

---

### 2.4 Binary Integrity & Replacement Tests

#### Test 4.1: DOCX Binary 1-Byte Corruption Detection
- **Objective:** Verify that flipping 1 byte in the physical DOCX file on disk causes retrieval to halt with `ARCHIVE_FILE_CORRUPTED`.
- **Procedure:** Flip byte 100 in `report_20261101_v1.docx`; request DOCX via `getArchivedReport`.
- **Expected Result:** Hash mismatch detected; returns `corrupted: true`, `error: 'ARCHIVE_FILE_CORRUPTED'`.
- **Actual Result:** Returned `ARCHIVE_FILE_CORRUPTED`.
- **Status:** **PASS**

#### Test 4.2: PDF Binary 1-Byte Corruption Detection
- **Objective:** Verify that flipping 1 byte in the physical PDF file on disk causes retrieval to halt with `ARCHIVE_FILE_CORRUPTED`.
- **Procedure:** Flip byte 100 in `report_20261101_v1.pdf`; request PDF via `getArchivedReport`.
- **Expected Result:** Hash mismatch detected; returns `corrupted: true`, `error: 'ARCHIVE_FILE_CORRUPTED'`.
- **Actual Result:** Returned `ARCHIVE_FILE_CORRUPTED`.
- **Status:** **PASS**

#### Test 4.3: Unauthorized Archive Replacement Detection
- **Objective:** Verify that replacing the report binary with an arbitrary foreign PDF file halts delivery.
- **Procedure:** Overwrite `report_20261101_v1.pdf` with a foreign 32-byte PDF buffer; call `getArchivedReport`.
- **Expected Result:** Rejected with `ARCHIVE_FILE_CORRUPTED`.
- **Actual Result:** Rejected with `ARCHIVE_FILE_CORRUPTED`.
- **Status:** **PASS**

---

### 2.5 Approval & Data Preservation Integrity Tests

#### Test 5.1: Historical Version Retrieval Without Regeneration
- **Objective:** Verify that both Version 1 and Version 2 are retrieved with their exact historical SHA-256 checksums without invoking template generation.
- **Procedure:**
  1. Retrieve Version 1 PDF via `getArchivedReport('20261101', 1, 'pdf')`.
  2. Retrieve Version 2 PDF via `getArchivedReport('20261101', 2, 'pdf')`.
  3. Compare checksums to known historical inventory.
- **Expected Result:** Exact historical checksums match; no generator invocation.
- **Actual Result:**
  - V1 PDF SHA-256: `5c4cc8c68efdcfe2b73b68f067bcd449de547da02f70b8b5f1a2b76ecbdfaa23` (MATCH)
  - V2 PDF SHA-256: `6bb83e92e71cb03264744218546395900dcb152d99ed74c22bcd5bb050c94c0f` (MATCH)
- **Status:** **PASS**

#### Test 5.2: Approval-to-Binary Binding Verification
- **Objective:** Verify that approval metadata is tightly bound to exact binary hashes and signed in the manifest.
- **Procedure:** Inspect genuine manifest `manifest_20261101_v2.json`. Verify presence of `approval.status = 'Approved'`, `approval.approvedBy = 'admin'`, and artifact hashes.
- **Expected Result:** All fields signed under `tamperProtection.digitalSignature`.
- **Actual Result:** Signed binding verified bit-for-bit.
- **Status:** **PASS**

#### Test 5.3: Manifest vs Database Metadata Cross-Check
- **Objective:** Verify that if an attacker modifies the manifest on disk and re-signs it with a compromised key, the database cross-check catches the discrepancy against the official MongoDB `ReportArchive` document.
- **Procedure:**
  1. Construct a manifest where `approval.status = 'Approved'` and `approvedBy = 'attacker_admin'`, while the database record remains `approvalStatus = 'Pending'`.
  2. Generate a valid HMAC signature over this forged manifest.
  3. Call `getArchivedReport()`.
- **Expected Result:** Manifest signature is mathematically valid, but database cross-check detects discrepancies and rejects with `ARCHIVE_METADATA_INCONSISTENT`.
- **Actual Result:** Caught and rejected:
  `Security violation: Manifest metadata does not match database archive record. Inconsistencies detected in: approvalStatus (manifest: Approved, db: Pending), approvedBy (manifest: attacker_admin, db: null), digitalSignature.`
- **Status:** **PASS**

---

## 3. Independent Security Audit Suite (`audit_phase_3_5_5_1_suite.js`)

Sandbox: `/tmp/gcr_audit_3_5_5_1_sandbox_1793782218633`  
Total Audits: 21 | Passed: 21 | Failed: 0 (100% Pass)

| Audit ID | Audit Name | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **AUDIT 1.1** | HMAC Valid Signature Verification | Mathematical verification passes | Hex length 64, verified valid | **PASS** |
| **AUDIT 1.2** | HMAC Missing/Empty Signature Rejection | Immediate rejection | Empty signature rejected | **PASS** |
| **AUDIT 1.3** | HMAC Forged/Tampered Signature Rejection | Immediate rejection | Altered payload rejected | **PASS** |
| **AUDIT 1.4** | HMAC Key Rotation Isolation | Key mismatch rejected | Mismatch caught | **PASS** |
| **AUDIT 2.1** | Baseline Genuine Fetch Integrity | Delivery successful | `baselineOk: true` | **PASS** |
| **AUDIT 2.2** | DOCX 1-Byte Modification Detection | Halts with `ARCHIVE_FILE_CORRUPTED` | `ARCHIVE_FILE_CORRUPTED` detected | **PASS** |
| **AUDIT 2.3** | PDF 1-Byte Modification Detection | Halts with `ARCHIVE_FILE_CORRUPTED` | `ARCHIVE_FILE_CORRUPTED` detected | **PASS** |
| **AUDIT 2.4** | Manifest Field Modification Detection | **Halts with `ARCHIVE_MANIFEST_TAMPERED` (F-01)** | **`ARCHIVE_MANIFEST_TAMPERED` detected** | **PASS** |
| **AUDIT 2.5** | Manifest Signature Replacement Detection | Halts with `ARCHIVE_MANIFEST_TAMPERED` | `ARCHIVE_MANIFEST_TAMPERED` detected | **PASS** |
| **AUDIT 2.6** | Report + Manifest Dual Replacement | Halts with corruption alarm | `ARCHIVE_FILE_CORRUPTED` detected | **PASS** |
| **AUDIT 2.7** | Unauthorized Deletion Detection | Halts with `ARCHIVE_FILE_MISSING` | `ARCHIVE_FILE_MISSING` detected | **PASS** |
| **AUDIT 3.1** | Application Restart Recovery | Checksums match across restart | DOCX & PDF checksums match | **PASS** |
| **AUDIT 3.2** | Container Replacement Recovery | Checksums match new container | Hashes identical across containers | **PASS** |
| **AUDIT 3.3** | Persistent Volume Remount | Files preserved across remount | Volume preserved | **PASS** |
| **AUDIT 3.4** | Database Metadata Restoration | All fields match restored DB | Complete metadata match | **PASS** |
| **AUDIT 3.5** | Archive Files & Manifest Restoration | Exact bytes restored | All bytes and hashes match | **PASS** |
| **AUDIT 4.1** | Distinct Version Approval Segregation | V1 Pending, V2 Approved | State segregation verified | **PASS** |
| **AUDIT 4.2** | Approved Binaries Hash Match | Database matches disk hashes | Exact hash match | **PASS** |
| **AUDIT 4.3** | Returned V1 Immutability After V2 | V1 remains unchanged | V1 hashes 100% identical | **PASS** |
| **AUDIT 4.4** | Duplicate Version Creation Rejection | MongoDB E11000 duplicate key error | Duplicate creation blocked | **PASS** |
| **AUDIT 4.5** | Concurrent Duplicate Submissions Safety | One succeeds, one rejected | Concurrency safety verified | **PASS** |

*Note on Audit 2.4:* In Phase 3.5.5.1, Audit 2.4 failed because `getArchivedReport` previously relied on database values for canonical payload creation. In Phase 3.5.5.2, Audit 2.4 now passes cleanly with `ARCHIVE_MANIFEST_TAMPERED`.

---

## 4. Isolated Storage Durability & Recovery Suite (`test_phase_3_5_5_recovery.js`)

Sandbox: `/tmp/gcr_phase_3_5_5_recovery_test_1793782229766`  
Total Tests: 7 | Passed: 7 | Failed: 0 (100% Pass)

| Test ID | Test Scenario | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **REC-01** | Application Restart Preservation | Archives preserved across restart | Checksums unchanged before/after | **PASS** |
| **REC-02** | Deployment Replacement Preservation | Ephemeral destroyed, PV intact | Checksums identical in new container | **PASS** |
| **REC-03** | Database Recovery Metadata Preservation | All fields, signatures & audit trail restored | Case 20261101 v2 restored with 21 audit logs | **PASS** |
| **REC-04** | Storage Recovery Exact Binaries | Bit-for-bit match on restored binaries | DOCX (3,369,735 B) & PDF (1,557,926 B) identical | **PASS** |
| **REC-05** | SHA-256 Checksums Match Post-Recovery | Cryptographic equality verified | Both DOCX and PDF SHA-256 match | **PASS** |
| **REC-06** | Unauthorized Archive Replacement Detection | Delivery halted on file or manifest tamper | `ARCHIVE_FILE_CORRUPTED` & `ARCHIVE_MANIFEST_TAMPERED` | **PASS** |
| **REC-07** | Storage Retention & Deletion Alerting | Missing file halts and logs alert | Explicit `ARCHIVE_FILE_MISSING` alert | **PASS** |

---

## 5. Mandatory Archival Verification Suite (`test_phase_3_5_4_archival.js`)

Total Tests: 10 | Passed: 10 | Failed: 0 (100% Pass)

| Test ID | Test Scenario | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **ARCH-01** | Permanent DOCX & PDF Archival | Both binaries preserved on persistent volume | V1 and V2 DOCX & PDF permanently stored | **PASS** |
| **ARCH-02** | Cryptographic SHA-256 Verification | Database checksums match disk binaries | Bit-identical match verified | **PASS** |
| **ARCH-03** | Historical Binary Retrieval | Retrieved without regeneration | Checksums and filenames verified | **PASS** |
| **ARCH-04** | V1 Immutability After V2 Creation | V1 hashes remain identical | V1 hash unchanged after V2 | **PASS** |
| **ARCH-05** | Approved Report Overwrite Protection | Overwrite attempt rejected | Overwrite blocked, original preserved | **PASS** |
| **ARCH-06** | Unauthorized Deletion Protection | MongoDB archive count preserved | Protected from unauthorized deletion | **PASS** |
| **ARCH-07** | Missing File Halts Delivery | Returns `ARCHIVE_FILE_MISSING` and logs event | Logged `INTEGRITY_FAILED (MISSING_FILE)` | **PASS** |
| **ARCH-08** | Corrupted File Checksum Alert | Returns `ARCHIVE_FILE_CORRUPTED` and logs event | Logged `INTEGRITY_FAILED (CHECKSUM_MISMATCH)` | **PASS** |
| **ARCH-09** | Concurrent Duplicate Submission Safety | MongoDB compound unique index rejects dups | E11000 duplicate key error enforced | **PASS** |
| **ARCH-10** | Database & Storage Recovery | All active archives restored and verifiable | 2 active archives verified | **PASS** |

---

## 6. Comprehensive Summary Table

| Test Suite | Total Executed | Passed | Failed | Pass Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Phase 3.5.5.2 Remediation Suite** (`test_phase_3_5_5_2_remediation.js`) | 15 | 15 | 0 | **100%** |
| **Phase 3.5.5.1 Security Audit Suite** (`audit_phase_3_5_5_1_suite.js`) | 21 | 21 | 0 | **100%** |
| **Phase 3.5.5 Isolated Recovery Suite** (`test_phase_3_5_5_recovery.js`) | 7 | 7 | 0 | **100%** |
| **Phase 3.5.4 Archival Suite** (`test_phase_3_5_4_archival.js`) | 10 | 10 | 0 | **100%** |
| **OVERALL TOTAL** | **53** | **53** | **0** | **100%** |

---

## 7. QA & Security Verdict

Every requirement of Phase 3.5.5.2 has been empirically proven through automated regression testing:
1. **Manifest Self-Verification:** Manifest tamper detection is active and mathematically airtight.
2. **Fail-Secure Key Management:** Missing signing keys fail immediately with zero fallback.
3. **Keyring Support:** Key rotation operates smoothly without invalidating historical reports.
4. **Historical Immutability:** Historical binaries and classifications are 100% preserved.

**FINAL STATUS: PASS (100% COMPLIANT)**
