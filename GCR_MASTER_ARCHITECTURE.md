# GCR — MASTER SYSTEM ARCHITECTURE SPECIFICATION
**Document ID:** `GCR_MASTER_ARCHITECTURE.md`  
**Date:** November 4, 2026  
**Role:** Principal Software Architect, Banking Domain Specialist, Senior Android Engineer, Full-Stack Engineering Lead, DevOps Architect, and Cybersecurity Specialist  
**Status:** COMPLETE ARCHITECTURAL DEFINITION  

---

## 1. High-Level Ecosystem Topology

The GCR Banking Property Valuation Management Ecosystem is a multi-tier, distributed system engineered for bank-grade property inspections, automated document intelligence, mathematically verifiable valuation calculations, authentic multi-bank report generation, and cryptographically signed immutable archival.

```
+----------------------------------------------------------------------------------------------------+
|                                    GCR ECOSYSTEM TOPOLOGY                                          |
+----------------------------------------------------------------------------------------------------+
                                      
      [ FIELD ENGINEER ]                                      [ SUPER ADMIN ]
      Native Android App                                      React Admin Portal
      (Kotlin, Jetpack Compose, Material 3)                   (React 18, Vite 5, Lucide)
      BiometricPrompt & Keystore Security                     Responsive Web Dashboard
             |                                                       |
             | HTTPS / TLS 1.3 (REST API)                            | HTTPS / TLS 1.3 (REST API)
             v                                                       v
+----------------------------------------------------------------------------------------------------+
|                                   GCR BACKEND API GATEWAY                                         |
|                           Express.js / Node.js Engine (Port 5001)                                 |
|                                                                                                    |
|  [ Auth & RBAC ]        [ Case Lifecycle ]        [ Valuation Engine ]     [ Archival Service ]   |
|  - JWT Validation       - State Machine           - Land / Building        - 6-Stage Manifest     |
|  - Bcrypt Hashing       - Assignment Rules        - Depreciation Math      - HMAC-SHA256 Signer   |
|  - WebAuthn Passkeys    - Return with Remarks     - Parity Verifier        - Keyring Manager      |
|  - Biometric Flags      - Approval Versioning     - Word Amount Sync       - Physical File Verif  |
+----------------------------------------------------------------------------------------------------+
             |                                    |                                  |
             v                                    v                                  v
+------------------------+             +------------------------+         +-------------------------+
|     MONGODB STORE      |             |     OCR MICROSERVICE   |         |   IMMUTABLE FILE STORE  |
| (Mongoose 8.5 Schemas) |             |  Python / Tesseract    |         | Persistent Volume / S3  |
| - valuationcases       |             | - Bilingual (EN + TEL) |         | - DOCX Report Binaries  |
| - caseversions         |             | - Clarity Filter (CV2) |         | - PDF Report Binaries   |
| - reportarchives       |             | - Extent Normalizer    |         | - Signed Manifests      |
| - users & attendance   |             | - Conflict Engine      |         | - SHA-256 Checksums     |
+------------------------+             +------------------------+         +-------------------------+
```

---

## 2. End-to-End Business Workflow (Step 1 to Step 8)

The system adheres strictly to banking inspection and valuation governance:

### Step 1: Case Creation & Assignment (Super Admin)
- **Minimal Required Fields:**
  1. Applicant / Borrower Name
  2. Property Location / Address
  3. Contact Mobile Number
  4. Assigned Field Engineer Selection
- **Bank Selection:** Bank selection is strictly **optional** at initial creation. Admin may leave bank unassigned or select a panel bank (e.g., SBI, APGB, Canara, Union).
- **Document Policy:** The Super Admin is **never forced** to upload legal documents at case creation; documents are gathered during field inspection or uploaded when available.
- **Initial State:** Case transitions to `Assigned` status with sequential case numbering.

### Step 2: Engineer Login & Attendance Clock-In
- **Authentication:** Field engineer logs into `GCRNativeAndroid` using credentials or biometric fingerprint/face via `BiometricPrompt`.
- **Authoritative Attendance Clock-In:**
  - Captures high-accuracy GPS coordinates (`latitude`, `longitude`, `accuracy`).
  - Captures live attendance selfie.
  - Generates authoritative server timestamp.
  - Rejects duplicate clock-in on the same day (`HTTP 400`).

### Step 3: Original Property Document Upload
- **Accepted Formats:** PDF, JPEG, PNG.
- **Document Categories Supported:**
  - Registered Sale Deed / Parent Deeds
  - Encumbrance Certificate (EC)
  - Approved Building Plan & Permit
  - Property Tax Receipts / Municipal Demand Notices
  - Market Value Certificate
  - Title Link Documents
  - Site Photographs & Geotagged Surroundings
- **Security Guard:** Never assumes that every uploaded document belongs to the same property. Each document is classified and verified independently.

### Step 4: Document Intelligence, Bilingual OCR & Discrepancy Gate
- **OCR Engine:** Tesseract OCR supporting English (`eng`) and Telugu (`tel`) language models, augmented by image clarity thresholding.
- **Canonical Schema Normalization:**
  - Deed Numbers (e.g., `8859 / 2018` $\rightarrow$ `8859/2018`)
  - Survey Numbers (e.g., `176 / 2B` $\rightarrow$ `176/2B`)
  - Plot Numbers (distinguishes door numbers from plot labels)
  - Extents (e.g., Telugu `89.3 చదరపు గజములు` $\rightarrow$ `89.3 Sq. Yards`, English `89.3 Sq.Yds` $\rightarrow$ `89.3 Sq. Yards`)
- **Cross-Document Discrepancy Detection:**
  - Cross-references Deed owner names vs Tax assessment names.
  - Cross-references Survey numbers across Sale Deed and Encumbrance Certificate.
  - Flags tax receipts as non-conclusive proof of ownership.
- **CRITICAL BOUNDARY SAFETY RULE:**
  - Legal deed boundaries (East, West, North, South) are recorded under `legalBoundaries`.
  - On-site boundaries (`actualBoundaries`) are **NEVER auto-filled from documents**. They remain strictly `MANUAL` and require the field engineer to personally verify physical ground reality during on-site inspection.

### Step 5: Dynamic Property Inspection Forms
Structured inspection workflows tailored to 6 distinct banking property categories:
1. **Independent Residential House:** Plinth area, roof construction, joineries, flooring, interior/exterior finishes, building age, depreciation, compound wall, water supply, electricals.
2. **Apartment / Flat:** Undivided share of land (UDS), flat super built-up area, carpet area, floor level, parking, lift, common amenities, society maintenance.
3. **Open Residential Site:** Layout approval (DTCP/HMDA/Municipal), plot dimensions, frontage, approach road width, conversion status, high-tension wire clearance.
4. **Agricultural Land:** Survey subdivision, crop classification, irrigation source (borewell/canal), soil type, access rights, revenue record passbook details.
5. **Commercial Building:** Rental yield, structural loading, commercial zoning approval, fire NOC, parking ratio, multi-tenant distribution.
6. **Industrial Property:** Industrial shed plinth, power allocation (HT/LT), industrial estate approval, pollution clearance, heavy vehicular access.

### Step 6: Property Valuation Engine
The mathematical engine guarantees 100% reproducible calculation tracing across Kotlin, Node.js, and React:
- $\text{Land Value} = \text{Land Area} \times \text{Applicable Unit Rate}$
- $\text{Replacement Cost} = \sum (\text{Floor Plinth Area} \times \text{Construction Rate})$
- $\text{Depreciation} = \text{Replacement Cost} \times \frac{\text{Age}}{\text{Lifespan}}$ (Straight-line)
- $\text{Net Building Value} = \text{Replacement Cost} - \text{Depreciation}$
- $\text{Extra Amenities} = \text{Itemized Amenities Sum}$
- $\text{Fair Market Value (FMV)} = \text{Land Value} + \text{Net Building Value} + \text{Amenities}$
- $\text{Realizable Value} = \text{FMV} \times 90\%$
- $\text{Distress Sale Value} = \text{Realizable Value} \times 85\% = \text{FMV} \times 76.5\%$
- $\text{Insurable Value} = \text{Replacement Cost} + \text{Amenities}$ (Excluding Land)
- Figures and Indian Rupee amounts in words are synchronized at runtime.

### Step 7: Engineer Digital Signing & Case Submission
- Engineer validates all required sections, site photographs, GPS logs, and calculation summaries.
- Captures on-screen touch signature on HTML5 / Android Canvas.
- Submits completed inspection. Case status transitions to `Completed (Under Review)`.
- Dispatches operational notification to Super Admin.

### Step 8: Super Admin Review, Correction or Approval
- Super Admin opens case in Portal.
- Inspects uploaded legal deeds, OCR extractions, and conflict alerts.
- Reviews itemized valuation breakdown.
- **Workflow Path A (Return for Corrections):**
  - Admin clicks "Return for Corrections".
  - System enforces mandatory feedback remarks.
  - Status updates to `Returned for Corrections`.
  - Engineer receives immediate notification and correction task.
- **Workflow Path B (Approval & Archival):**
  - Admin clicks "Approve Valuation".
  - System increments authoritative case version number (e.g., `v2`).
  - Calls `archiveCaseReport()`: generates DOCX and complete PDF, computes SHA-256 checksums, signs manifest JSON, and saves immutable archive record.
  - Case status updates to `Approved`.

---

## 3. Cryptographic Security & Archival Architecture

Following Phase 3.5.5.2 remediation, the report archival subsystem implements a strict **6-stage Manifest Self-Verification and Metadata Cross-Check Pipeline**:

```
[ INCOMING REPORT RETRIEVAL ]
             |
             v
[ Stage 1: File Existence ] --------> If missing on disk: HALT with ARCHIVE_FILE_MISSING
             |
             v
[ Stage 2: Schema Validation ] -----> If malformed JSON: HALT with ARCHIVE_MANIFEST_CORRUPTED
             |
             v
[ Stage 3: Keyring Lookup ] ---------> If keyId unknown: HALT with ARCHIVE_KEY_UNKNOWN
             |
             v
[ Stage 4: Manifest Payload ] -------> Construct Canonical String FROM MANIFEST JSON!
             |
             v
[ Stage 5: Signature Check ] --------> HMAC-SHA256(ManifestPayload, Key) == Signature?
             |                         If mismatch: HALT with ARCHIVE_MANIFEST_TAMPERED
             v
[ Stage 6: Database Cross-Check ] ---> Manifest Fields == MongoDB Document Fields?
             |                         If mismatch: HALT with ARCHIVE_METADATA_INCONSISTENT
             v
[ Stage 7: Binary SHA-256 Check ] ---> CryptoHash(PhysicalFile) == Manifest.sha256?
             |                         If mismatch: HALT with ARCHIVE_FILE_CORRUPTED
             v
[ VERIFIED REPORT DELIVERED TO CLIENT ]
```

### Key Management Policies:
1. **Zero Hardcoded Secrets:** Fallback secret strings are eliminated. Unset environment variables throw `ARCHIVE_SECURITY_ERROR`.
2. **Versioned Key IDs:** Every signed manifest contains `tamperProtection.keyId` (e.g., `gcr-2026-k1`).
3. **Multi-Key Keyring:** `ARCHIVE_KEYRING` JSON stores historical keys; new submissions sign with `ARCHIVE_SIGNING_KEY_ID`.
4. **Historical Binaries Preservation:** Historical report files are never modified, re-signed, or regenerated upon key rotation.

---

## 4. Native Android Architecture (`GCRNativeAndroid`)

The native engineer app is built using modern Android architecture guidelines:
- **Presentation:** 100% Jetpack Compose with Material 3 UI design system.
- **Architecture Pattern:** MVVM (Model-View-ViewModel) with Kotlin Coroutines and `StateFlow`.
- **Security:**
  - `TokenManager` stores JWT and refresh tokens using AndroidX `EncryptedSharedPreferences` backed by hardware-backed Android Keystore.
  - `BiometricPrompt` supports fingerprint and face authentication with device credential fallback.
- **Camera & Media:** CameraX implementation with lifecycle binding for site photograph capture.
- **Location:** Google Play Services `FusedLocationProviderClient` with high-accuracy priority.
- **Offline Resilience:** Room SQLite database structure coupled with Android WorkManager for background queue synchronization when network is intermittent.

---

## 5. Storage Durability & Disaster Recovery Architecture

- **Development Storage:** Local APFS persistent volume mounts under `ValuationBackend/uploads/reports/`.
- **Production Target Architecture:**
  - Object storage (AWS S3 in Mumbai `ap-south-1` or equivalent Indian data center) with S3 Versioning.
  - S3 Object Lock in Compliance Mode with configured retention periods (e.g., 8-year statutory banking records retention).
  - Storage-level Read-Only / Legal Hold controls preventing deletion or overwriting by application credentials.
  - Automated daily MongoDB mongodump snapshots with off-site replication.

---

## 6. Access Control & API Security

- **Authentication:** HMAC-SHA256 JWT tokens with 24-hour expiration.
- **Password Security:** Salted bcrypt hashing with work factor $\ge 10$.
- **Role-Based Access Control (RBAC):**
  - `SUPER_ADMIN`: Full case management, user creation/deletion, system settings, case approval/return, archive audit.
  - `ENGINEER`: Assigned case viewing, attendance capture, document/photo upload, inspection form completion, digital signature submission. Field engineers are strictly forbidden from approving their own valuation reports or creating/deleting user accounts.
- **Input Validation:** Strict type checking, file size limits (50MB max upload), MIME type validation, and parameterized database queries preventing NoSQL injection.
