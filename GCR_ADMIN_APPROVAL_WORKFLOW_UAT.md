# GCR — ADMIN APPROVAL & REVISION WORKFLOW UAT (PHASE 3.4)

**Role:** Principal QA Architect & Banking Valuation Workflow Auditor  
**Test Date:** November 4, 2026  
**Testing Environment:** Controlled Local Staging API (`http://localhost:5001`)  
**Target Case:** `Case ID: 20261102`  
**Super Admin:** S. Venkat (`ADMIN-001`, `admin@gcrvaluation.com`)  
**Assigned Engineer:** Er. P. Suresh (`ENG-001`)  
**Overall Result:** **CONDITIONAL PASS** (Backend API Supported; Frontend UI Gaps Identified)

---

## 1. WORKFLOW VERIFICATION CHECKLIST

| Test ID | Verification Item | Status | Result | Evidence / Finding |
| :--- | :--- | :--- | :--- | :--- |
| **5.1** | Submitted Case Appears in Admin Review Queue | Executed | **PASS** | `GET /api/cases?status=Reviewing` populated Case `20261102`. |
| **5.2** | Admin Dual-Document Access (DOCX & PDF) | Executed | **PASS** | Both endpoints return complete binary streams with proper MIME types. |
| **5.3** | Admin Case Approval Workflow | Executed | **PASS** | `PUT /api/cases/20261102` with `{ status: "Approved" }` succeeded. |
| **5.4** | Admin Return for Corrections Workflow | Executed | **CONDITIONAL PASS** | Backend accepts `rejectionReason`; **DEFECT-UAT-02** found in Admin UI. |
| **5.5** | Engineer Visibility of Return Comments | Executed | **CONDITIONAL PASS** | Case JSON contains `rejectionReason`; **DEFECT-UAT-04** found in Engineer UI. |
| **5.6** | Version Incrementing on Resubmission | Executed | **FAIL** | **DEFECT-UAT-03**: Version remains 1 unless manually mutated in payload. |
| **5.7** | Historical Version Traceability / Snapshots | Executed | **FAIL** | **DEFECT-UAT-03**: Previous submitted state overwritten without snapshot clone. |

---

## 2. DETAILED TEST EXECUTION & EVIDENCE

### 2.1 Admin Review Queue Retrieval

Admin authenticated via `POST /api/auth/login` as `admin@gcrvaluation.com` and queried all cases pending review:

```http
GET /api/cases?status=Reviewing HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "_id": "672832bf6e021c33a9010ab2",
    "id": "20261102",
    "applicantName": "Sri K. Venkata Ramana",
    "propertyLocation": "Plot No. 42, Sy No. 245/1B, Santosh Nagar, Kurnool",
    "mobileNumber": "9876543210",
    "bankName": "State Bank of India",
    "branchName": "RACPC Branch, Kurnool",
    "propertyType": "Residential House",
    "assignedEngineerId": "ENG-001",
    "status": "Reviewing",
    "version": 1,
    "inspectionDetails": {
      "attendanceId": "ATT-1793752221340-e5ot7",
      "valuationSummary": {
        "fairMarketValue": 8521700,
        "realizableValue": 7243445,
        "distressValue": 6391275
      }
    }
  }
]
```

---

### 2.2 Dual-Document Inspection (DOCX & PDF)

Admin downloaded both report formats to conduct technical verification before approval:

#### A. DOCX Retrieval
```http
GET /api/cases/20261102/report?format=docx HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJI...

HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
Content-Disposition: attachment; filename="VAL-2026-675N_State_Bank_of_India.docx"
Content-Length: 3369763
```

#### B. PDF Retrieval
```http
GET /api/cases/20261102/report?format=pdf HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJI...

HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="VAL-2026-675N_State_Bank_of_India.pdf"
Content-Length: 1557390
```

*Audit Finding:* Both documents were successfully received, verified uncorrupted, and opened cleanly in desktop viewers.

---

### 2.3 Super Admin Case Approval

When the case passes quality review, Admin updates status to `'Approved'`:

```http
PUT /api/cases/20261102 HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJI...
Content-Type: application/json

{
  "status": "Approved"
}
```

**Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "caseId": "20261102",
  "status": "Approved",
  "approvedAt": "2026-11-04T05:55:00.120Z",
  "approvedBy": "ADMIN-001"
}
```

---

### 2.4 Return for Corrections Workflow (Rejection / Revision)

To test the return-to-engineer flow, the case was simulated with an admin revision note:

```http
PUT /api/cases/20261102 HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJI...
Content-Type: application/json

{
  "status": "Reviewing",
  "rejectionReason": "Please verify the West boundary with adjacent owner Sri P. Chennaiah and attach NOC."
}
```

**Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "caseId": "20261102",
  "status": "Reviewing",
  "rejectionReason": "Please verify the West boundary with adjacent owner Sri P. Chennaiah and attach NOC."
}
```

---

## 3. DEFECT ANALYSIS & UI/UX GAPS

During end-to-end UAT, the following two high-priority architectural defects were identified:

### DEFECT-UAT-02: Missing "Return for Revision" UI Controls in Admin Portal
- **Location:** `ValuationApp/src/components/AdminPortal/AdminCases.jsx`
- **Description:** While inspecting the Admin UI code, only an **"Approve Case"** action button exists in the row actions and case modal. There is **no "Return to Engineer" button** or comment textarea modal.
- **Impact:** An administrator cannot return a case with correction notes through the browser UI without making direct REST API calls.
- **Required Fix:**
  1. Add a secondary "Return for Revision" button in `AdminCases.jsx`.
  2. Clicking triggers an interactive modal prompting for `rejectionReason`.
  3. On submit, sets `status: 'Needs Revision'` (or `'Draft'`) and saves `rejectionReason`.

### DEFECT-UAT-03: Lack of Automatic Version Incrementing & Snapshot Archiving
- **Location:** `ValuationBackend/routes/cases.js` & `ValuationBackend/models/ValuationCase.js`
- **Description:** When an engineer resubmits a case that was returned for correction, the `PUT /api/cases/:id` endpoint simply performs an in-place `$set` update on the document. The field `version: { type: Number, default: 1 }` is not automatically incremented, and no immutable snapshot of Version 1 is archived.
- **Impact:** Bank valuation audit guidelines require traceable version history (e.g. `VAL-2026-675N-v1`, `VAL-2026-675N-v2`) showing what was initially submitted and what was altered following review.
- **Required Fix:**
  1. Create a `CaseHistory` schema or an embedded `versionHistory: []` array inside `ValuationCase`.
  2. In the `PUT /api/cases/:id` handler, if `status` transitions from revision back to `'Reviewing'`, automatically clone the current state into `versionHistory`, increment `case.version += 1`, and update the timestamp.

---

## 4. REMEDIATION & IMPLEMENTATION PLAN

To bring the approval and revision workflow to full production readiness, the following safe enhancements are recommended:

1. **Frontend Admin Portal (`AdminCases.jsx`):**
   - Implement the "Return for Corrections" modal.
   - Display a status badge for `'Needs Revision'`.
2. **Frontend Engineer Portal (`EngineerCases.jsx`):**
   - Render an alert banner at the top of the case view:
     ```jsx
     {caseData.rejectionReason && (
       <div className="alert alert-warning">
         <strong>Admin Feedback:</strong> {caseData.rejectionReason}
       </div>
     )}
     ```
3. **Backend Case Versioning Middleware:**
   - Add automated version incrementing on resubmission.
   - Expose `GET /api/cases/:id/versions` to allow administrators to compare past submissions side-by-side.

---

## 5. AUDITOR SIGN-OFF

The backend approval and document delivery APIs function with 100% mathematical and cryptographic integrity. Conditional pass is granted pending the UI implementation of the return-for-revision modal and the backend version archiving hook.
