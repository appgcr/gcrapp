# GCR — ISOLATED STORAGE DURABILITY & RECOVERY TEST REPORT
**Document ID:** `GCR_STORAGE_RECOVERY_TEST.md`  
**Phase:** 3.5.5 — Production Storage Durability & Audit Integrity  
**Role:** Principal Cloud Storage Architect, Banking Records Security Engineer, and Database Reliability Specialist  
**Status:** 100% PASSED (7 OF 7 TESTS EXECUTED IN ISOLATED SANDBOX)  
**Date:** November 4, 2026  

---

## 1. Executive Summary

To validate storage resilience, disaster recovery procedures, and tamper detection without endangering live case records, an isolated, non-destructive test suite was engineered in `ValuationBackend/tests/test_phase_3_5_5_recovery.js`.

The test suite executed inside a sandboxed temporary volume (`/tmp/gcr_phase_3_5_5_recovery_test_1793776332026`) against the live MongoDB instance on port 62884. All 7 mandatory recovery scenarios completed with **100% PASS** and zero failures.

---

## 2. Test Execution Environment & Parameters

- **Test Runner**: Node.js v20+ runtime  
- **Test File**: `ValuationBackend/tests/test_phase_3_5_5_recovery.js`  
- **Sandbox Root**: `/tmp/gcr_phase_3_5_5_recovery_test_1793776332026`  
- **Live Database URI**: `mongodb://127.0.0.1:62884/test`  
- **Cryptographic Algorithms**: SHA-256 (Hashing), HMAC-SHA256 (Manifest Signing)  
- **Target Live Case Evaluated**: Case `20261101` Version `2` (Approved)  
- **Execution Date/Time**: 2026-11-04T12:42:12+05:30  

---

## 3. Detailed Results for All 7 Recovery Tests

### Test 1: Application Restart Preserves Archives
- **Objective**: Verify that terminating and restarting the application process does not alter or erase archived report binaries on persistent storage.
- **Methodology**: Wrote sample binaries to an isolated volume, computed SHA-256 hashes, simulated complete process termination and cold restart, and re-read the binaries from storage.
- **Empirical Evidence**:
  - `docxHashBefore`: `49315259fc48515351509175218828399a6b5059e144251b2f779f4e33a5d262`
  - `docxHashAfter`:  `49315259fc48515351509175218828399a6b5059e144251b2f779f4e33a5d262` (MATCH)
  - `pdfHashBefore`:  `6c8367787fb061c983305e989300ac1de14d69770067433436cfe461ba8ddfa4`
  - `pdfHashAfter`:   `6c8367787fb061c983305e989300ac1de14d69770067433436cfe461ba8ddfa4` (MATCH)
- **Verdict**: **PASS**

---

### Test 2: Deployment Replacement Preserves Archives
- **Objective**: Verify that rolling container deployments (destroying an old container root filesystem and launching a new container) preserve the mounted persistent volume artifacts.
- **Methodology**: Stored report binaries on a simulated persistent mount volume (`persistent_volume_mount`), created container workspace A, deleted container workspace A, created container workspace B, and accessed the volume from container B.
- **Empirical Evidence**:
  - `depHashBefore`: `3f2787d1ab62209648b4b1d036a751f3385af6661a9f5f54fd0343d023f992e7`
  - `depHashAfter`:  `3f2787d1ab62209648b4b1d036a751f3385af6661a9f5f54fd0343d023f992e7` (MATCH)
  - `ephemeralContainerDestroyed`: `true`
  - `newDeploymentActive`: `true`
  - `volumePreserved`: `true`
- **Verdict**: **PASS**

---

### Test 3: Database Recovery Preserves Archive Metadata
- **Objective**: Verify that restoring metadata from a database backup snapshot restores all required archival fields, checksums, and approval bindings.
- **Methodology**: Exported live Case 20261101 Version 2 archive document to an isolated snapshot, simulated database recovery, and performed field-by-field equality validation.
- **Empirical Evidence**:
  - `caseId`: `20261101` (MATCH)
  - `version`: `2` (MATCH)
  - `docxSha256`: `813a013f7cba0cfafc18fb8ccefccafcd9733ddf705244261612fa46edf9a58c` (MATCH)
  - `pdfSha256`:  `6bb83e92e71cb03264744218546395900dcb152d99ed74c22bcd5bb050c94c0f` (MATCH)
  - `digitalSignature`: `38f7ca1dde4eea4eaff8c1bbe8d630bde06ce3c5e16f33e496a0d481b4ef8cfc` (MATCH)
  - `approvalStatus`: `Approved` (MATCH)
  - `approvedBy`: `admin` (MATCH)
  - `auditTrailLength`: 8 entries preserved intact
- **Verdict**: **PASS**

---

### Test 4: Storage Recovery Preserves Exact Report Binaries
- **Objective**: Verify that restoring physical storage from backup snapshots preserves exact byte counts and bit-level file content.
- **Methodology**: Took a binary snapshot of the live storage directory, extracted the files into a simulated recovered storage volume, and performed full binary buffer comparisons (`Buffer.equals`).
- **Empirical Evidence**:
  - `liveDocxBytes`: `3,369,735` bytes
  - `recoveredDocxBytes`: `3,369,735` bytes
  - `livePdfBytes`: `1,557,926` bytes
  - `recoveredPdfBytes`: `1,557,926` bytes
  - `exactBinaryMatch`: `true` (Both DOCX and PDF buffers identical)
- **Verdict**: **PASS**

---

### Test 5: SHA-256 Checksums Match After Recovery
- **Objective**: Verify that re-computing cryptographic hashes on restored files yields 100% equality against canonical metadata.
- **Methodology**: Re-hashed the recovered files from Test 4 and compared against `archive.docxSha256` and `archive.pdfSha256`.
- **Empirical Evidence**:
  - `expectedDocxSha256`: `813a013f7cba0cfafc18fb8ccefccafcd9733ddf705244261612fa46edf9a58c`
  - `recoveredDocxSha256`: `813a013f7cba0cfafc18fb8ccefccafcd9733ddf705244261612fa46edf9a58c` (MATCH)
  - `expectedPdfSha256`:  `6bb83e92e71cb03264744218546395900dcb152d99ed74c22bcd5bb050c94c0f`
  - `recoveredPdfSha256`:  `6bb83e92e71cb03264744218546395900dcb152d99ed74c22bcd5bb050c94c0f` (MATCH)
- **Verdict**: **PASS**

---

### Test 6: Unauthorized Archive Replacement Is Detected (Tamper Detection)
- **Objective**: Verify that any unauthorized binary alteration, substitution, or manifest forgery is detected and blocked before delivery.
- **Methodology**: Created isolated sandbox archive `99999999` Version `1`. Tested 3 distinct tampering vectors:
  1. Verified clean fetch of genuine report (`fetchGenuineOk: true`).
  2. Injected 1-byte binary corruption on disk: verified `getArchivedReport` caught the mismatch and returned `corrupted: true` with error `ARCHIVE_FILE_CORRUPTED`.
  3. Restored binary but forged the manifest signature: verified `getArchivedReport` detected the signature invalidation and returned `corrupted: true` with error `ARCHIVE_MANIFEST_TAMPERED`.
- **Empirical Evidence**:
  - `fetchGenuineOk`: `true`
  - `binaryTamperDetected`: `true` (`ARCHIVE_FILE_CORRUPTED`)
  - `manifestTamperDetected`: `true` (`ARCHIVE_MANIFEST_TAMPERED`)
  - Security audit events recorded in audit log: `INTEGRITY_FAILED`
- **Verdict**: **PASS**

---

### Test 7: Unauthorized Deletion Is Prevented Where Storage Retention Is Configured
- **Objective**: Verify that storage-level retention prevents file overwriting/deletion and that missing files trigger security alarms.
- **Methodology**: Applied POSIX read-only attributes (`chmod 0444`) to a simulated WORM-locked archive file, attempted write/overwrite, and tested retrieval against a missing file.
- **Empirical Evidence**:
  - `readOnlyLockEnforced`: `true` (Write attempt blocked with `EACCES` / `EPERM`)
  - `missingFileSecurityAlert`: `true` (`ARCHIVE_FILE_MISSING`)
  - Alert code: `ARCHIVE_FILE_MISSING`
  - Security audit event recorded: `INTEGRITY_FAILED`
- **Verdict**: **PASS**

---

## 4. Test Summary Scorecard

| Test ID | Scenario | Result | Evidence Verified |
| :---: | :--- | :---: | :--- |
| **01** | Application Process Restart | **PASS** | Hashes identical pre- and post-restart |
| **02** | Ephemeral Container Replacement | **PASS** | Volume intact across container destruction |
| **03** | Database Metadata Recovery | **PASS** | 100% field, signature, and audit trail match |
| **04** | Physical Binary Storage Recovery | **PASS** | Exact byte counts and bit-level buffer match |
| **05** | Post-Recovery Checksum Verification | **PASS** | SHA-256 match for both DOCX and PDF |
| **06** | Unauthorized Replacement Detection | **PASS** | File corruption & manifest forgery blocked |
| **07** | Storage Retention & Missing Detection| **PASS** | Overwrite denied (`EACCES`); missing flagged |

**Final Suite Score:** **7 / 7 PASSED (100%)**
