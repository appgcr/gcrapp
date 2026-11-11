# GCR — PHASE 3.5.5.1: INDEPENDENT SECURITY, CRYPTOGRAPHIC INTEGRITY & RECOVERY ACCEPTANCE AUDIT
**Document ID:** `GCR_PHASE_3_5_5_1_SECURITY_AUDIT.md`  
**Phase:** 3.5.5.1 — Independent Acceptance Audit  
**Role:** Independent Banking Systems Security Auditor, Cryptographic Storage Specialist, and Disaster Recovery Architect  
**Audit Date:** November 4, 2026  
**Final Audit Verdict:** **CONDITIONAL PASS**  

---

## 1. Executive Summary

As mandated by Phase 3.5.5.1, an independent, empirical security and disaster recovery audit was conducted on GCR's report archival, cryptographic tamper protection, and storage durability implementations.

The objective was to verify whether GCR's archived valuation reports are protected against unauthorized modification, replacement, deletion, and recovery failure.

### Summary of Audit Findings
1. **Cryptographic Binary Integrity (PASS)**: Every archived DOCX and PDF report binary is protected by an independent SHA-256 cryptographic hash computed prior to storage and re-verified on every download. 1-byte corruptions in both DOCX and PDF binaries are immediately detected, halting delivery and logging `INTEGRITY_FAILED` audit events.
2. **Approval-to-Binary Binding (PASS)**: Super Admin approval records in MongoDB bind the approving user's identity, timestamp, and comments directly to the exact SHA-256 hashes of the approved report binaries. Version 1 (Returned) and Version 2 (Approved) are strictly segregated.
3. **Storage Recovery & Durability (PASS)**: Simulated application restarts, container replacements, persistent volume remounts, and database recovery preserve 100% of archived binaries, metadata, and manifest signatures without data loss or hash deviation.
4. **Duplicate Version & Overwrite Prevention (PASS)**: MongoDB compound unique index `{ caseId: 1, version: 1 }` strictly rejects duplicate version creation (`code 11000`) and prevents concurrent overwrite collisions.
5. **HMAC Secret Key Separation (CONDITIONAL PASS / VULNERABILITY IDENTIFIED)**:
   - The HMAC secret is stored in environment variables, but falls back to a hardcoded code string if unset.
   - Symmetric HMAC allows anyone with backend host shell access to compute signatures.
   - Key rotation and multi-key recovery are not yet implemented in code.
6. **Manifest Field Verification (VULNERABILITY IDENTIFIED)**:
   - `getArchivedReport` constructs the canonical data string for HMAC verification using the *database record* rather than parsing the manifest file's own fields. Consequently, modifying metadata fields inside `manifest_{caseId}_v{version}.json` on disk (while keeping the original signature) is not detected by the manifest check.
7. **Storage-Level WORM Readiness (PROPOSAL ONLY / NOT DEPLOYED)**:
   - AWS S3 Object Lock is well-specified in architecture documentation, but is **not active** in the current environment. The local environment runs on Apple File System (APFS).

---

## 2. Comprehensive Test Scorecard

| Audit Domain | Test ID | Description | Expected Outcome | Actual Outcome | Verdict |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **HMAC Security** | 1.1 | HMAC Valid Signature Verification | Returns `true` | Verified 64-char hex signature | **PASS** |
| **HMAC Security** | 1.2 | Missing/Empty Signature Rejection | Rejects invalid signature | Handled safely, returns `false` | **PASS** |
| **HMAC Security** | 1.3 | Forged Signature Rejection | Rejects altered metadata | Mismatch detected, returns `false` | **PASS** |
| **HMAC Security** | 1.4 | Key Rotation Isolation | Fails if verified with different key | Mismatch caught immediately | **PASS** |
| **Manifest Integrity** | 2.1 | Baseline Genuine Report Fetch | Fetches without corruption | Clean delivery, hashes match | **PASS** |
| **Manifest Integrity** | 2.2 | DOCX 1-Byte Modification | Halts delivery, flags corruption | `ARCHIVE_FILE_CORRUPTED` logged | **PASS** |
| **Manifest Integrity** | 2.3 | PDF 1-Byte Modification | Halts delivery, flags corruption | `ARCHIVE_FILE_CORRUPTED` logged | **PASS** |
| **Manifest Integrity** | 2.4 | Manifest Field Modification | Halts delivery, flags manifest tamper | **Manifest modification undetected** | **FAIL** |
| **Manifest Integrity** | 2.5 | Manifest Signature Replacement | Halts delivery, flags forged signature | `ARCHIVE_MANIFEST_TAMPERED` logged | **PASS** |
| **Manifest Integrity** | 2.6 | Dual Report & Manifest Replacement | Halts delivery, flags binary mismatch | `ARCHIVE_FILE_CORRUPTED` logged | **PASS** |
| **Manifest Integrity** | 2.7 | Unauthorized Deletion | Halts delivery, flags missing file | `ARCHIVE_FILE_MISSING` logged | **PASS** |
| **Storage Recovery** | 3.1 | Application Restart Recovery | Binaries and hashes identical | Pre- and post-restart SHA identical | **PASS** |
| **Storage Recovery** | 3.2 | Container Replacement Recovery | Volume persists across container wipe | Preserved across container deletion | **PASS** |
| **Storage Recovery** | 3.3 | Persistent Volume Remount | Files intact on volume remount | SHA-256 identical after remount | **PASS** |
| **Storage Recovery** | 3.4 | Database Metadata Restoration | All fields and signatures restored | 100% field equality in restored DB | **PASS** |
| **Storage Recovery** | 3.5 | Binary and Manifest Restoration | Bit-for-bit file restore | Exact byte count & buffer match | **PASS** |
| **Version Integrity** | 4.1 | Approval State Segregation | V1 and V2 maintain separate status | V1 `Pending`, V2 `Approved` | **PASS** |
| **Version Integrity** | 4.2 | Approved Hashes Match Storage | Stored hash matches file on disk | `813a013f...` & `6bb83e92...` match | **PASS** |
| **Version Integrity** | 4.3 | Returned Version Immutability | V1 unchanged by V2 approval | V1 hashes bit-identical | **PASS** |
| **Version Integrity** | 4.4 | Duplicate Version Rejection | Atomic rejection of duplicate key | Blocked with Mongo Error 11000 | **PASS** |
| **Version Integrity** | 4.5 | Concurrent Duplicate Submissions | Race condition safety | Duplicate caught, single record created | **PASS** |

**Scorecard Summary:** 21 Tested | **20 PASSED** | **1 FAILED** | **0 NOT TESTED**

---

## 3. Detailed Audit Findings & Threat Analysis

### 3.1 Finding F-01: Manifest Field Tamper Blind Spot (Vulnerability)
- **Severity**: MEDIUM-HIGH
- **Component**: `ValuationBackend/services/reportArchiveService.js` (`getArchivedReport`)
- **Analysis**:
  When verifying the manifest, `getArchivedReport` constructs `canonicalData` from the MongoDB document (`archive.approvalStatus`, `archive.docxSha256`, etc.) rather than parsing the fields of the disk manifest `manifest_{caseId}_v{version}.json`.
  If an attacker modifies `manifest.approval.status = 'Approved'` on disk but leaves the existing signature untouched, `verifyArchiveManifest(canonicalDataFromDB, signature)` evaluates to `true` because the signature matches the database state.
- **Impact**: An attacker who alters metadata in the physical manifest without altering the database or binary file will not trigger a manifest corruption alarm upon report download.
- **Required Remediation (Phase 3.5.6)**:
  `getArchivedReport` must construct the canonical verification string from the **manifest file's own payload** and verify that:
  1. The manifest's internal fields match the manifest's signature.
  2. The manifest's internal fields match the MongoDB archive document's fields.

### 3.2 Finding F-02: Symmetric HMAC Secret Key Management
- **Severity**: MEDIUM
- **Component**: `ValuationBackend/services/reportArchiveService.js` (`getSigningKey`)
- **Analysis**:
  - `getSigningKey()` reads `process.env.ARCHIVE_SIGNING_KEY || process.env.JWT_SECRET || 'gcr_enterprise_immutable_archive_signing_key_2026'`.
  - In environments where `ARCHIVE_SIGNING_KEY` is not explicitly set, the fallback to repo code enables anyone with code access to compute valid HMAC signatures.
  - Symmetrically keyed HMAC means the application backend holds both signing and verification capabilities. An attacker who gains shell access to the backend process can forge signatures.
- **Impact**: Limits non-repudiation in legal proceedings.
- **Required Remediation (Production Migration)**:
  Migrate from HMAC-SHA256 to asymmetric digital signing (RSA-PSS 4096 or ECDSA P-256) backed by AWS KMS or HashiCorp Vault Transit Engine. The backend runtime should only hold the public key for verification.

### 3.3 Finding F-03: Lack of Key Rotation / Keyring Support
- **Severity**: LOW-MEDIUM
- **Component**: `ValuationBackend/services/reportArchiveService.js`
- **Analysis**:
  The system currently assumes a single static signing key. Manifests do not store a Key ID (`kid`) or key version. If `ARCHIVE_SIGNING_KEY` is rotated, all previously generated manifests will fail verification and be rejected as `ARCHIVE_MANIFEST_TAMPERED`.
- **Required Remediation**: Add a `keyId` header to manifests and support an active keyring with historical public verification keys.

### 3.4 Finding F-04: Storage Retention is Software-Enforced, Not Hardware WORM
- **Severity**: INFORMATIONAL / ARCHITECTURAL BOUNDARY
- **Component**: Storage Substrate (Apple File System)
- **Analysis**:
  The current implementation relies on POSIX file permissions (`chmod 0444`) and Node.js application-tier hash checks. This successfully **detects** tampering and **prevents non-root overwrites**, but a root-privileged actor on the host can modify files.
- **Status**: Clearly labeled as architectural proposal. True WORM compliance requires deployment to AWS S3 Object Lock in Compliance Mode.

---

## 4. Final Acceptance Decision

Based on the empirical evidence gathered during the audit:
- The core banking report archival pipeline is **robust, persistent, and reliably detects binary report tampering, file deletions, and duplicate submission collisions**.
- However, two cryptographic controls require remediation before live banking production: (1) Manifest self-verification logic, and (2) Key rotation / asymmetric KMS signing.

**FINAL AUDIT VERDICT: CONDITIONAL PASS**

**Next Action:** Address findings F-01 and F-02 in a controlled remediation step before proceeding to production cloud provisioning.
