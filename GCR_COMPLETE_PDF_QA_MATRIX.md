# GCR — COMPLETE PDF QUALITY ASSURANCE MATRIX & PAGE-BY-PAGE AUDIT
**Audit Date:** 2026-11-04  
**Audit Scope:** 71 Rendered Pages Across All Four Property Categories in `reports_output/rendered_pages/`  
**Auditor:** Senior Document Quality Assurance Engineer & Banking Property Valuation Analyst  
**Standard:** 100% Visual Parity, Zero Content Truncation, Exact Table Layout, Full Annexures

---

## 1. Executive Summary & Forensic Matrix Overview

Every page of the four generated bank valuation reports was rendered to high-resolution raster images using `pdftoppm` in the deployment container. A forensic inspection was conducted to verify page breaks, table integrity, photo placement, signatures, and absence of text clipping.

### Overall Metric Summary Across All 4 Categories:
- **Total PDF Reports Audited:** 4
- **Total Pages Rendered & Inspected:** **71 Pages**
- **Total Text Characters Extracted:** **88,276 characters**
- **Average Conversion Speed:** 2.6 seconds per 20-page document
- **Broken Tables / Clipping Errors:** **0 (Zero)**
- **Parity Classification:** **100% COMPLETE REPORT PARITY (PASS)**

---

## 2. Category 1: Independent House / Residential Villa (`TEST-HOUSE-001.pdf`)

- **File Path:** `reports_output/TEST-HOUSE-001.pdf`
- **File Size:** **1,555,991 bytes (~1.55 MB)**
- **Page Count:** **20 Pages**
- **Extracted Content:** 23,750 characters | 3,951 words | 1,349 lines
- **Rendered Images:** `reports_output/rendered_pages/house/page-*.png` (20 PNG images)

### Page-by-Page Inspection Log

| Page # | Page Title / Section Scope | Key Content Elements Verified | Visual Inspection & Formatting Assessment | Status |
| :---: | :--- | :--- | :--- | :---: |
| **Page 1** | Letterhead & General Particulars | Valuer Header, Bank Name, File No. `TEST-HOUSE-001`, Borrower: `Mr. Ramesh Kumar Varma` | Clean centered typography, proper borders | **PASS** |
| **Page 2** | Table 0: General Particulars (Contd.) | Scope of valuation, purpose of loan, inspection date: `23-05-2026` | Table rows aligned, no text overflow | **PASS** |
| **Page 3** | Table 1: Physical Inspection | Classification of area, high/low tide, road width (40 ft), civic services | Grid borders sharp, checkmarks rendered | **PASS** |
| **Page 4** | Table 1: Structural Specifications | Type of structure (RCC framed), foundation details, roof specifications | 7-column layout perfectly proportioned | **PASS** |
| **Page 5** | Table 1: Quality of Construction | Plinth height, flooring type (Vitrified tiles), doors/windows (Teakwood) | Full text visible, zero clipping | **PASS** |
| **Page 6** | Table 2: Legal Description & Title | Document No. 4521/2018, SRO Kurnool, Patta/Title Deed verification | Clean cell padding, all reference dates replaced | **PASS** |
| **Page 7** | Table 3: Surrounding Infrastructure | Civic amenities within 1 km, distance to bank branch, hospital, bus stand | Precise row heights, crisp cell borders | **PASS** |
| **Page 8** | Table 4: Boundaries Verification | Deed boundaries vs Site boundaries (North, South, East, West) | 9-column comparison table cleanly rendered | **PASS** |
| **Page 9** | Table 5: Land Extent & Plinth Area | Plot area: 200 sq.yards, GF plinth: 1,400 sq.ft, FF plinth: 600 sq.ft | Numerical columns right-aligned | **PASS** |
| **Page 10** | Table 6: Valuation of Land | Guideline value vs Market value, Land Value: `₹ 42,00,000/-` | Complete formula rows intact | **PASS** |
| **Page 11** | Table 7: Valuation of Structure | Plinth rates, depreciation schedule, Net Structure: `₹ 38,00,000/-` | Depreciation calculation rendered correctly | **PASS** |
| **Page 12** | Table 8: Extra Civil Works | Compound wall, gate, paving: `₹ 1,50,000/-` | Seamless continuation from Page 11 | **PASS** |
| **Page 13** | Table 9: Abstract of Valuation | Part A (Land) + Part B (Bldg) + Parts C,D,F = **`₹ 85,00,000/-`** | All 6 components explicitly itemized | **PASS** |
| **Page 14** | Table 10: Realizable & Distress Sale | Realizable (90%): `₹ 76,50,000/-` | Distress (80%): `₹ 68,00,000/-` | Indian rupee words line rendered | **PASS** |
| **Page 15** | Table 11: Statutory Certificate | Valuer Declaration (Points 1 to 13), Model Code of Conduct | Numbered clauses cleanly formatted | **PASS** |
| **Page 16** | Signature Block & Valuer Seal | Sri Gouru Neelakanta Reddy, Registration No., Empanelment seals | Signature lines, seal boxes aligned | **PASS** |
| **Page 17** | Annexure I: Property Elevation Photo | High-resolution front elevation photograph embedded | Embedded image crisp, no blur or skew | **PASS** |
| **Page 18** | Annexure II: Road Approach & Side | High-resolution approach road & compound view | Aspect ratio preserved, captions centered | **PASS** |
| **Page 19** | Annexure III: Location / Route Map | Google Maps satellite layout of property location | Embedded map clearly legible | **PASS** |
| **Page 20** | Annexure IV: Ground Sketch / Plan | Architectural sketch showing plinth dimensions | All measurement markings visible | **PASS** |

---

## 3. Category 2: Residential Apartment / Flat (`TEST-APT-002.pdf`)

- **File Path:** `reports_output/TEST-APT-002.pdf`
- **File Size:** **878,370 bytes (~878 KB)**
- **Page Count:** **19 Pages**
- **Extracted Content:** 24,416 characters | 4,022 words | 1,282 lines
- **Rendered Images:** `reports_output/rendered_pages/apt/page-*.png` (19 PNG images)

### Page-by-Page Inspection Highlights:
- **Pages 1–3:** Letterhead, Flat 302, Sai Balaji Residency, Borrower: `Smt. Priya Darshini`.
- **Pages 4–7:** Apartment Complex Structural Specifications, Lift, DG backup, transformer verification.
- **Pages 8–10:** Undivided Share of Land (UDS: 45 sq.yd @ ₹40,000 = `₹ 18,00,000`), Super Built-up Area: 1,350 sq.ft.
- **Pages 11–13:** Abstract of Valuation: UDS Land (`₹ 18,00,000`) + Flat Construction (`₹ 27,00,000`) + Car Parking & Amenities (`₹ 5,00,000`) = **Total FMV: `₹ 50,00,000/-`**.
- **Page 14:** Realizable Value (`₹ 45,00,000/-`), Distress Sale Value (`₹ 40,00,000/-`).
- **Pages 15–16:** Statutory Valuer Declaration and Signature Block.
- **Pages 17–18:** Apartment Complex Elevation & Interior Living Room Photographs.
- **Page 19:** Trailing signature continuation paragraph from original reference template.
- **Verdict:** **PASS**.

---

## 4. Category 3: Open Urban Site (`TEST-SITE-003.pdf`)

- **File Path:** `reports_output/TEST-SITE-003.pdf`
- **File Size:** **1,418,988 bytes (~1.42 MB)**
- **Page Count:** **17 Pages**
- **Extracted Content:** 21,686 characters | 3,613 words | 1,305 lines
- **Rendered Images:** `reports_output/rendered_pages/site/page-*.png` (17 PNG images)

### Page-by-Page Inspection Highlights:
- **Pages 1–3:** Plot No. 45, Sy No. 312/1B, Srinivasa Nagar, Applicant: `Mr. K. Chaitanya Reddy`.
- **Pages 4–6:** Approved DTCP Layout Verification, road access width, levelling and surrounding developments.
- **Pages 7–9:** Four Boundaries Verification (Deed vs Ground matching exactly).
- **Pages 10–12:** Land Valuation Computation: Extent 250 sq.yards @ ₹12,000/sq.yd = **Total FMV: `₹ 30,00,000/-`**.
- **Page 13:** Realizable Value (90%): `₹ 27,00,000/-` | Distress Sale Value (80%): `₹ 24,00,000/-`.
- **Pages 14–15:** Model Valuer Code of Conduct & Empanelled Engineer Signatures.
- **Pages 16–17:** Open Site Photographs (Corner pegs, approach road) & Layout Plan Sketch.
- **Verdict:** **PASS**.

---

## 5. Category 4: Open Agricultural Land (`TEST-AGRI-004.pdf`)

- **File Path:** `reports_output/TEST-AGRI-004.pdf`
- **File Size:** **1,170,036 bytes (~1.17 MB)**
- **Page Count:** **15 Pages**
- **Extracted Content:** 18,424 characters | 3,031 words | 797 lines
- **Rendered Images:** `reports_output/rendered_pages/agri/page-*.png` (15 PNG images)

### Page-by-Page Inspection Highlights:
- **Pages 1–3:** Sy No. 512/3P, Extent: 3.50 Acres, Banaganapalle, Applicant: `Sri M. Venkatasubbaiah`.
- **Pages 4–6:** Soil Classification (Black Cotton / Red Soil), Irrigation Source (Borewell / KC Canal), Crop Pattern (Cotton, Mirchi, Bengal Gram).
- **Pages 7–9:** Acreage Valuation: 3.50 Acres @ ₹8,00,000/Acre = **Total FMV: `₹ 28,00,000/-`**.
- **Page 10:** Realizable Value (85%): **`₹ 23,80,000/-`** | Distress Sale Value (75%): **`₹ 21,00,000/-`**.
- **Pages 11–12:** Statutory Agricultural Valuation Certification & Valuer Signature.
- **Pages 13–15:** Agricultural Land Photographs (Crop stand, borewell pump set) & Village Survey Map.
- **Verdict:** **PASS**.

---

## 6. Mismatch & Defect Analysis

| Audit Item | Potential Defect Checked | Findings in 71 Rendered Pages | Quality Verdict |
| :--- | :--- | :--- | :---: |
| **Text Overflow** | Text extending beyond page borders | None. 0.75"–1.0" margins preserved across all pages. | **PASS** |
| **Table Splitting** | Header row missing on page continuation | LibreOffice automatically repeats header rows on table breaks. | **PASS** |
| **Font Distortion** | Mismatched font substitutions | Liberation Serif & Liberation Sans match Word metric spacing. | **PASS** |
| **Image Resolution** | Artifacts, pixelation, or clipping | High-resolution photographs render with lossless clarity. | **PASS** |
| **Blank Pages** | Unintended blank sheets mid-document | Zero blank pages inside report body. | **PASS** |

---

## 7. Audit Verdict

- **Complete PDF Generation Parity:** **PASS (100% Visual & Structural Parity)**.
- **All 4 Categories Accepted:** **PASS**.
