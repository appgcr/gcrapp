# GCR — SIGNING KEY MANAGEMENT, KEYRING ROTATION & KMS INTERFACE REPORT
**Document ID:** `GCR_SIGNING_KEY_ROTATION_REPORT.md`  
**Phase:** 3.5.5.2 — Critical Security Remediation (Findings F-02 & F-03)  
**Role:** Principal Application Security Engineer, Cryptographic Systems Architect, and Banking Records Security Specialist  
**Implementation Date:** November 4, 2026  
**Status:** IMPLEMENTED, FULLY VERIFIED & EMPIRICALLY GROUNDED  

---

## 1. Executive Summary

In Phase 3.5.5.1, the independent security audit discovered two major cryptographic key management vulnerabilities:
1. **Finding F-02 (Hardcoded Signing-Key Fallback):** `reportArchiveService.js` had a hardcoded HMAC signing secret fallback string (`'gcr_enterprise_immutable_archive_signing_key_2026'`) in source code. If environment variables were omitted or unset, the application silently fell back to this shared static secret.
2. **Finding F-03 (Missing Signing-Key Rotation & Keyring Support):** The signing subsystem only supported a single global key without version identifiers (`keyId`). Rotating keys would immediately break verification for all historical report archives, or force an impermissible re-signing and tampering of historical files.

Under Phase 3.5.5.2, both vulnerabilities were comprehensively remediated in `ValuationBackend/services/reportArchiveService.js` and `ValuationBackend/models/ReportArchive.js`:
- **Complete Fallback Removal & Fail-Secure Policy:** Every hardcoded secret fallback has been permanently removed. If the active signing key is missing from the environment, the engine throws an immediate, fatal `ARCHIVE_SECURITY_ERROR`.
- **Versioned Keyring Architecture:** Every manifest and database archive record now explicitly stores a `keyId`. Verification dynamically resolves the key associated with the manifest's `keyId`.
- **Historical Report Verifiability:** Rotating keys changes only the active signing key for *new* submissions; historical archives remain 100% verifiable against historical verification keys in the keyring.
- **Enterprise Asymmetric KMS Adapter:** A modular abstraction (`KmsSignerAdapter`) was implemented, preparing the system for AWS KMS / GCP Cloud KMS asymmetric RSA-PSS / ECDSA signing without provisioning cloud resources or incurring costs in development.

---

## 2. Technical Architecture & Implementation

### 2.1 Complete Removal of Hardcoded Secrets (Finding F-02)

In the previous codebase, `getSigningKey()` contained:
```javascript
// VULNERABLE CODE (REMOVED)
return process.env.ARCHIVE_SIGNING_KEY || 'gcr_enterprise_immutable_archive_signing_key_2026';
```

This allowed insecure deployments where developers or administrators failed to set the secret in production, resulting in known-key vulnerabilities.

#### Remediated Implementation:
The secret lookup was rewritten in `reportArchiveService.js` to strictly enforce configured environment credentials:

```javascript
function getKeyring() {
  const keyring = {};
  if (process.env.ARCHIVE_KEYRING) {
    try {
      const parsed = JSON.parse(process.env.ARCHIVE_KEYRING);
      Object.assign(keyring, parsed);
    } catch (e) {
      console.error('[ARCHIVE KEYRING] Failed to parse ARCHIVE_KEYRING JSON:', e.message);
    }
  }
  const activeKeyId = process.env.ARCHIVE_SIGNING_KEY_ID || 'gcr-2026-k1';
  const activeKey = process.env.ARCHIVE_SIGNING_KEY;
  if (activeKey) {
    keyring[activeKeyId] = activeKey;
  }
  return { keyring, activeKeyId };
}

function getActiveSigningKey() {
  const { keyring, activeKeyId } = getKeyring();
  const key = keyring[activeKeyId];
  if (!key) {
    throw new Error(
      `ARCHIVE_SECURITY_ERROR: Archive signing key '${activeKeyId}' is not configured in the environment keyring. Hardcoded key fallback is strictly disabled.`
    );
  }
  return { keyId: activeKeyId, secret: key };
}
```

#### Security Properties Enforced:
1. **Fail-Secure Default:** Missing environment keys immediately throw `ARCHIVE_SECURITY_ERROR`. The application refuses to sign or create archives with compromised or unconfigured secrets.
2. **Zero Secret Leakage:** Signing keys are never printed in application logs, audit trail entries, error messages, or client-facing HTTP payloads.
3. **Environment Separation:** Dev, staging, and prod configurations require distinct keys in `.env`. Example templates are documented in `.env.development.example` with clear instructions to provide cryptographically random 256-bit entropy.

---

### 2.2 Versioned Key Management & Keyring Resolution (Finding F-03)

To ensure banking records immutability across multi-year lifecycles, signing keys must be versioned. The system implements a dual-mode keyring:
1. **Active Key:** Defined via `ARCHIVE_SIGNING_KEY_ID` and `ARCHIVE_SIGNING_KEY`. Used exclusively for newly archived reports.
2. **Historical Keyring:** Defined via `ARCHIVE_KEYRING` JSON string containing historical key IDs mapped to their respective secrets:
   ```json
   {
     "gcr-2025-k0": "historical_secret_for_2025_archives...",
     "gcr-2026-k1": "current_active_secret_for_2026_archives..."
   }
   ```

#### Manifest Key Identification:
Every manifest file (`manifest_{caseId}_v{version}.json`) includes the key ID under `tamperProtection`:
```json
{
  "manifestVersion": "GCR_SEC_ARCHIVE_V1",
  "caseId": "20261101",
  "version": 1,
  "tamperProtection": {
    "algorithm": "HMAC-SHA256",
    "keyId": "gcr-2026-k1",
    "digitalSignature": "d38cf6b7e0bb0f81d1e44f8ea0e83b8764a8560ff72e50529d4d54620572e921"
  }
}
```

The Mongoose schema (`ReportArchive.js`) was updated to index and persist `keyId`:
```javascript
keyId: {
  type: String,
  required: true,
  default: 'gcr-2026-k1',
  index: true
}
```

#### Historical Verification Resolution:
When retrieving or auditing an archived report, `getVerificationKey(keyId)` resolves the exact key ID that originally signed the document:
```javascript
function getVerificationKey(keyId) {
  const { keyring } = getKeyring();
  const key = keyring[keyId];
  if (!key) {
    throw new Error(
      `ARCHIVE_KEY_UNKNOWN: Verification key for keyId '${keyId}' was not found in the configured keyring.`
    );
  }
  return key;
}
```

If a document references an unknown key ID (or a revoked key not present in the keyring), the retrieval engine rejects the report with `ARCHIVE_KEY_UNKNOWN` and logs an integrity failure in the audit trail.

---

### 2.3 Preparation for AWS KMS Asymmetric Signing

In compliance with Phase 3.5.5.2 requirements, an interface adapter was constructed to allow drop-in migration to AWS KMS (or GCP Cloud KMS) asymmetric hardware-backed keys without requiring architectural refactoring:

```javascript
class KmsSignerAdapter {
  constructor(config = {}) {
    this.keyId = config.keyId || process.env.ARCHIVE_KMS_KEY_ID;
    this.region = config.region || process.env.AWS_REGION || 'ap-south-1';
    this.algorithm = config.algorithm || 'RSASSA_PSS_SHA_256';
    this.enabled = !!(process.env.ARCHIVE_USE_KMS === 'true' && this.keyId);
  }

  async sign(canonicalPayload) {
    if (!this.enabled) {
      throw new Error('KMS signing adapter invoked but ARCHIVE_USE_KMS is not enabled.');
    }
    // AWS KMS SignCommand interface specification
    // Inputs: KeyId, Message: Buffer.from(canonicalPayload), SigningAlgorithm: this.algorithm
    // Returns: { signature: response.Signature.toString('hex'), keyId: this.keyId }
    throw new Error('AWS KMS client not initialized in offline development environment.');
  }

  async verify(canonicalPayload, signatureHex, keyId) {
    if (!this.enabled) {
      throw new Error('KMS verification adapter invoked but ARCHIVE_USE_KMS is not enabled.');
    }
    // AWS KMS VerifyCommand interface specification
    // Inputs: KeyId, Message: Buffer.from(canonicalPayload), Signature: Buffer.from(signatureHex, 'hex')
    // Returns: boolean
    throw new Error('AWS KMS client not initialized in offline development environment.');
  }
}
```

**Cloud Policy Adherence:** The KMS adapter remains dormant in the development environment. No AWS KMS keys were provisioned, no AWS API calls are made, and zero paid cloud costs were incurred.

---

## 3. Key Lifecycle Procedures

### 3.1 Controlled Key Rotation Procedure

When security policy mandates rotating the archive signing key (e.g., annual rotation, or administrative changeover):

1. **Generate New Key Secret:**
   Generate 256 bits of cryptographically secure random entropy:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Update Historical Keyring:**
   Add the old active key to `ARCHIVE_KEYRING` JSON along with its `keyId` (e.g., `"gcr-2026-k1"`).
3. **Set New Active Key:**
   Set `ARCHIVE_SIGNING_KEY_ID` to the new version identifier (e.g., `gcr-2027-k1`) and `ARCHIVE_SIGNING_KEY` to the newly generated secret.
4. **Deploy Environment Variables:**
   Restart the application service with the updated configuration.
5. **Validation Verification:**
   - Submit a new report or test case: confirm it signs with `gcr-2027-k1`.
   - Retrieve historical reports (e.g., `v1` signed with `gcr-2026-k1`): confirm verification passes seamlessly via the keyring lookup.
6. **Strict Banking Rule:**
   **Never re-sign historical reports.** Historical binaries and manifests must never be modified or re-generated merely because a key rotation event occurred.

### 3.2 Key Backup and Disaster Recovery Procedure

1. **Air-Gapped Backup:**
   Keyring JSON and active signing keys must be exported to an encrypted offline storage medium (e.g., hardware security module or dual-custody encrypted vault) protected by Shamir's Secret Sharing or multi-party authorization.
2. **Key Recovery:**
   In a disaster recovery scenario where server configuration is rebuilt from cold storage, the `ARCHIVE_KEYRING` and active signing keys are restored into the environment before bringing the `ValuationBackend` online.
3. **Integrity Validation Post-Recovery:**
   Run `test_phase_3_5_5_2_remediation.js` to ensure the restored keyring verifies existing historical archives without any signature mismatches.

### 3.3 Key Revocation Procedure

If a signing key is suspected of compromise:
1. **Immediate Quarantine:**
   Remove the compromised key from `ARCHIVE_SIGNING_KEY` immediately. Rotate `ARCHIVE_SIGNING_KEY_ID` to an emergency key (`gcr-2026-k2-emergency`).
2. **Taint Identification:**
   Query MongoDB `ReportArchive` collection for all records created using the compromised `keyId` during the suspected compromise window:
   ```javascript
   db.reportarchives.find({ keyId: 'compromised-key-id', createdAt: { $gte: compromiseStartTime } })
   ```
3. **Audit Trail Flagging:**
   Append a `SECURITY_ALERT_KEY_COMPROMISED` event to the audit trail of affected records.
4. **Removal from Keyring:**
   Removing the key from `ARCHIVE_KEYRING` causes any future access to return `ARCHIVE_KEY_UNKNOWN`, safely preventing the serving of unverified or suspect records until an executive security disposition is made.

---

## 4. Empirical Test Evidence

Key management and rotation functionality were validated via automated test cases in `test_phase_3_5_5_2_remediation.js`:

| Test ID | Test Scenario | Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TEST-KEY-01** | Missing Signing Key Fail-Secure | Unset `ARCHIVE_SIGNING_KEY` and `ARCHIVE_KEYRING`, attempt `getActiveSigningKey()` | Throws `ARCHIVE_SECURITY_ERROR`, no fallback | Caught `ARCHIVE_SECURITY_ERROR: ... Hardcoded key fallback is strictly disabled.` | **PASS** |
| **TEST-KEY-02** | Unknown Key ID Rejection | Request report manifest referencing `keyId: "unknown-key-999"` | Rejection with `ARCHIVE_KEY_UNKNOWN` | `ARCHIVE_KEY_UNKNOWN: Verification key for keyId 'unknown-key-999' was not found in the configured keyring.` | **PASS** |
| **TEST-KEY-03** | Keyring Resolution & Key Rotation | Sign manifest with `k1`, rotate active key to `k2`, add `k1` to keyring; verify both | Both historical and new manifests verify successfully | Historical manifest verified with `k1`; new manifest signed and verified with `k2` | **PASS** |
| **TEST-KEY-04** | Historical Binary Preservation Across Rotation | Verify historical report binaries (`v1`, `v2`) before and after key rotation | Binaries remain 100% byte-for-byte identical; SHA-256 unchanged | Checksums identical (`Buffer.equals: true`) | **PASS** |

---

## 5. Conclusion & Security Sign-Off

The GCR signing key management subsystem now complies with institutional banking records standards:
- Hardcoded signing keys have been eliminated.
- Versioned key IDs are permanently bound to signed manifests and database records.
- Seamless rotation is supported via multi-key keyring dictionaries.
- Historical reports retain permanent verifiability without dangerous document re-signing.
- An extensible KMS interface is established for cloud production environments.
