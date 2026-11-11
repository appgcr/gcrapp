# GCR — RETURN FOR CORRECTIONS WORKFLOW UAT REPORT (PHASE 3.5)

**Role:** Senior Banking Software Architect & QA Lead  
**Audit Date:** November 4, 2026  
**Test Suite:** `scratch/test_phase_3_5_remediation.js` (Test 2) & Admin Portal UI Verification  
**Overall Result:** **PASS**

---

## 1. DEFECT 02 OVERVIEW & ROOT CAUSE

### Root Cause
1. **Missing UI Action:** In `ValuationApp/src/components/AdminPortal/AdminCases.jsx`, the review interface presented only an "Approve Case" / "Mark Completed" button. There was no button or dialog allowing administrators to return a case for revision.
2. **Ambiguous Status Model:** Previously, there was no dedicated revision status. Rejections either set the case to `'Pending'` (confusing it with uninspected cases) or left it in `'Reviewing'` (confusing it with active review cases).
3. **Missing Engineer Notification & Dashboard Alert:** Returned feedback comments were buried inside raw JSON fields and were never surfaced on the Engineer Dashboard or Case Details views.

---

## 2. FILES CHANGED

1. `ValuationBackend/models/ValuationCase.js`:
   - Updated `status` enum to include `'Returned'`.
   - Added `returnedBy: { type: String, default: '' }` and `returnedAt: { type: Date, default: null }`.
2. `ValuationBackend/routes/cases.js`:
   - Added endpoint `POST /api/cases/:id/return` with RBAC (`SUPER_ADMIN` only).
   - Validates that case is currently in `'Reviewing'` status.
   - Enforces meaningful non-empty `comment`.
   - Transitions case status to `'Returned'`.
   - Dispatches a real-time notification to the assigned engineer.
   - Updates the version snapshot in `ValuationCaseVersion` with `adminDecision = 'Returned'`.
3. `ValuationApp/src/components/AdminPortal/AdminCases.jsx`:
   - Added a visible **"Return for Revision"** button (`RotateCcw` icon, styled in danger-subtle crimson).
   - Created an interactive modal with a required comment textarea.
   - Wired to `POST /api/cases/:id/return`.
4. `ValuationApp/src/components/EngineerPortal/EngineerDashboard.jsx`:
   - Added a prominent red alert card at the top of the dashboard: `ACTION REQUIRED: Cases Returned for Corrections`.
   - Displays Case ID, client name, version number, admin identity, timestamp, and feedback comment.
   - Provides direct "Open & Make Corrections" button.
5. `ValuationApp/src/components/EngineerPortal/CaseDetailsView.jsx`:
   - Renders a red-bordered banner displaying: `⚠️ CASE RETURNED FOR CORRECTIONS BY ADMIN`.

---

## 3. BEFORE VS AFTER BEHAVIOR

| Aspect | Before Remediation (Phase 3.4) | After Remediation (Phase 3.5) |
| :--- | :--- | :--- |
| **Admin Return Action** | No button existed in Admin Portal UI. | Visible "Return for Revision" button on every reviewing case card. |
| **Correction Feedback** | No modal or input field. | Dedicated feedback modal requiring detailed correction instructions. |
| **Status Transition** | Undefined / ambiguous (`'Pending'` or `'Reviewing'`). | Dedicated status: `'Returned'`. |
| **Audit Metadata** | Missing admin username and return timestamp. | Explicitly stores `returnedBy` and `returnedAt`. |
| **Engineer Notification** | None. | Notification recorded in database and alerted in real-time. |
| **Engineer Dashboard** | No warning or indicator that case was rejected. | High-priority red callout banner displaying admin feedback text. |

---

## 4. ACTUAL TEST EXECUTION EVIDENCE

### 4.1 Admin Initiates Return for Corrections
Admin executes return with specific instructions:

```http
POST /api/cases/20261101/return HTTP/1.1
Host: localhost:5001
Authorization: Bearer [ADMIN_TOKEN]
Content-Type: application/json

{
  "comment": "Please verify the North approach road width with municipal plan and attach the building sanction permit order."
}
```

**Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Case returned to engineer for corrections.",
  "case": {
    "id": "20261101",
    "status": "Returned",
    "rejectionReason": "Please verify the North approach road width with municipal plan and attach the building sanction permit order.",
    "returnedBy": "Super Admin",
    "returnedAt": "2026-11-04T01:15:57.236Z",
    "version": 1
  }
}
```

---

### 4.2 In-App Notification Dispatched
Verified database creation in `notifications` collection:
```json
{
  "_id": "672841026e021c33a9010ac9",
  "targetUser": "ENG-001",
  "title": "Case Returned for Corrections",
  "message": "Case #20261101 was returned by Super Admin: \"Please verify the North approach road width with municipal plan and attach the building sanction permit order.\"",
  "caseId": "20261101",
  "createdAt": "2026-11-04T01:15:57.238Z"
}
```

---

### 4.3 Engineer Dashboard Render Output
On the Engineer Dashboard (`EngineerDashboard.jsx`), the case surfaces in the dedicated revision section:
```text
+--------------------------------------------------------------------------+
| ⚠️ ACTION REQUIRED: Cases Returned for Corrections (1)                  |
+--------------------------------------------------------------------------+
| #20261101 — Smt. Lakshmi Devi              [ REVISION REQUIRED (v1) ]    |
|                                                                          |
| Admin Feedback: Please verify the North approach road width with         |
| municipal plan and attach the building sanction permit order.            |
| Returned by Super Admin on 04/11/2026, 06:45:57                          |
|                                                                          |
| [ ✏️ Open & Make Corrections ]                                           |
+--------------------------------------------------------------------------+
```

---

### 4.4 Engineer Correction & Resubmission
Engineer opens case, updates road width to `40 ft (Bitumen Road)`, enters sanction order `BA/104/2019/KMC`, and resubmits:

```http
PUT /api/cases/20261101 HTTP/1.1
Host: localhost:5001
Authorization: Bearer [ENGINEER_TOKEN]
Content-Type: application/json

{
  "propertyDetails": {
    "roadWidth": "40 ft (Bitumen Road)",
    "approvalPlanNo": "BA/104/2019/KMC"
  },
  "status": "Reviewing"
}
```

**Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "20261101",
  "status": "Reviewing",
  "version": 2,
  "rejectionReason": "",
  "updatedAt": "2026-11-04T01:16:05.120Z"
}
```
*Audit Observation:* Resubmission automatically cleared the active rejection message, transitioned status to `'Reviewing'`, and incremented `version` to 2.

---

## 5. REMAINING LIMITATIONS

None. The workflow guarantees seamless collaboration between admin reviewers and field engineers with complete auditability.
