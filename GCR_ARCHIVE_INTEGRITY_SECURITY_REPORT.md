# GCR — ARCHIVE INTEGRITY & TAMPER-RESISTANCE SECURITY REPORT
**Document ID:** `GCR_ARCHIVE_INTEGRITY_SECURITY_REPORT.md`  
**Phase:** 3.5.5 — Production Storage Durability & Audit Integrity  
**Role:** Principal Cloud Storage Architect, Banking Records Security Engineer, and Database Reliability Specialist  
**Status:** COMPLETED & EMPIRICALLY AUDITED  
**Date:** November 4, 2026  

---

## 1. Executive Summary

A critical banking vulnerability identified in early design was that **storing a document hash in the same editable database as the file pointer does not constitute independent tamper protection**. An attacker, rogue insider, or compromised database credential could alter both the database checksum and the stored binary concurrently, bypassing simple in-app hash lookups.

In Phase 3.5.5, GCR implemented **independent cryptographic manifest protection** with HMAC-SHA256 digital signing, decoupled disk-level manifests, strict audit logging, and formal evaluation of storage-level Write Once Read Many (WORM) retention.

This report documents the security mechanisms, the cryptographic verification pipeline, the audit event taxonomy, and the storage-level retention architecture.

---

## 2. Independent Cryptographic Manifest & Signing Architecture

### 2.1 The Tamper-Protection Vulnerability & Mitigation

```
VULNERABLE (Legacy Pattern):
[ Attacker / Compromised DB ] ---> Overwrites File & Updates DB Hash ---> Bypass Detected: NO (Hash matches fake file)

SECURED (Phase 3.5.5 Pattern):
[ Attacker / Compromised DB ] ---> Alters File or Modifies Record
                                     |
                                     V
[ Security Verification Engine ] ---> Reads Physical File -> Computes SHA-256
                                 ---> Reads Separate Manifest File (manifest_*.json)
                                 ---> Verifies HMAC-SHA256 Digital Signature using Protected Secret Key
                                 ---> IF Signature fails OR Manifest Hash != Binary Hash -> REJECT WITH ALERT
```

### 2.2 Canonical Manifest Data Model

To ensure deterministic signature verification, canonical fields are ordered and delimited prior to signing:

```
canonicalString = [
  caseId,
  version,
  docxSha256,
  pdfSha256,
  templateId,
  approvalStatus,
  approvedBy,
  approvedAtISO
].join('|')
```

### 2.3 Cryptographic Implementation Details

1. **Digital Signature Algorithm**: `HMAC-SHA256` using node crypto with timing-safe comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
2. **Signing Key Isolation**:
   - Development/Staging: `ARCHIVE_SIGNING_KEY` environment variable.
   - Production Architecture: Dedicated AWS KMS asymmetric key (RSA-4096 / ECC NIST P-256) or HashiCorp Vault Transit engine where private signing keys cannot be extracted by the application runtime.
3. **Physical Manifest Artifact**:
   Stored alongside report binaries as `manifest_{caseId}_v{version}.json`:
   ```json
   {
     "archiveStandard": "GCR_SEC_ARCHIVE_V1",
     "caseId": "20261101",
     "version": 2,
     "generatedAt": "2026-11-04T06:54:43.984Z",
     "templateId": "HOUSE_APGB_NEW_FORMAT",
     "templateVersion": "1.0.0",
     "bankName": "State Bank of India",
     "bankBranch": "RACPC Kurnool",
     "propertyType": "Independent House",
     "artifacts": {
       "docx": {
         "filename": "report_20261101_v2.docx",
         "sha256": "813a013f7cba0cfafc18fb8ccefccafcd9733ddf705244261612fa46edf9a58c",
         "sizeBytes": 3369735
       },
       "pdf": {
         "filename": "report_20261101_v2.pdf",
         "sha256": "6bb83e92e71cb03264744218546395900dcb152d99ed74c22bcd5bb050c94c0f",
         "sizeBytes": 1557926
       }
     },
     "approval": {
       "status": "Approved",
       "approvedBy": "admin",
       "approvedAt": "2026-11-04T06:54:44.048Z",
       "decisionComment": "Final bank approval"
     },
     "tamperProtection": {
       "algorithm": "HMAC-SHA256",
       "digitalSignature": "38f7ca1dde4eea4eaff8c1bbe8d630bde06ce3c5e16f33e496a0d481b4ef8cfc"
     }
   }
   ```

---

## 3. Comprehensive Audit Event Taxonomy

Every report archive maintains an append-only, immutable `auditTrail` array. The system tracks the following seven core lifecycle events:

| Event Name | Trigger Condition | Logged Metadata | Actor Role |
| :--- | :--- | :--- | :--- |
| **`ARCHIVED`** | Engineer submits case version for review | DOCX/PDF SHA-256, byte sizes, digital signature | `ENGINEER` |
| **`SUBMITTED`** | Workflow status transitions to `Reviewing` | Submitter identity, case version, timestamp | `ENGINEER` |
| **`APPROVED`** | Super Admin reviews and issues final approval | Admin identity, approval timestamp, decision comment, updated digital signature | `SUPER_ADMIN` |
| **`RETURNED`** | Super Admin returns case for corrections | Admin identity, return reason, revision requirements | `SUPER_ADMIN` |
| **`DOWNLOADED`** | Client, auditor, or engineer requests report | Requested format (PDF/DOCX), version number, client IP | `USER` / `AUDITOR` |
| **`CHECKSUM_VERIFIED`** | Binary retrieved from storage and passes SHA-256 | Verified format, matching SHA-256 hash | `SYSTEM` |
| **`INTEGRITY_FAILED`** | Missing file, SHA-256 mismatch, or invalid signature | Failure reason (`CHECKSUM_MISMATCH`, `MANIFEST_SIGNATURE_INVALID`, `MISSING_FILE`), expected vs actual hashes | `SECURITY_MONITOR` |

### Empirical Audit Trail Verification: Case 20261101 Version 2
Below is the live audit trail verified in MongoDB for approved Case 20261101 Version 2:
1. `ARCHIVED` (2026-11-04T06:54:43.984Z) by `GCR Field Engineer` (`ENGINEER`)
2. `CHECKSUM_VERIFIED` (2026-11-04T06:54:44.030Z) by `auditor` (`AUDITOR`)
3. `DOWNLOADED` (2026-11-04T06:54:44.031Z) by `auditor` (`AUDITOR`)
4. `APPROVED` (2026-11-04T06:54:44.048Z) by `admin` (`SUPER_ADMIN`) with comment: *"Final bank approval"*
5. `CHECKSUM_VERIFIED` (2026-11-04T06:55:12.703Z) by `admin` (`SUPER_ADMIN`)
6. `DOWNLOADED` (2026-11-04T06:55:12.704Z) by `admin` (`SUPER_ADMIN`)

---

## 4. Detection of File and Metadata Tampering

In Test 6 of `test_phase_3_5_5_recovery.js`, automated tamper injection verified detection capability across three attack vectors:

### 4.1 Vector 1: Binary Report Tampering
- **Attack Simulation**: An attacker modifies the stored PDF binary directly on disk (replacing genuine content with modified valuation figures).
- **Detection Mechanism**: `getArchivedReport` reads the file buffer, computes the runtime SHA-256 hash, and compares it to `archive.pdfSha256`.
- **Observed Result**:
  - `corrupted: true`
  - `error: 'ARCHIVE_FILE_CORRUPTED'`
  - Error message: `Security violation: The archived PDF report failed cryptographic SHA-256 verification.`
  - `INTEGRITY_FAILED` event appended to the permanent audit trail.
  - Delivery immediately aborted.

### 4.2 Vector 2: Manifest Tampering
- **Attack Simulation**: An attacker tampers with the manifest file (altering approval status or recorded hashes).
- **Detection Mechanism**: `getArchivedReport` parses the manifest, canonicalizes fields, and verifies the HMAC signature using `crypto.timingSafeEqual`.
- **Observed Result**:
  - `corrupted: true`
  - `error: 'ARCHIVE_MANIFEST_TAMPERED'`
  - Error message: `Security violation: Independent cryptographic manifest failed HMAC-SHA256 digital signature verification.`
  - `INTEGRITY_FAILED` event appended to audit trail.
  - Delivery immediately aborted.

### 4.3 Vector 3: Missing File Deletion
- **Attack Simulation**: An attacker or rogue process deletes the physical report file from storage.
- **Detection Mechanism**: `getArchivedReport` checks `fs.existsSync(targetPath)`.
- **Observed Result**:
  - `corrupted: true`
  - `error: 'ARCHIVE_FILE_MISSING'`
  - Error message: `The archived PDF report file is missing from permanent storage.`
  - `INTEGRITY_FAILED` event appended to audit trail.

---

## 5. Storage-Level WORM & Retention Evaluation

### 5.1 S3 Object Lock Evaluation

| S3 Object Lock Feature | Governance Mode | Compliance Mode | Recommended Production Configuration |
| :--- | :--- | :--- | :--- |
| **Root Account Override** | Yes (Users with `s3:BypassGovernanceRetention` can delete) | **NO** (No user, including AWS root account, can delete) | **Compliance Mode** |
| **Retention Period** | Configurable (e.g., 7 years) | Configurable (e.g., 7 years) | **7 Years (2,555 Days)** |
| **Legal Hold** | Available independently | Available independently | **Enabled for Litigated Cases** |
| **Versioning Requirement** | Mandatory | Mandatory | **Permanently Enabled** |
| **Audit Compliance** | SEC Rule 17a-4, FINRA, CFTC | SEC Rule 17a-4(f), FINRA 4511, RBI Cyber Security | **Compliance Mode Meets All Standards** |

### 5.2 Legal Hold Capability
In banking operations, cases subject to dispute, NPA recovery, or CBI/ED investigations require indefinite preservation beyond the standard 7-year retention period.
- Under S3 Object Lock, a **Legal Hold** can be placed on `report_{caseId}_v{version}.pdf` via:
  ```bash
  aws s3api put-object-legal-hold \
    --bucket gcr-bank-valuation-archive-prod \
    --key SBI/2026/20261101/v2/report_20261101_v2.pdf \
    --legal-hold Status=ON
  ```
- While Legal Hold is `ON`, the object cannot be deleted under any circumstance until an authorized Compliance Officer explicitly removes the hold.

### 5.3 Storage Access-Control Configuration

To restrict write and delete permissions in production:
1. **S3 Bucket Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "DenyArchiveDeletion",
         "Effect": "Deny",
         "Principal": "*",
         "Action": [
           "s3:DeleteObject",
           "s3:DeleteObjectVersion"
         ],
         "Resource": "arn:aws:s3:::gcr-bank-valuation-archive-prod/*"
       }
     ]
   }
   ```
2. **KMS Key Policy**:
   Encryption key managed in AWS KMS with rotation enabled. The application principal possesses `kms:GenerateDataKey` and `kms:Decrypt`, but lacks `kms:ScheduleKeyDeletion`.

---

## 6. Formal WORM Compliance Status

> [!WARNING]
> **Strict Regulatory Disclaimer:**  
> In compliance with strict audit rules, **WORM compliance is NOT claimed for the local testing environment**.  
> The current staging environment relies on local APFS POSIX read-only attributes (`chmod 0444`) and software-level HMAC cryptographic verification. True hardware/cloud WORM compliance can only be certified once AWS S3 Object Lock in Compliance Mode has been physically provisioned, configured, and tested in the live production cloud environment.
