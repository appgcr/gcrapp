# GCR — HMAC KEY MANAGEMENT & CRYPTOGRAPHIC THREAT AUDIT
**Document ID:** `GCR_HMAC_KEY_MANAGEMENT_AUDIT.md`  
**Phase:** 3.5.5.1 — Independent Acceptance Audit  
**Role:** Independent Banking Systems Security Auditor, Cryptographic Storage Specialist, and Disaster Recovery Architect  
**Audit Date:** November 4, 2026  
**Status:** COMPLETE & EMPIRICALLY VERIFIED  

---

## 1. Executive Summary

Phase 3.5.5 introduced independent cryptographic manifests signed via HMAC-SHA256 to protect report archives against direct database manipulation. This audit evaluated the security posture of the signing key, its isolation from untrusted actors, its exposure profile across application tiers, and the threat of signature forgery by privileged users.

---

## 2. Key Storage & Resolution Hierarchy

### 2.1 Code Implementation Analysis
In `ValuationBackend/services/reportArchiveService.js`, the secret signing key is resolved via:

```javascript
// Secret signing key for independent manifest tamper protection
function getSigningKey() {
  return process.env.ARCHIVE_SIGNING_KEY || process.env.JWT_SECRET || 'gcr_enterprise_immutable_archive_signing_key_2026';
}
```

The resolution order operates as follows:
1. **Tier 1 (Target Production)**: `process.env.ARCHIVE_SIGNING_KEY`
2. **Tier 2 (Fallback Staging)**: `process.env.JWT_SECRET`
3. **Tier 3 (Default Local Dev)**: Hardcoded string `'gcr_enterprise_immutable_archive_signing_key_2026'`

### 2.2 Security Findings on Key Storage
- **Separation from Archive Binaries**: **VERIFIED**. The signing key is not written to the report binaries (`.docx` or `.pdf`) or disk manifests (`manifest_*.json`).
- **Separation from Database**: **VERIFIED**. The signing key is not stored in MongoDB collections (`reportarchives`, `cases`, `users`, or `appconfigs`). Only the derived 64-character hex signature is persisted.
- **Exposure in Logs & Traces**: **VERIFIED**. A scan of system logs, console outputs, and debug dumps confirmed zero key leakage during signing, verification, or error handling.
- **Exposure in Client Bundles**: **VERIFIED**. A recursive search of `ValuationApp` frontend source files, build artifacts, and webpack/vite bundles confirmed no references to `ARCHIVE_SIGNING_KEY`.
- **Default Hardcoded Fallback Risk**: **HIGH RISK**. If `ARCHIVE_SIGNING_KEY` is omitted from the deployment environment, the engine defaults to the repository string. Any individual with read access to the source code can derive the key and compute valid signatures.

---

## 3. Threat Assessment: Administrator Forgery Capabilities

### 3.1 Threat Scenario A: Administrator with Database & Archive Folder Access Only
*Scenario: A rogue database administrator or storage operator has direct write access to MongoDB (`mongo` shell) and filesystem write access to `uploads/reports/`, but NO access to the backend process environment or server shell.*

- **Can they forge a valid signature?**: **NO (Conditional on Secret Isolation)**.
- **Technical Evidence**:
  - The signature is calculated as:
    ```
    HMAC-SHA256(key, caseId | version | docxSha256 | pdfSha256 | templateId | approvalStatus | approvedBy | approvedAt)
    ```
  - Because HMAC-SHA256 is cryptographically one-way and collision-resistant, an adversary cannot reverse-engineer the secret key from historical signatures.
  - If the attacker modifies a PDF on disk and changes the `pdfSha256` in MongoDB, they cannot generate the matching signature. Upon download, `verifyArchiveManifest` uses `crypto.timingSafeEqual` and rejects the forgery with `ARCHIVE_MANIFEST_TAMPERED`.
  - **Empirical Test 1.3**: Forged metadata with invalid signature was strictly rejected (`forgedRejected: true`).

### 3.2 Threat Scenario B: Administrator with Host / Container Shell Access
*Scenario: A system administrator has shell access (`ssh` / `docker exec`) to the backend application container.*

- **Can they forge a valid signature?**: **YES**.
- **Technical Vulnerability**:
  - Because HMAC is a **symmetric algorithm**, the backend server must hold the private secret key in order to verify incoming downloads.
  - Any actor with access to the container environment can execute `printenv ARCHIVE_SIGNING_KEY` or inspect the process memory, extract the key, and generate valid signatures for arbitrary fraudulent documents.
  - **Banking Limitation**: Symmetric HMAC does not provide true legal non-repudiation between the software vendor, the bank, and system operators.

---

## 4. Key Rotation & Disaster Recovery Evaluation

### 4.1 Key Rotation Capability
- **Current Status**: **NOT IMPLEMENTED IN CODE**.
- **Vulnerability**:
  - `reportArchiveService.js` contains no key version identifier (`kid`), key identifier header, or multi-key lookup table.
  - **Empirical Test 1.4**: When manifest verification was tested against an alternate key (simulating key rotation), the existing manifest was immediately rejected as tampered.
  - If the operations team rotates `ARCHIVE_SIGNING_KEY` in production, **all historical reports generated prior to rotation will immediately become un-downloadable and report as corrupted**.

### 4.2 Target Production Key Management Architecture
To achieve Tier-1 banking compliance, the architecture must transition from symmetric HMAC to asymmetric digital signatures backed by AWS KMS or HashiCorp Vault:

```
[ Valuation Backend Service ]                     [ AWS KMS / HashiCorp Vault HSM ]
          |                                                       |
          |--- Request Signature (caseId, hashes, admin) -------->| (Private Key never leaves HSM)
          |<-- Returns Asymmetric Signature (ECDSA / RSA-PSS) ---|
          |
          |--- Verification using Public Key Cached Locally -----> (No secret on backend host)
```

1. **Algorithm**: ECDSA (`secp256r1` / NIST P-256) or RSA-PSS 4096-bit.
2. **Key Custody**: Managed Hardware Security Module (FIPS 140-2 Level 3). Application administrators cannot extract private keys.
3. **Key Versioning**: Embed `kid: "gcr-key-2026-v1"` in manifest header. Verification selects the appropriate public certificate from the historical trust store.

---

## 5. Signature Rejection Test Evidence

The following empirical tests were conducted in isolated sandbox environments:

```
[TEST 1.1] HMAC Valid Signature Verification: PASS
   Details: Valid 64-character hex signature verified via crypto.timingSafeEqual

[TEST 1.2] HMAC Missing/Empty Signature Rejection: PASS
   Details: Empty string, null, and truncated signatures handled safely and rejected

[TEST 1.3] HMAC Forged/Tampered Metadata Signature Rejection: PASS
   Details: Altered approval status (Pending -> Approved) detected; signature mismatch caught

[TEST 1.4] HMAC Key Rotation Isolation: PASS (Verification of key mismatch)
   Details: Alternate signing key produces distinct HMAC; rejected by current key
```

---

## 6. Audit Recommendations

1. **Immediate (Pre-Launch)**: Ensure `ARCHIVE_SIGNING_KEY` is mandatory in deployment scripts; remove the hardcoded code fallback so the application fails to start if the environment key is unset.
2. **Intermediate**: Implement manifest schema versioning and a Keyring lookup structure (`keyId`) to enable seamless key rotation without breaking historical archives.
3. **Target Production**: Provision AWS KMS Asymmetric Signing Key with IAM policy denying `kms:DeleteKey` and auditing all signing operations in AWS CloudTrail.
