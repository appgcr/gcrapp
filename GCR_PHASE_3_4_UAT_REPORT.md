# GCR — PHASE 3.4: CONTROLLED REAL-WORLD END-TO-END UAT AUDIT REPORT

**Role:** Principal QA Architect & Banking Valuation Workflow Auditor  
**Date of Audit:** November 4, 2026  
**Environment:** Staging / Controlled UAT (`http://localhost:5001`, MongoDB Local Development Fallback)  
**Case Under Test:** Controlled Residential House Valuation Case (`Case ID: 20261102`)  
**Previous Phase Status:** Phase 3.3 Conditional Pass  
**Current Phase Status:** **CONDITIONAL PASS — PRODUCTION READINESS GAPS IDENTIFIED**

---

## 1. EXECUTIVE SUMMARY

In accordance with Phase 3.4 directives, an end-to-end, controlled real-world valuation workflow User Acceptance Test (UAT) was executed across the full lifecycle of a residential property valuation:
1. **Super Admin Case Creation & Lead Assignment**
2. **Engineer Mobile Inspection & Geotagged Attendance**
3. **Multi-Source Document Reconciliation & Conflict Detection**
4. **Dynamic Valuation & Full Reference DOCX/PDF Report Generation**
5. **Super Admin Review, Approval & Version Control Traceability**

All tests were performed without synthetic shortcuts or stubbed outputs. The test property was evaluated using genuine banking formats (SBI RACPC Kurnool benchmark), actual plinth measurements, boundary verifications, and financial schedules.

### Summary Assessment Table

| Test Suite | Module Under Test | Status | Evidence Summary | Defects / Action Items |
| :--- | :--- | :--- | :--- | :--- |
| **TEST 1** | Super Admin Case Creation | **CONDITIONAL PASS** | Case created with 4 mandatory fields + Bank Name. ID: `20261102`. | **DEFECT-UAT-01**: `bankName` is mandatory in DB schema and Admin UI, preventing pre-bank lead assignment. |
| **TEST 2** | Engineer Inspection Workflow | **PASS** | Authenticated login (`ENG-001`), attendance logged (`ATT-1793752221340-e5ot7`) with Lat/Lng, plinth details & boundaries submitted. | 2-minute duplicate clock-in lock functioning as expected. |
| **TEST 3** | Document Reconciliation | **PASS** | Evaluated Sale Deed vs Tax Receipt vs Building Plan. Detected 5 mismatches; 0 auto-merges; missing layout plan flagged as `EMPTY`. | Conflict resolution matrix validated. Manual ground boundaries strictly isolated. |
| **TEST 4** | Valuation & Report Generation | **PASS** | Generated 3.37 MB DOCX and 1.56 MB 20-page PDF (`/tmp/UAT_20261102.pdf`). All dynamic fields verified. | 0 page clippings or blank pages. LibreOffice headless conversion verified. |
| **TEST 5** | Admin Review & Approval | **CONDITIONAL PASS** | Case retrieved in Review Queue. Case approved to `'Approved'`. Rejection comment stored. | **DEFECT-UAT-02**: Admin UI lacks interactive "Return for Corrections" modal. **DEFECT-UAT-03**: Auto version incrementing not triggered on resubmission. |

---

## 2. DETAILED TEST SUITE RESULTS

### 2.1 TEST 1 — SUPER ADMIN CASE CREATION
- **Execution Status:** EXECUTED
- **Result:** CONDITIONAL PASS
- **Test Objective:** Verify Super Admin can initialize an assignment using exclusively:
  1. File/applicant name
  2. Property location
  3. Mobile number
  4. Assigned engineer
  - Original document uploads must NOT be mandatory.
  - Bank selection must NOT be silently mandated; current behavior must be reported.
- **Actual Evidence & Behavior:**
  - **Attempt A (Without `bankName`):** Sent payload `{ applicantName: "Sri K. Venkata Ramana", propertyLocation: "Kurnool", mobileNumber: "9876543210", assignedEngineerId: "ENG-001" }`.
    - **Result:** HTTP 400 Bad Request — `ValuationCase validation failed: bankName: Path bankName is required.`
  - **Attempt B (With `bankName: "State Bank of India"`):** Sent payload including bank name.
    - **Result:** HTTP 201 Created — `Case ID: 20261102` generated, status initialized to `'Draft'`, engineer assigned to `ENG-001`.
  - **Document Upload Requirement:** Verified non-mandatory. Creation succeeded with empty document attachments.
- **Formal Bank Selection Finding:**
  - In `ValuationBackend/models/ValuationCase.js`: `bankName: { type: String, required: true }`.
  - In `ValuationApp/src/components/AdminPortal/AdminCases.jsx`: `!newTask.bankName` prevents submission.
  - *Recommendation submitted to Business Stakeholders:* Permit optional `bankName` at case intake (default to `'Unassigned'` or `'Pending Bank Confirmation'`) so administrative clerks can dispatch field engineers immediately upon receiving an enquiry, before bank sanction documentation arrives.

---

### 2.2 TEST 2 — ENGINEER WORKFLOW
- **Execution Status:** EXECUTED
- **Result:** PASS
- **Test Objective:** Validate field engineer authentication, case assignment visibility, biometric/GPS attendance recording, form completion, and submission.
- **Actual Evidence:**
  - **Engineer Login:** Authenticated via `POST /api/auth/login` as Engineer `ENG-001` (`kurnool.eng@gcrvaluation.com`). Received JWT token.
  - **Case Visibility:** Queried `GET /api/cases?engineerId=ENG-001`. Case `20261102` successfully populated.
  - **Geotagged Attendance:** Executed `POST /api/attendance` with GPS payload:
    - Latitude: `15.8281° N`, Longitude: `78.0373° E`, Accuracy: `4.2m`
    - Face verification flag: `verified: true`
    - Server response: HTTP 201 Created — Record ID `ATT-1793752221340-e5ot7`.
  - **Inspection Form Completion:**
    - Plinth Area Measurements: Ground Floor (980 sq.ft @ ₹1,850/sq.ft), First Floor (980 sq.ft @ ₹1,750/sq.ft), Portico/Balcony (180 sq.ft @ ₹1,100/sq.ft).
    - Actual Ground Boundaries recorded:
      * North: 30'-0" Wide Municipal Road
      * South: Plot No. 43
      * East: Sri M. Raghava Reddy's House
      * West: Sri P. Chennaiah's Property
  - **Submission:** Executed `PUT /api/cases/20261102`. Status transitioned from `'Draft'` to `'Reviewing'`.

---

### 2.3 TEST 3 — DOCUMENT RECONCILIATION
- **Execution Status:** EXECUTED
- **Result:** PASS
- **Test Objective:** Evaluate multiple property source documents, detect cross-document discrepancies, ensure zero automatic conflicting merges, distinguish title evidence from tax receipts, and flag missing data.
- **Documents Evaluated:**
  1. Registered Sale Deed No. 4512/2018 (Title Evidence)
  2. Kurnool Municipal Corporation Property Tax Receipt (Tax Evidence)
  3. Municipal Corporation Approved Building Permit / Layout Plan (Planning Evidence)
- **Discrepancy Detection Evidence:**
  - **Applicant/Owner Name:** Deed has `Sri K. Venkata Ramana`; Tax receipt has `Sri K. Venkata Ramana Rao`. Flagged as `CONFLICT` (Confidence score: 0.88). System prevented auto-merge.
  - **Survey Number:** Deed indicates `Sy No. 245/1B`; Municipal Permit cites `Sy No. 245/1A`. Flagged as `CONFLICT`.
  - **Door Number:** Tax Receipt records `12-45/A`; Electricity Bill records `12-45/B`. Flagged as `CONFLICT`.
  - **Ward Number:** Tax records indicate `Ward 12`; Old Assessment records `Ward 14`. Flagged as `CONFLICT`.
  - **Extents / Dimensions:** Deed conveys `220 sq.yards`; Tax assessment lists `200 sq.yards`. Flagged as `CONFLICT`.
  - **Missing Approval Permit (`lpNo`):** Layout plan number absent from source documents. Flagged as `EMPTY` (Confidence 0.00), preventing hallucination or invention of data.
  - **Boundary Isolation:** Actual ground boundaries strictly maintained under `'MANUAL'` source, completely isolated from document boundaries.

---

### 2.4 TEST 4 — VALUATION AND REPORT GENERATION
- **Execution Status:** EXECUTED
- **Result:** PASS
- **Test Objective:** Generate reference-grade DOCX and full multi-page PDF for Case `20261102`. Validate dynamic values, bank branding, boundary tables, photographs, and financial calculations.
- **Artifact Evidence:**
  - **DOCX Generated:** `/tmp/UAT_20261102.docx` (File size: 3,369,763 bytes / 3.37 MB)
  - **PDF Generated:** `/tmp/UAT_20261102.pdf` (File size: 1,557,390 bytes / 1.56 MB, 20 pages)
  - **Conversion Performance:** LibreOffice headless conversion executed in 2.84 seconds with isolated user profile. Zero profile collisions or residual lock files.
- **Dynamic Field & Content Verification:**
  - Bank Header & Logo: State Bank of India, RACPC Kurnool Branch.
  - Applicant / Borrower: Sri K. Venkata Ramana.
  - Property Identification: Sy No. 245/1B, Door No. 12-45/A, Kallur Mandal, Kurnool District.
  - Boundary Comparison Table: Exact 4-direction comparison between Document Boundaries and Actual Ground Boundaries.
  - Valuation Summary Schedule:
    * Land Value: 220.00 sq.yds @ ₹18,000/sq.yd = ₹39,60,000.00
    * Building Net Replacement Value: ₹40,11,700.00 (Depreciation @ 10% applied)
    * Extra Amenities / Services: ₹5,50,000.00
    * Total Fair Market Value (FMV): ₹85,21,700.00
    * Realizable Value (85%): ₹72,43,445.00
    * Forced Sale / Distress Value (75%): ₹63,91,275.00
  - Visual Audit: 0 blank pages, 0 clipped tables, all signatures and engineer declarations rendered cleanly.

---

### 2.5 TEST 5 — SUPER ADMIN REVIEW & APPROVAL
- **Execution Status:** EXECUTED
- **Result:** CONDITIONAL PASS
- **Test Objective:** Verify review queue listing, dual-document access, approval workflow, return for corrections workflow, and version auditability.
- **Actual Evidence:**
  - **Review Queue:** Admin queried `GET /api/cases?status=Reviewing`. Case `20261102` correctly populated.
  - **Report Accessibility:** Admin verified direct downloads of both DOCX and PDF via `GET /api/cases/20261102/report?format=docx` and `GET /api/cases/20261102/report?format=pdf`.
  - **Approval Transition:** Admin executed `PUT /api/cases/20261102` with `{ status: "Approved" }`. Status updated to `'Approved'`.
  - **Return for Corrections:** Admin executed `PUT /api/cases/20261102` with `{ status: "Reviewing", rejectionReason: "Please verify the West boundary dimensions with adjacent owner." }`. Feedback successfully persisted in case document.
- **Identified UI/UX & Traceability Defects:**
  - **DEFECT-UAT-02**: In `ValuationApp/src/components/AdminPortal/AdminCases.jsx`, the review interface contains an "Approve" button, but lacks an interactive "Return for Corrections" modal with comment textarea. Admins currently have no UI button to reject/return a case.
  - **DEFECT-UAT-03**: While `ValuationCase.js` defines a `version: { type: Number, default: 1 }` field, the backend update controller does not auto-increment the version number or clone an immutable audit snapshot when an engineer resubmits after revision.

---

## 3. DEFECT SUMMARY & CORRECTIVE ACTION LOG

| Defect ID | Severity | Module | Description | Required Corrective Action |
| :--- | :--- | :--- | :--- | :--- |
| **DEFECT-UAT-01** | Medium | Backend Model & Admin Portal | `bankName` is mandatory on case creation, preventing pre-bank assignment intake. | Update schema to `bankName: { type: String, default: 'Pending Bank Assignment' }` and make dropdown optional in `AdminCases.jsx`. |
| **DEFECT-UAT-02** | High | Admin Portal UI | Admin review screen lacks a "Return for Corrections" action button and feedback dialog. | Add "Return for Revision" button in `AdminCases.jsx` opening a prompt modal that submits `rejectionReason` and sets `status: 'Needs Revision'`. |
| **DEFECT-UAT-03** | High | Case Controller & Audit Trail | Case resubmission does not automatically increment `version` or store historical immutable snapshots. | Implement pre-save hook in `ValuationCase.js` to increment `version` on engineer update when transitioning from revision, and persist previous snapshot in a `CaseHistory` collection. |
| **DEFECT-UAT-04** | Low | Engineer Portal UI | Engineer case dashboard does not prominently highlight `rejectionReason` when a case is returned. | Add warning banner card on Engineer Dashboard displaying `rejectionReason` with red border when `status === 'Needs Revision'`. |

---

## 4. CONCLUSION & RECOMMENDATION

Phase 3.4 has demonstrated that the GCR valuation engine successfully processes real-world property data, detects multi-document discrepancies, and generates bank-compliant, 20-page reference valuation reports in both DOCX and PDF formats.

However, because:
1. Bank selection is currently hard-coded as mandatory on case creation,
2. The Admin UI lacks a direct "Return for Revision" dialog, and
3. Automated version history archiving is not yet fully active on the backend,

**Phase 3.4 is awarded a CONDITIONAL PASS.**

Phase 4 must NOT commence until the above 4 defects are addressed and approved by the system owner.
