# GCR — ARCHIVE TAMPER TESTING & DETECTION AUDIT REPORT
**Document ID:** `GCR_ARCHIVE_TAMPER_TEST_REPORT.md`  
**Phase:** 3.5.5.1 — Independent Acceptance Audit  
**Role:** Independent Banking Systems Security Auditor, Cryptographic Storage Specialist, and Disaster Recovery Architect  
**Audit Date:** November 4, 2026  
**Status:** COMPLETE — EMPIRICAL ATTACK SIMULATIONS RECORDED  

---

## 1. Executive Summary

This report documents the results of empirical attack simulations against GCR's valuation report archival subsystem. Testing was performed strictly using isolated test copies in a sandbox directory (`/tmp/gcr_audit_3_5_5_1_sandbox_*`) to guarantee zero interference with existing case records or historical reports.

Six specific attack scenarios were executed to evaluate whether GCR detects or prevents tampering across report binaries, manifest records, and physical storage.

---

## 2. Attack Simulation Methodology & Results

### Attack 1: Modify One Byte in DOCX Binary
- **Test ID**: `2.2`
- **Attack Vector**: An attacker with storage volume write access flips one byte (bit-level alteration) inside `report_77777771_v1.docx`.
- **Pre-Attack SHA-256**: `6d4c55ff27ad6fb744eebdbdca113b2e597c485cbfe54e0b57cf60eb33575efb`
- **Post-Attack SHA-256**: `1488c949c25608bfa0c1e405f6cba0281b672728469e38ef8dc0e6e7889e471f`
- **Expected Outcome**: Immediate detection of file corruption, delivery halted, audit event recorded.
- **Actual Outcome**:
  - `corrupted: true`
  - `error: "ARCHIVE_FILE_CORRUPTED"`
  - `message`: *"Security violation: The archived DOCX report failed cryptographic SHA-256 verification."*
  - `auditTrail`: Appended event `INTEGRITY_FAILED` with details `{ reason: 'CHECKSUM_MISMATCH' }`.
- **Verdict**: **PASS (DETECTED)**

---

### Attack 2: Modify One Byte in PDF Binary
- **Test ID**: `2.3`
- **Attack Vector**: An attacker flips one byte at the EOF of `report_77777771_v1.pdf`.
- **Pre-Attack SHA-256**: `3c59e5e324c43ba4e4ccefe2f3dc29f9df356e828dc3c95e1c0d54ae1a7b4588`
- **Post-Attack SHA-256**: `dcbcbfec31210459c5d0eb1c856eeaa8a8ef5b46b1ba87455dcb386ec93e77ad`
- **Expected Outcome**: Immediate detection of file corruption, delivery halted, audit event recorded.
- **Actual Outcome**:
  - `corrupted: true`
  - `error: "ARCHIVE_FILE_CORRUPTED"`
  - `message`: *"Security violation: The archived PDF report failed cryptographic SHA-256 verification."*
  - `auditTrail`: Appended event `INTEGRITY_FAILED` with details `{ reason: 'CHECKSUM_MISMATCH' }`.
- **Verdict**: **PASS (DETECTED)**

---

### Attack 3: Modify One Manifest Field (Metadata Tampering)
- **Test ID**: `2.4`
- **Attack Vector**: An attacker edits `manifest_77777771_v1.json` on disk, changing `approval.status` from `"Pending"` to `"Approved"`, while leaving the binary files and the `tamperProtection.digitalSignature` string intact.
- **Expected Outcome**: The manifest verification engine should parse the manifest file, recalculate the expected signature over the manifest's contents, detect that the signature does not match the tampered field, and reject the archive.
- **Actual Outcome**:
  - `corrupted: false`
  - `error: undefined`
  - **The report was delivered without error!**
- **Root Cause Analysis (Vulnerability Discovery)**:
  In `reportArchiveService.js` (lines 296–307), `getArchivedReport` constructs `canonicalData` from the **MongoDB archive document** (`archive.approvalStatus`, etc.) rather than reading the fields from `manifest.approval.status`. Since the signature stored in the manifest was originally generated from the database record, the signature matched the DB record perfectly. The tampered value in the manifest file was completely ignored.
- **Verdict**: **FAIL (UNDETECTED BY MANIFEST VERIFICATION)**

---

### Attack 4: Replace Manifest Signature
- **Test ID**: `2.5`
- **Attack Vector**: An attacker replaces `digitalSignature` in `manifest_77777771_v1.json` with an invalid or forged 64-character hex string (`deadbeef...`).
- **Expected Outcome**: Verification failure, delivery halted, audit log recorded.
- **Actual Outcome**:
  - `corrupted: true`
  - `error: "ARCHIVE_MANIFEST_TAMPERED"`
  - `message`: *"Security violation: Independent cryptographic manifest failed HMAC-SHA256 digital signature verification."*
  - `auditTrail`: Appended event `INTEGRITY_FAILED` with details `{ reason: 'MANIFEST_SIGNATURE_INVALID' }`.
- **Verdict**: **PASS (DETECTED)**

---

### Attack 5: Replace Both Report Binary and Manifest
- **Test ID**: `2.6`
- **Attack Vector**: An attacker replaces `report_77777771_v1.pdf` with a fraudulent document, computes its SHA-256 hash, and generates a new `manifest_77777771_v1.json` reflecting the fake hash with an unauthenticated signature.
- **Expected Outcome**: Detection of either binary mismatch against DB or invalid signature.
- **Actual Outcome**:
  - `corrupted: true`
  - `error: "ARCHIVE_FILE_CORRUPTED"` (Triggered first because the binary hash did not match the immutable MongoDB `archive.pdfSha256`).
- **Verdict**: **PASS (DETECTED)**

---

### Attack 6: Attempt Unauthorized Deletion
- **Test ID**: `2.7`
- **Attack Vector**: An attacker deletes `report_77777771_v1.pdf` directly from storage using filesystem commands (`unlinkSync` / `rm`).
- **Expected Outcome**: Missing file detected, delivery aborted, audit event recorded.
- **Actual Outcome**:
  - `corrupted: true`
  - `error: "ARCHIVE_FILE_MISSING"`
  - `message`: *"The archived PDF report file is missing from permanent storage."*
  - `auditTrail`: Appended event `INTEGRITY_FAILED` with details `{ reason: 'MISSING_FILE' }`.
- **Verdict**: **PASS (DETECTED)**

---

## 3. Prevention Versus Detection Analysis

A core mandate of this audit is to clearly distinguish between **tamper detection** (detecting an attack after it occurred) and **tamper prevention** (preventing an attack from occurring at all).

| Attack Type | Current Application Status | Storage Substrate Status | Banking Production Requirement |
| :--- | :---: | :---: | :--- |
| **DOCX/PDF Byte Corruption** | **DETECTED** (SHA-256) | Not Prevented (Host FS allows write) | **PREVENTED** via S3 Object Lock (Compliance Mode) |
| **Manifest Signature Forgery** | **DETECTED** (HMAC-SHA256) | Not Prevented | **PREVENTED** via S3 Object Lock + Asymmetric KMS |
| **Manifest Field Tampering** | **UNDETECTED** (Finding F-01) | Not Prevented | Must fix verification logic + S3 Object Lock |
| **File Deletion (Ransomware/Rogue)**| **DETECTED** (`FILE_MISSING`) | Not Prevented (Host FS allows delete)| **PREVENTED** via S3 Object Lock (Blocks Delete) |
| **Concurrent Version Overwrite** | **PREVENTED** (Compound Index) | N/A | **PREVENTED** (MongoDB Compound Unique Index) |

### Key Takeaway for Banking Regulators
- **Software-Tier Controls (Node.js/MongoDB)**: Excel at **tamper detection** and **preventing application-level duplicate overwrites**. However, application software running in user space cannot prevent an external attacker with root OS access or storage access from modifying or deleting files on the physical disk.
- **Storage-Tier Controls (AWS S3 Object Lock)**: Required in production to provide **hardware-enforced tamper prevention** (WORM), where write and delete operations are rejected at the storage layer regardless of user privilege.
