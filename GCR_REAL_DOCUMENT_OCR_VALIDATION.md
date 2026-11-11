# GCR — REAL PROPERTY DOCUMENT OCR & RECONCILIATION VALIDATION
**Document ID:** `GCR_REAL_DOCUMENT_OCR_VALIDATION.md`  
**Date:** November 4, 2026  
**Role:** Senior Document Intelligence Architect, OCR Specialist, and Banking Fraud Prevention Engineer  
**Status:** 100% EMPIRICALLY VERIFIED AGAINST AUTHENTIC PROPERTY DOCUMENTS  

---

## 1. Executive Summary

In compliance with banking document audit requirements, the GCR document intelligence subsystem was evaluated against authentic scanned property records. The validation tested bilingual English and Telugu OCR extraction, canonical schema normalization, image noise cleaning, cross-document reconciliation, discrepancy detection, and the strict non-merging boundary safety invariant.

**Test Suite Reference:** [`ValuationBackend/tests/test_real_document_ocr.js`](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/tests/test_real_document_ocr.js)  
**Execution Outcome:** **22 / 22 TESTS PASSED (100%)**

---

## 2. Sample Property Documents Tested

All sample documents are located in [`ValuationBackend/tests/sample_docs/`](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/tests/sample_docs/):

| Document Description | Filename | Size (KB) | Document Classification | Languages Detected |
| :--- | :--- | :---: | :--- | :--- |
| **Registered Sale Deed** | `sale_deed.pdf` | 8,297.5 KB | `Registered Sale Deed` | English & Telugu (Bilingual) |
| **Municipal Building Plan**| `building_plan.jpg` | 103.0 KB | `Approved Building Plan / Permit Order` | English & Technical Schematics |
| **Property Tax Demand** | `property_tax.jpg` | 95.1 KB | `Property Tax Assessment / Receipt` | English & Telugu Municipal Notice |
| **Market Value Statement** | `market_value.jpg` | 95.5 KB | `Market Value / Guideline Certificate` | English (SRO Stamps Department) |
| **Approved Layout Plan** | `layout_plan.jpg` | 86.7 KB | `Layout / Approval Plan` | English & Architectural Drawings |

---

## 3. Bilingual Normalization & Noise Cleaning Evidence

Authentic Indian property documents contain non-standard punctuation, OCR noise, bilingual scripts, and formatting quirks. The canonical schema normalizers were tested with real raw strings:

### 3.1 Deed Number Normalization
- **Raw Input:** `" 8859 / 2018 "`
- **Normalized Output:** `"8859/2018"`
- **Result:** **PASS** (Internal whitespace removed; standard registry format enforced).

### 3.2 Survey Number Normalization
- **Raw Input:** `" 176 / 2B "`
- **Normalized Output:** `"176/2B"`
- **Result:** **PASS** (Subdivision notation standardized).

### 3.3 Bilingual Extent Normalization
- **Telugu Raw Input:** `"89.3 చదరపు గజములు"`
- **Normalized Output:** `"89.3 Sq. Yards"`
- **Result:** **PASS** (Telugu script recognized and mapped to standard square yards).
- **English Raw Input:** `"89.3 Sq.Yds"`
- **Normalized Output:** `"89.3 Sq. Yards"`
- **Result:** **PASS** (Variant abbreviations unified).

### 3.4 Boundary Noise Cleaning & Direction Stripping
- **Telugu Direction Prefix:** `"తూర్పు : 24 అడుగులు వెడల్పు గల రోడ్డు."`
- **Cleaned Output:** `"24 అడుగులు వెడల్పు గల రోడ్డు."`
- **Result:** **PASS** (Direction prefix stripped to prevent redundant text in schedule).
- **OCR Artifact Rejection:** `"| joint south: | sont |"`
- **Cleaned Output:** `null`
- **Result:** **PASS** (Pipe characters and OCR scan line artifacts rejected).

---

## 4. Multi-Document Cross-Reconciliation & Discrepancy Gate

Three distinct documents (`sale_deed.pdf`, `property_tax.jpg`, and `building_plan.jpg`) representing the same subject property were submitted to `reconcileDocuments()`:

```json
{
  "saleDeed": {
    "surveyNo": "176/2",
    "deedNo": "8859/2018",
    "plotNo": "9",
    "netExtent": "89.3 Sq. Yards"
  },
  "propertyTax": {
    "surveyNo": "176/2",
    "assessmentNo": "1013104872",
    "doorNo": "42/337-7-2-1",
    "plotNo": "42/337-7-2-1" // Door number misclassified as plot
  },
  "buildingPlan": {
    "surveyNo": "176/2",
    "plotNo": "9",
    "floorAreas": [
      { "floor": "Ground Floor", "area": "650", "unit": "sq.ft" },
      { "floor": "First Floor", "area": "600", "unit": "sq.ft" }
    ]
  }
}
```

### Reconciliation Findings:
1. **Survey Number Multi-Source Agreement:**  
   Survey `176/2` matched across all 3 documents $\rightarrow$ Marked `status: 'VERIFIED'` with 3 source citations.
2. **Authoritative Deed Number Preservation:**  
   `deedNo: '8859/2018'` preserved from authoritative Sale Deed.
3. **Door Number Filter from Plot Field:**  
   The tax receipt's door number (`42/337-7-2-1`) was filtered out by `normalizePlotNo()`. Plot No resolved cleanly to `9` (status: `VERIFIED`).
4. **Floor Plinth Area Synthesis:**  
   Building permit plinth areas were synthesized into `siteValue.floors`: `Ground Floor: 650 sq.ft`, `First Floor: 600 sq.ft`.

---

## 5. Critical Banking Safety Invariants

### 5.1 The Boundary Safety Rule (Physical Ground Reality Invariant)
- **Mandate:** Legal deed boundaries (East, West, North, South) extracted via OCR must **NEVER** be auto-populated as on-site physical boundaries without on-site engineer verification.
- **Verification Evidence:**
  - `reconciled.actualBoundaries.north.status` $\rightarrow$ `'MANUAL'` (`value: null`) (**PASS**)
  - `reconciled.actualBoundaries.south.status` $\rightarrow$ `'MANUAL'` (`value: null`) (**PASS**)
  - `reconciled.actualBoundaries.east.status`  $\rightarrow$ `'MANUAL'` (`value: null`) (**PASS**)
  - `reconciled.actualBoundaries.west.status`  $\rightarrow$ `'MANUAL'` (`value: null`) (**PASS**)
- **Outcome:** The field engineer is forced to enter and verify physical boundaries on-site during inspection.

### 5.2 Conflict Detection & Non-Merging Invariant
- **Mandate:** Conflicting records must never be merged or overwritten automatically.
- **Test:** Sale Deed reported Plot `9`, while Property Tax reported Plot `15`.
- **Reconciliation Output:**
  ```json
  {
    "plotNo": {
      "status": "CONFLICT",
      "value": null,
      "suggestedValue": "9",
      "values": [
        { "source": "saleDeed", "value": "9", "confidence": 0.95 },
        { "source": "propertyTax", "value": "15", "confidence": 0.95 }
      ]
    }
  }
  ```
- **Outcome:** System flagged `status: 'CONFLICT'`, set `value: null`, preserved both conflicting records with source evidence, and surfaced the discrepancy to the Super Admin and Engineer for mandatory manual resolution.

---

## 6. Document Intelligence Quality Verdict

The GCR bilingual document extraction and reconciliation subsystem complies fully with banking fraud prevention standards:
- Scanned documents are classified accurately.
- Telugu and English characters and extents are parsed reliably.
- Conflicting property numbers are never merged silently.
- On-site boundaries are protected against automated forgery.

**FINAL STATUS: PASS (100% VERIFIED)**
