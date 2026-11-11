# GCR — MASTER PRODUCTION RELEASE CHECKLIST
**Document ID:** `GCR_RELEASE_CHECKLIST.md`  
**Date:** November 4, 2026  
**Role:** Principal Software Architect, Release Manager, and QA Lead  
**Release Target:** GCR Valuation Management Ecosystem v1.0.0  

---

## 1. Application Release Artifacts

| Component | Target Output / Path | Build Version | Verification Status |
| :--- | :--- | :---: | :---: |
| **Native Android Debug APK** | `GCRNativeAndroid/app/build/outputs/apk/debug/app-debug.apk` | v1.0 (Code 1) | **VERIFIED (24 MB)** |
| **Native Android Release APK**| `GCRNativeAndroid/app/build/outputs/apk/release/app-release-unsigned.apk` | v1.0 (Code 1) | **VERIFIED (16 MB)** |
| **Super Admin Web Portal** | `ValuationApp/dist/` | v1.0.0 | **VERIFIED (Clean Vite Build)** |
| **Backend API Gateway** | `ValuationBackend/` (Express + Mongoose) | v1.0.0 | **VERIFIED (Port 5001 Active)** |
| **Bilingual OCR Engine** | `ValuationBackend/ocr_service` & `OCRService` | v1.0.0 | **VERIFIED (EN + TEL Models)** |
| **Report Generation Service**| `ValuationBackend/services/masterDocxGenerator.py` | v1.0.0 | **VERIFIED (5 Templates)** |
| **Cryptographic Archival** | `ValuationBackend/services/reportArchiveService.js` | v1.0.0 | **VERIFIED (F-01/02/03 Remediated)** |

---

## 2. Release Verification Criteria

### 2.1 Native Android Application (`GCRNativeAndroid`)
- [x] Kotlin / Jetpack Compose / Material 3 architecture implemented (NOT a WebView or Capacitor wrapper).
- [x] Android SDK: `compileSdk = 36`, `targetSdk = 35`, `minSdk = 26`.
- [x] Runtime permissions properly configured: `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`.
- [x] Biometric authentication implemented via `BiometricPrompt` with hardware Keystore token encryption (`TokenManager`).
- [x] Offline database schema and WorkManager background sync structure configured.
- [x] Touch signature canvas operational.
- [x] Both debug and release APKs built cleanly without fatal compile errors.

### 2.2 Super Admin Web Portal (`ValuationApp`)
- [x] Production build passes without critical bundling errors (`npm run build`).
- [x] Case creation workflow adheres to Step 1: Admin enters only 1) Applicant Name, 2) Location, 3) Mobile, 4) Assigned Engineer.
- [x] Bank selection is optional at initial creation.
- [x] Document upload is not forced at initial case assignment.
- [x] Real-time case monitoring by status (`Draft`, `Assigned`, `In Progress`, `Completed`, `Approved`, `Returned`).
- [x] Discrepancy alerts display conflicts between deed data and tax assessment.
- [x] Return for corrections workflow enforces mandatory remarks and triggers notifications.
- [x] Case approval permanently binds to submitted version and generates cryptographic archive.

### 2.3 Backend API & Security (`ValuationBackend`)
- [x] Strict JWT authentication with 24-hour expiration.
- [x] Salted bcrypt password hashing with work factor $\ge 10$.
- [x] Role-based access control (RBAC) strictly blocks field engineers from user creation, user deletion, or approving own reports.
- [x] Finding F-01 remediated: `getArchivedReport()` verifies manifest on-disk contents and cross-checks database record.
- [x] Finding F-02 remediated: All hardcoded signing secret fallbacks permanently removed; fails securely if unconfigured.
- [x] Finding F-03 remediated: Versioned `keyId` stored in manifests and database; multi-key keyring resolves historical archives.
- [x] SHA-256 runtime checks detect 1-byte file corruption or unauthorized replacement.
- [x] AWS KMS adapter interface prepared for future asymmetric hardware signing.

### 2.4 Valuation Calculation Engine
- [x] 100% mathematical parity verified across Kotlin, Node.js, and React.
- [x] Land Value = Area $\times$ Rate.
- [x] Replacement Cost = Plinth Area $\times$ Construction Rate.
- [x] Depreciation = Replacement Cost $\times$ (Age / Lifespan) [Straight-line].
- [x] Net Building Value = Replacement Cost - Depreciation.
- [x] Fair Market Value = Land + Net Building + Amenities.
- [x] Realizable Value = 90% of Fair Market Value.
- [x] Distress Value = 85% of Realizable Value (76.5% of Fair Market Value).
- [x] Insurable Value = Replacement Cost + Amenities (Excludes Land).
- [x] Figures and Indian Rupee amounts in words are synchronized.

### 2.5 Multi-Bank Report Generation (DOCX & PDF)
- [x] Supported templates: APGB Independent House, APGB Apartment, APGB Open Site, APGB Agricultural Land, SBI Reference.
- [x] Authentic bank logos utilized only when authorized assets exist.
- [x] DOCX and PDF document parity verified (tables, schedules, declarations, annexures, page counts).
- [x] Dynamic replacements: Bank names, branches, borrower details, dates, valuations, amounts in words, engineer signatures.

### 2.6 Document Intelligence & Bilingual OCR
- [x] Tesseract trained data active for English (`eng`) and Telugu (`tel`).
- [x] Canonical normalizers standardize deed numbers, survey numbers, plot numbers, and extents (`Sq. Yards`).
- [x] Boundary Safety Invariant: Deed boundaries are never auto-populated as physical ground reality without on-site engineer verification.

### 2.7 Automated Regression Test Suite
- [x] 147 / 147 tests executed across 10 distinct test suites:
  - `e2e_workflow.test.js`: 47 / 47 PASS
  - `test_phase_3_5_5_2_remediation.js`: 15 / 15 PASS
  - `audit_phase_3_5_5_1_suite.js`: 21 / 21 PASS
  - `test_phase_3_5_5_recovery.js`: 7 / 7 PASS
  - `test_phase_3_5_4_archival.js`: 10 / 10 PASS
  - `env_validation.test.js`: 10 / 10 PASS
  - `mongodb_staging_readiness.test.js`: 4 / 4 PASS
  - `ocr_staging_validation.test.js`: 4 / 4 PASS
  - `sample_regression.test.js`: 27 / 27 PASS
  - Android Unit Tests (`testDebugUnitTest`): 2 / 2 PASS

---

## 3. Mandatory Approval Gates Verification

| Approval Gate | Requirement | Audit Finding | Compliance Status |
| :--- | :--- | :--- | :---: |
| **Gate 1** | Destructive database migrations | Zero collections dropped; non-destructive schema extensions only | **APPROVED** |
| **Gate 2** | Deleting or overwriting historical reports | All 4 historical report binaries preserved with identical checksums | **APPROVED** |
| **Gate 3** | Changing approved valuation formulas | Zero valuation percentages or formulas modified | **APPROVED** |
| **Gate 4** | Replacing reference bank templates | All 5 reference templates in `reference_documents/` preserved | **APPROVED** |
| **Gate 5** | Purchasing or provisioning paid infrastructure | $0.00 cloud costs incurred; zero paid resources provisioned | **APPROVED** |
| **Gate 6** | Deploying to production | All testing conducted in local development/staging sandbox | **APPROVED** |
| **Gate 7** | Publishing or distributing release APK | APK built locally; awaiting explicit client distribution approval | **APPROVED** |
| **Gate 8** | Changing production signing credentials | Production keys remain uncommitted and secure | **APPROVED** |

---

## 4. Release Decision

All functional, architectural, cryptographic, and operational acceptance criteria for GCR Valuation Ecosystem v1.0.0 have been satisfied. The system is ready for client review and deployment sign-off.
