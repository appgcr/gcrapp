# GCR — MASTER SECURITY & CRYPTOGRAPHIC AUDIT REPORT
**Document ID:** `GCR_SECURITY_AUDIT.md`  
**Date:** November 4, 2026  
**Role:** Principal Application Security Engineer, Cryptographic Architect, and Banking Records Security Specialist  
**Status:** COMPREHENSIVE SECURITY VERIFICATION COMPLETE  

---

## 1. Executive Summary

This document consolidates the complete security architecture and audit verification across the GCR Banking Property Valuation Management Ecosystem. All security controls—including authentication, authorization, cryptographic signing, key management, input sanitization, and physical data preservation—were evaluated and tested in accordance with institutional banking guidelines.

The ecosystem has successfully closed all previously identified vulnerabilities (Findings F-01, F-02, and F-03), enforces strict role separation, and is hardened against tampering, forgery, privilege escalation, and unauthorized disclosures.

---

## 2. Authentication & Authorization Controls

### 2.1 Password Hashing & Credential Security
- **Algorithm:** Salted `bcrypt` with work factor $\ge 10$.
- **Password Policy:** Minimum 8 characters, requiring mixed alphanumeric characters and symbols.
- **Credential Storage:** User password hashes are excluded by default in Mongoose queries (`select: false`). Passwords are never returned in API payloads, logs, or diagnostic dumps.

### 2.2 JWT Session Management
- **Signing Algorithm:** HMAC-SHA256 with 256-bit cryptographic entropy.
- **Expiration Policy:** Tokens expire after 24 hours (`expiresIn: '24h'`).
- **Signature Verification:** Authoritative verification executed via Express middleware on all protected routes.
- **Payload Sanitization:** Tokens contain only non-sensitive identity metadata (`id`, `username`, `role`).

### 2.3 Role-Based Access Control (RBAC) Enforcement
Access controls are enforced at the backend middleware layer, preventing client-side UI bypass:
- **`SUPER_ADMIN`:** Full administrative access. Sole authority permitted to approve valuation reports, return cases with feedback, create or delete staff users, and modify system settings.
- **`ENGINEER`:** Strictly limited to viewing assigned cases, recording own attendance, uploading property documents/photographs, completing dynamic inspection forms, and submitting signed inspections.
- **Critical Banking Rule Verified:** Field engineers are strictly forbidden from approving their own valuation reports (`HTTP 403`) or creating/deleting user accounts (`HTTP 403`).

---

## 3. Cryptographic Archival & Signing Key Security

### 3.1 Finding F-01 Remediation: Manifest Self-Verification
- **Vulnerability Remediated:** Previously, manifest verification reconstructed canonical data from MongoDB rather than manifest contents.
- **Remediated Pipeline:** `getArchivedReport()` parses the manifest file on disk, constructs canonical signing data directly from the manifest JSON fields, and verifies the HMAC-SHA256 signature using constant-time comparison (`crypto.timingSafeEqual`).
- **Cross-Check Defense:** An independent cross-check compares manifest fields against the MongoDB archive document (`caseId`, `version`, `docxSha256`, `pdfSha256`, `approvalStatus`, `approvedBy`, `digitalSignature`).
- **Empirical Proof:** Modifying `approval.status` from `Pending` to `Approved` on disk while retaining the signature immediately triggers `ARCHIVE_MANIFEST_TAMPERED` (Test 1.1: PASS).

### 3.2 Finding F-02 Remediation: Removal of Hardcoded Signing Secrets
- **Vulnerability Remediated:** Hardcoded signing secret fallback strings (`'gcr_enterprise_immutable_archive_signing_key_2026'`) were eliminated.
- **Fail-Secure Architecture:** If `ARCHIVE_SIGNING_KEY` is omitted from the environment, the engine throws `ARCHIVE_SECURITY_ERROR`. The application refuses to sign or create archives with unconfigured secrets.
- **Zero Secret Exposure:** Signing keys are never logged in audit trails, error messages, or client payloads.

### 3.3 Finding F-03 Remediation: Versioned Keyring & Key Rotation
- **Versioned Key IDs:** Every signed manifest and database record includes a versioned `keyId` (e.g., `'gcr-2026-k1'`).
- **Dual-Mode Keyring:** Active signing key handles new reports; historical keys in `ARCHIVE_KEYRING` JSON maintain verifiability of historical archives across multi-year lifecycles.
- **Immutability Invariant:** Historical binaries and manifests are **never rewritten** merely because a signing key rotation occurs.
- **Unknown Key Defense:** Manifests referencing unknown or revoked key IDs are rejected with `ARCHIVE_KEY_UNKNOWN`.
- **AWS KMS Adapter:** An interface class (`KmsSignerAdapter`) is prepared for asymmetric cloud hardware signing (RSASSA-PSS / ECDSA) without incurring cloud costs during development.

---

## 4. Document Intelligence & Boundary Safety

### 4.1 Boundary Safety Invariant
- **Rule:** Legal deed boundaries (East, West, North, South) extracted via OCR are recorded in `legalBoundaries`.
- **Enforcement:** On-site boundaries (`actualBoundaries`) are **NEVER auto-filled from documents**. They remain strictly `MANUAL` requiring the field engineer to personally verify physical ground reality during on-site inspection.
- **Reconciliation Engine:** Flags discrepancies between Sale Deed and Tax assessment; treats tax receipts as non-conclusive proof of ownership.

---

## 5. Native Android Application Security

### 5.1 Hardware-Backed Key Storage
- **Keystore Integration:** `TokenManager` utilizes AndroidX `EncryptedSharedPreferences` backed by the hardware MasterKey in Android Keystore (AES-256 GCM).
- **Session Protection:** Tokens are stored encrypted on-device; cleared upon explicit logout.

### 5.2 Biometric Authentication
- **BiometricPrompt API:** Integrates Android `BIOMETRIC_STRONG` (fingerprint / 3D face) with secure device credential fallback.
- **Device Credential Protection:** Fallback requires device PIN / pattern if biometrics are unavailable.

---

## 6. Audit Trail & Security Event Logging

Every security-sensitive event is permanently logged with authoritative server timestamps:
- `ARCHIVE_CREATED` — Generated on report archival with binary SHA-256 hashes and key ID.
- `STATUS_CHANGED` — Tracked across case transitions (`Assigned` $\rightarrow$ `Completed` $\rightarrow$ `Approved` / `Returned`).
- `INTEGRITY_VERIFIED` — Logged upon successful tamper verification during report download.
- `INTEGRITY_FAILED` — Logged on checksum mismatch, manifest signature forgery, missing file, or metadata discrepancy.

---

## 7. Security Audit Conclusion

The GCR ecosystem satisfies the rigorous integrity, confidentiality, and non-repudiation standards mandated for institutional banking property valuation records. All known critical security findings have been closed.
