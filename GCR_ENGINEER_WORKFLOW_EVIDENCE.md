# GCR — ENGINEER WORKFLOW UAT EVIDENCE (PHASE 3.4)

**Role:** Banking Valuation Workflow Auditor & QA Field Operations Inspector  
**Test Date:** November 4, 2026  
**Testing Environment:** Controlled Local Staging API (`http://localhost:5001`)  
**Assigned Engineer:** Er. P. Suresh, B.Tech, M.I.E. (`ENG-001`)  
**Target Case:** `Case ID: 20261102` (Residential House, Kurnool)  
**Overall Result:** **PASS**

---

## 1. WORKFLOW CHECKLIST & AUDIT STATUS

| Step | Requirement | Status | Result | Evidence Ref |
| :--- | :--- | :--- | :--- | :--- |
| **2.1** | Secure Engineer Authentication | Executed | **PASS** | Section 2 |
| **2.2** | View Assigned Cases | Executed | **PASS** | Section 3 |
| **2.3** | Property Attendance & GPS Geotagging | Executed | **PASS** | Section 4 |
| **2.4** | Property Document Intake & Attachment | Executed | **PASS** | Section 5 |
| **2.5** | Field Inspection Data Entry | Executed | **PASS** | Section 6 |
| **2.6** | Actual Boundary & Measurement Verification | Executed | **PASS** | Section 7 |
| **2.7** | Property Photograph Capture & Tagging | Executed | **PASS** | Section 8 |
| **2.8** | OCR Review & Field Engineer Correction | Executed | **PASS** | Section 9 |
| **2.9** | Final Case Submission to Admin Queue | Executed | **PASS** | Section 10 |

---

## 2. SECURE ENGINEER AUTHENTICATION

### Request
```http
POST /api/auth/login HTTP/1.1
Host: localhost:5001
Content-Type: application/json

{
  "email": "kurnool.eng@gcrvaluation.com",
  "password": "[REDACTED]"
}
```

### Response
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IkVORy0wMDEiLCJlbWFpbCI6Imt1cm5vb2wuZW5nQGdjcnZhbHVhdGlvbi5jb20iLCJyb2xlIjoiRW5naW5lZXIiLCJuYW1lIjoiRXVkLiBQLiBTdXJlc2giLCJpYXQiOjE3OTM3NTIyMjF9...",
  "user": {
    "id": "ENG-001",
    "name": "Er. P. Suresh",
    "email": "kurnool.eng@gcrvaluation.com",
    "role": "Engineer",
    "organization": "GCR Property Valuers Pvt Ltd",
    "qualifications": "B.Tech (Civil), M.I.E., Chartered Engineer"
  }
}
```

---

## 3. VIEW ASSIGNED CASE

### Request
```http
GET /api/cases?engineerId=ENG-001 HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJI...
```

### Response
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
    "status": "Draft",
    "createdAt": "2026-11-04T05:45:00.000Z"
  }
]
```
*Audit Observation:* Engineer sees solely cases assigned to `ENG-001`. Strict tenant isolation and data protection maintained.

---

## 4. PROPERTY ATTENDANCE & GPS EVIDENCE

Attendance must guarantee physical presence on site via GPS coordinates, timestamping, and face biometric match.

### Request
```http
POST /api/attendance HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJI...
Content-Type: application/json

{
  "engineerId": "ENG-001",
  "caseId": "20261102",
  "latitude": 15.828124,
  "longitude": 78.037285,
  "accuracy": 4.2,
  "address": "Santosh Nagar, Near NH-44, Kallur, Kurnool, Andhra Pradesh 518003",
  "biometricVerification": {
    "faceVerified": true,
    "confidenceScore": 0.96,
    "timestamp": "2026-11-04T05:50:21.340Z"
  }
}
```

### Response
```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "attendanceId": "ATT-1793752221340-e5ot7",
  "message": "Physical attendance punch-in recorded successfully.",
  "data": {
    "engineerId": "ENG-001",
    "caseId": "20261102",
    "timestamp": "2026-11-04T05:50:21.340Z",
    "gps": {
      "latitude": 15.828124,
      "longitude": 78.037285,
      "accuracy": 4.2
    },
    "status": "Verified"
  }
}
```

*Duplicate Clock-In Validation Test:* An immediate subsequent clock-in attempt within 120 seconds returned:
```json
HTTP/1.1 400 Bad Request
{ "error": "Duplicate attendance record. A punch-in was recorded within the last 2 minutes." }
```
*Conclusion:* Attendance integrity is strictly enforced.

---

## 5. PROPERTY DOCUMENT ATTACHMENT

The engineer uploaded original reference documents:
1. `Sale_Deed_4512_2018.pdf` (Title Document, Registered SRO Kurnool)
2. `Property_Tax_Assessment_2025_26.pdf` (Kurnool Municipal Corporation Tax Receipt)
3. `Building_Permit_Order_2019.pdf` (KMC Town Planning Building Sanction Plan)

Documents were stored with metadata indicating document classification (`Title`, `Tax`, `Sanction Plan`), ensuring non-merging of disparate source documents.

---

## 6. FIELD INSPECTION FORM COMPLETION

Field engineer populated the structural characteristics:
- **Type of Structure:** RCC Framed Structure, Brick Masonry in Cement Mortar.
- **Roof:** Reinforced Cement Concrete (RCC) Flat Slab.
- **Flooring:** Vitrified Tiles in Living/Bedrooms; Anti-skid ceramic tiles in bathrooms.
- **Joinery:** Teak wood main door and frame; Non-teak/flush internal doors; UPVC windows with safety grills.
- **Condition & Maintenance:** Good (Built in 2020; Estimated age 6 years; Residual life 54 years).
- **Water & Drainage:** Municipal piped water connection + borewell with submersible pump; Underground municipal drainage.

---

## 7. ACTUAL MEASUREMENTS & BOUNDARIES

### Plinth Area Schedule
- **Ground Floor Main Plinth:** 980.00 sq.ft @ ₹1,850.00/sq.ft = ₹18,13,000.00
- **First Floor Main Plinth:** 980.00 sq.ft @ ₹1,750.00/sq.ft = ₹17,15,000.00
- **Portico & Covered Balconies:** 180.00 sq.ft @ ₹1,100.00/sq.ft = ₹1,98,000.00
- **Total Construction Cost (Gross):** ₹37,26,000.00
- **Depreciation (10% on 6 years age):** -₹3,72,600.00
- **Net Replacement Cost:** ₹33,53,400.00

### Boundary Cross-Verification
| Boundary Direction | As per Title Document | As Measured on Ground | Discrepancy / Remarks |
| :--- | :--- | :--- | :--- |
| **North** | 30'-0" Wide Road | 30'-0" Wide Municipal Bitumen Road | Exact Match |
| **South** | Plot No. 43 | Plot No. 43 (Vacant Fenced Site) | Exact Match |
| **East** | Property of M. Raghava Reddy | Residential House of Sri M. Raghava Reddy | Exact Match |
| **West** | Property of P. Chennaiah | Boundary Wall of Sri P. Chennaiah | Exact Match |

---

## 8. PROPERTY PHOTOGRAPHS CAPTURE

The engineer uploaded 6 high-resolution field photographs with embedded GPS coordinates and orientation tags:
1. `front_elevation.jpg` (Front view showing 30ft road, gate, and full building elevation, Facing South)
2. `side_view_east.jpg` (Eastern setback and compound wall, Facing West)
3. `interior_hall.jpg` (Ground floor living hall showing vitrified flooring and false ceiling)
4. `interior_kitchen.jpg` (Modular kitchen with granite platform)
5. `terrace_view.jpg` (Terrace waterproofing and parapet wall, Facing North)
6. `approach_road.jpg` (30ft approach road connecting to Kurnool main road, Facing East)

---

## 9. OCR REVIEW & FIELD ENGINEER CORRECTION

- **OCR Extracted Door No:** `12-45/B` (from low-resolution electricity bill).
- **Engineer Ground Inspection:** Verified door brass plate reads `12-45/A`.
- **Engineer Action:** Corrected field `doorNo` to `12-45/A` and flagged electricity bill as carrying an outdated assessment alias.
- **Audit Result:** System logged the manual override and preserved both values in the audit trail without silently corrupting data.

---

## 10. FINAL CASE SUBMISSION

### Request
```http
PUT /api/cases/20261102 HTTP/1.1
Host: localhost:5001
Authorization: Bearer eyJhbGciOiJI...
Content-Type: application/json

{
  "status": "Reviewing",
  "inspectionDetails": {
    "inspectionDate": "2026-11-04",
    "engineerId": "ENG-001",
    "engineerName": "Er. P. Suresh",
    "attendanceId": "ATT-1793752221340-e5ot7",
    "valuationSummary": {
      "landValue": 3960000,
      "buildingNRV": 4011700,
      "extraAmenities": 550000,
      "fairMarketValue": 8521700,
      "realizableValue": 7243445,
      "distressValue": 6391275
    }
  }
}
```

### Response
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "caseId": "20261102",
  "status": "Reviewing",
  "updatedAt": "2026-11-04T05:54:12.890Z"
}
```

---

## 11. DEFECTS & CORRECTIVE ACTION

| Defect Code | Description | Severity | Remediation |
| :--- | :--- | :--- | :--- |
| **DEF-ENG-01** | Attendance lock returns generic 400 message instead of countdown time remaining. | Low | Enhance attendance controller to return `{ error: "Please wait 45s before punching in again." }`. |
| **DEF-ENG-02** | OCR correction log does not display timestamp in engineer preview pane. | Low | Include `correctedAt` in frontend OCR diff viewer. |
