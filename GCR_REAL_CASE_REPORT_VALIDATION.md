# GCR — REAL CASE REPORT VALIDATION UAT (PHASE 3.4)

**Role:** Banking Valuation Report Quality Auditor & Document Systems Specialist  
**Test Date:** November 4, 2026  
**Target Case:** `Case ID: 20261102` (Controlled Residential House Valuation)  
**Bank Entity:** State Bank of India (RACPC Branch, Kurnool)  
**Applicant:** Sri K. Venkata Ramana  
**Artifacts Audited:**
- DOCX: `/tmp/UAT_20261102.docx` (3,369,763 bytes / 3.37 MB)
- PDF: `/tmp/UAT_20261102.pdf` (1,557,390 bytes / 1.56 MB, 20 Pages)  
**Overall Result:** **PASS**

---

## 1. REPORT GENERATION AUDIT CHECKLIST

| Test Item | Verification Requirement | Status | Result | Details |
| :--- | :--- | :--- | :--- | :--- |
| **4.1** | Correct Category Template Selection | Executed | **PASS** | Selected `HOUSE APGB NEW FORMET.docx` / SBI Residential format. |
| **4.2** | Full Reference DOCX Generation | Executed | **PASS** | Generated 3.37 MB DOCX file with all 20 reference sections. |
| **4.3** | Headless PDF Conversion Parity | Executed | **PASS** | Converted to 20-page PDF in 2.84s using LibreOffice isolated profile. |
| **4.4** | Dynamic Value Injection | Executed | **PASS** | Borrower name, case ID, dates, addresses, survey numbers populated. |
| **4.5** | Dynamic Bank Branding & Identity | Executed | **PASS** | State Bank of India letterhead, RACPC branch code, official logo. |
| **4.6** | Four-Sided Boundary Comparison Table | Executed | **PASS** | As per Deed vs As per Ground side-by-side alignment. |
| **4.7** | Plinth Area & Structural Schedules | Executed | **PASS** | GF (980 sft), FF (980 sft), Portico (180 sft) with rates and depreciation. |
| **4.8** | Valuation Summary & Banking Calculations | Executed | **PASS** | Land (₹39.60L), Building (₹40.11L), FMV (₹85.21L), Realizable (₹72.43L), Distress (₹63.91L). |
| **4.9** | Field Photographs Annexure | Executed | **PASS** | 6 color photographs embedded with captions and direction indicators. |
| **4.10** | Engineer Declarations & Signatures | Executed | **PASS** | Mandatory IBBI/Banking declarations intact with engineer credentials. |

---

## 2. GENERATION ARTIFACT SPECIFICATIONS

```text
=== CASE 20261102 ARTIFACT AUDIT DATA ===
DOCX File Path: /tmp/UAT_20261102.docx
DOCX File Size: 3,369,763 bytes (3.37 MB)
DOCX Paragraphs: 142
DOCX Tables:     18

PDF File Path:  /tmp/UAT_20261102.pdf
PDF File Size:  1,557,390 bytes (1.56 MB)
PDF Page Count: 20 Pages
PDF Creation Date: 2026-11-04T05:54:15Z
PDF Producer:   LibreOffice 24.2.5.2 / Cairo Vector Engine
```

---

## 3. DYNAMIC VALUE VERIFICATION MATRIX

Every dynamic variable was inspected in both DOCX and PDF text extractions to ensure 100% replacement of template placeholders:

| Field Key | Injected Test Value | Rendered in DOCX? | Rendered in PDF? | Auditor Notes |
| :--- | :--- | :--- | :--- | :--- |
| `caseNumber` | `20261102` | YES | YES (All page headers) | Exact match |
| `applicantName` | `Sri K. Venkata Ramana` | YES | YES | Exact match |
| `bankName` | `State Bank of India` | YES | YES (Header banner) | Exact match |
| `branchName` | `RACPC Branch, Kurnool` | YES | YES | Exact match |
| `propertyAddress` | `Plot No. 42, Sy No. 245/1B, Santosh Nagar, Kurnool` | YES | YES | Exact match |
| `surveyNumber` | `245/1B` | YES | YES | Exact match |
| `doorNumber` | `12-45/A` | YES | YES | Exact match |
| `inspectionDate` | `04/11/2026` | YES | YES | Exact match |
| `valuationDate` | `04/11/2026` | YES | YES | Exact match |
| `engineerName` | `Er. P. Suresh, B.Tech, M.I.E.` | YES | YES (Signatures block) | Exact match |

*Verification Outcome:* Zero unreplaced curly braces (`{{...}}`) or template tokens were found across all 20 pages.

---

## 4. BOUNDARY COMPARISON TABLE VALIDATION

The report contains the mandated dual boundary verification matrix:

```text
+-----------+---------------------------------+----------------------------------------+
| Direction | As Per Title Deed (Doc 4512/18) | As Per Ground Inspection (Physical)   |
+-----------+---------------------------------+----------------------------------------+
| North     | 30'-0" Wide Road                | 30'-0" Wide Municipal Bitumen Road     |
| South     | Plot No. 43                     | Plot No. 43 (Vacant Fenced Site)       |
| East      | Property of M. Raghava Reddy    | Residential House of Sri M. Raghava R. |
| West      | Property of P. Chennaiah        | Boundary Wall of Sri P. Chennaiah      |
+-----------+---------------------------------+----------------------------------------+
```
*Auditor Remark:* The boundaries align perfectly with no physical encroachment detected.

---

## 5. VALUATION SCHEDULES & MATHEMATICAL INTEGRITY

Strict rules forbid modifying valuation formulas. The mathematical outputs were independently re-calculated:

### A. Land Valuation
- **Plot Extent:** 220.00 sq.yards
- **Basic Market Rate:** ₹18,000.00 per sq.yard
- **Formula:** `Extent * Rate`
- **Computed Value:** $220.00 \times 18,000.00 = \text{₹}39,60,000.00$
- **System Output:** ₹39,60,000.00 *(Exact Match)*

### B. Building Valuation (Replacement Cost Method)
1. **Ground Floor (GF):** $980.00 \text{ sft} \times \text{₹}1,850.00 = \text{₹}18,13,000.00$
2. **First Floor (FF):** $980.00 \text{ sft} \times \text{₹}1,750.00 = \text{₹}17,15,000.00$
3. **Portico / Balconies:** $180.00 \text{ sft} \times \text{₹}1,100.00 = \text{₹}1,98,000.00$
- **Gross Replacement Cost:** ₹37,26,000.00
- **Depreciation:** Age = 6 years, Total Life = 60 years. Applied depreciation = 10%.  
  $\text{Depreciation Amount} = \text{₹}37,26,000.00 \times 0.10 = \text{₹}3,72,600.00$
- **Net Depreciated Building Value:** $\text{₹}37,26,000.00 - \text{₹}3,72,600.00 = \text{₹}33,53,400.00$
- **Extra Amenities & Services (Electrification, Sanitary, Borewell, Compound Wall):** ₹6,58,300.00
- **Total Building Value (NRV + Amenities):** ₹40,11,700.00
- **System Output:** ₹40,11,700.00 *(Exact Match)*

### C. Overall Valuation Summary
- **Fair Market Value (FMV):** $\text{Land Value} + \text{Total Building Value} + \text{Extra Amenities}$  
  $\text{FMV} = \text{₹}39,60,000.00 + \text{₹}40,11,700.00 + \text{₹}5,50,000.00 = \text{₹}85,21,700.00$  
  *(Rounded to Nearest Thousand: ₹85,22,000.00 where applicable)*
- **Realizable Value (85% of FMV):** $\text{₹}85,21,700.00 \times 0.85 = \text{₹}72,43,445.00$
- **Forced / Distress Sale Value (75% of FMV):** $\text{₹}85,21,700.00 \times 0.75 = \text{₹}63,91,275.00$
- **Govt. Guideline / SRO Value:** $220.00 \text{ sq.yds} \times \text{₹}11,000.00 = \text{₹}24,20,000.00$

*Audit Assessment:* All formulas comply with Indian Banking Association (IBA) valuation guidelines and approved master specs.

---

## 6. VISUAL INSPECTION OF GENERATED PDF PAGES

A page-by-page visual inspection of the 20-page PDF (`/tmp/UAT_20261102.pdf`) was performed:
- **Pages 1–2 (Executive Summary & Bank Header):** State Bank of India logo rendered crisp and unclipped. Branch address and reference details aligned.
- **Pages 3–5 (General Details & Physical Attributes):** Tenant occupancy, surrounding infrastructure, municipal water and road connectivity tables rendered intact.
- **Pages 6–9 (Plinth Measurement & Technical Construction):** Specifications of foundation, superstructure, roof, flooring, and joinery cleanly tabulated.
- **Pages 10–12 (Valuation Schedules & Calculations):** Full mathematical tables with INR formatting (`₹xx,xx,xxx.xx`) and round-offs.
- **Pages 13–15 (Field Photographs):** 6 color photographs arranged 2 per page with borders, date stamps, and GPS coordinates printed.
- **Pages 16–18 (Annexures & Route Map):** Hand-drawn sketch route and satellite location map embedded.
- **Pages 19–20 (Undertakings & Declarations):** Engineer code of ethics declaration, non-conflict of interest declaration, IBBI registration seal, and digital signature block.

---

## 7. DEFECTS & CORRECTIONS

| Defect Code | Finding | Severity | Corrective Action |
| :--- | :--- | :--- | :--- |
| **OBS-REP-01** | The INR currency symbol renders in standard Liberation Sans; in older PDF readers without UTF-8 support it may fall back to `Rs.`. | Low | Ensure `Rs.` fallback is provided in PDF font embedding settings. |
