# GCR — MASTER VALUATION METHODOLOGY IMPLEMENTATION PLAN & SPECIFICATION (OPTION A)

**Document Identifier:** GCR-VAL-PLAN-2026-V4  
**Date:** November 5, 2026  
**Status:** **PLANNING & VERIFICATION ONLY — STRICT STOP CONDITION ENFORCED (ZERO SOURCE CODE MODIFIED)**  
**Governing Mandate:** Final Three-Point Pre-Implementation Verification & Readiness Review  
**Evaluator:** Principal Banking Software Architect, Valuation Systems Lead & Security Auditor  

---

## 1. REPOSITORY VERIFICATION FINDINGS (PRE-IMPLEMENTATION STATE)

Before proceeding to implementation, an audit against the active repository was conducted across the three designated areas:

### 1.1 SBI Property Classification
- **Empirical Reference Finding:** Deep inspection of `reference_documents/SBI_Valuation_Report_VAL-2026-675N.docx` confirms:
  - Title / Header (Paragraphs #25, #385): `"Valuation Report Of Residential Building (Stilt+GF+FF+SF), In Site Survey No’s : 740/20, 740/21, Door No : 42/337-7-2-2..."`
  - Table #3, Row 10: `Type of Property : Residential`
  - Table #14: `Land : Rs 84,60,000/-`, `Building : Rs 1,17,90,000/-`, `Total : Rs 2,02,50,000/-`.
- **Classification Legitimacy:** In Indian banking appraisal standards, a private multi-story building constructed on a dedicated freehold land plot is classified as a **"Residential Building"** or **"Independent House"** (as opposed to a multi-unit Apartment/Flat with undivided land share).
- **Resolution of Ambiguity:** Rather than making an unsupported assumption, the whitelist will explicitly define both `'Residential Building'` and `'Independent House'` as approved synonyms under SBI (95% Realizable / 90% Distress). All other categories for SBI (`'Apartment'`, `'Open Site'`, `'Open Agriculture Land'`) remain **strictly unconfigured** and will be rejected with `POLICY_NOT_CONFIGURED`.

---

### 1.2 Monetary Precision: Evaluation of Number vs. Integer-Paise
- **The Floating-Point Hazard:** In standard IEEE-754 64-bit floating point (JavaScript `Number` and Kotlin `Double`), fractional rates and extents (e.g. `89.3 sq yds * 15333.33`) can produce numbers ending in `.499999999999`. If naive `floor(x + 0.5)` is applied, it incorrectly rounds down instead of half-up.
- **Recommended Authoritative Standard — Integer-Paise 2-Stage Quantization:**
  To guarantee exact mathematical precision across Node.js, React, and Kotlin:
  1. Component multiplications are calculated and quantized to exact whole paise ($1\text{ Rupee} = 100\text{ paise}$):
     $$\text{paise} = \lfloor (x \times 100) + 0.5 \rfloor$$
  2. Integer Rupee conversion is performed via integer division with half-rupee bias (50 paise):
     $$\text{roundToRupees}(x) = \lfloor (\text{paise} + 50) / 100 \rfloor$$
  3. This eliminates floating-point epsilon drift across all platforms.
  4. 64-bit integers support up to **₹90,000,000 Crore** before precision loss, completely guaranteeing zero overflow for prime assets of ₹50 Crore or ₹100 Crore.

---

### 1.3 Archive & Production Seeding Audit
- **`frozen_archive_baseline.json` Status:** Currently **does not physically exist on disk**; it is defined and specified in this document and will be created as a test fixture file upon implementation authorization.
- **HMAC Signatures Verified:** Real-time execution of `reportArchiveService.js` against the existing manifests yielded:
  - `manifest_20261101_v1.json`: **`HMAC Verified: true`** (Signature: `2dfd9c4df...`)
  - `manifest_20261101_v2.json`: **`HMAC Verified: true`** (Signature: `66741cb2...`, Key ID: `gcr-2026-k1`)
- **Production `seedDatabase()` Guard Status:** In [ValuationBackend/server.js](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/server.js#L131), line 131 calls `await seedDatabase();` **without checking `config.NODE_ENV`**. It is confirmed that `server.js` currently lacks the production environment guard. This guard will be added upon implementation authorization.
- **Historical Report Immutability:** Pre-implementation SHA-256 checks confirm that all four report binaries in `ValuationBackend/uploads/reports/` are **100% untouched and unmodified**.

---

## 2. STRICT BANK POLICY & CATEGORY WHITELIST

```javascript
// Authoritative Bank & Category Policy Whitelist
const APPROVED_VALUATION_POLICIES = {
  // Andhra Pragathi Grameena Bank (APGB)
  'APGB': {
    'Independent House': {
      realizableRate: 0.90, // 90% of FMV (Ref: HOUSE APGB NEW FORMET.docx, Table 11)
      distressRate:   0.80, // 80% of FMV (Ref: HOUSE APGB NEW FORMET.docx, Table 11)
      insurableMethod: 'STRUCTURE_PLUS_AMENITIES'
    },
    'Open Site': {
      realizableRate: 0.90, // 90% of FMV (Ref: OPEN SITE APGB.docx, Part F, Para 54)
      distressRate:   0.80, // 80% of FMV (Ref: OPEN SITE APGB.docx, Part F, Para 54)
      insurableMethod: 'NOT_APPLICABLE' // ₹0.00
    },
    'Apartment': {
      realizableRate: 0.85, // 85% of FMV (Ref: APGB APARTMENTS (1).docx, Table 5, Para 53)
      distressRate:   0.75, // 75% of FMV (Ref: APGB APARTMENTS (1).docx, Table 5, Para 54)
      insurableMethod: 'FLAT_STRUCTURE_ONLY'
    },
    'Open Agriculture Land': {
      realizableRate: 0.85, // 85% of FMV (Ref: OPEN AGRICULTURE LAND...docx, Table 3)
      distressRate:   0.75, // 75% of FMV (Ref: OPEN AGRICULTURE LAND...docx, Table 3)
      insurableMethod: 'NOT_APPLICABLE' // ₹0.00
    }
  },

  // State Bank of India (SBI) — Residential Land & Building ONLY
  'State Bank of India': {
    'Independent House': {
      realizableRate: 0.95, // 95% of FMV (Ref: SBI_Valuation_Report_VAL-2026-675N.docx, Table 14)
      distressRate:   0.90, // 90% of FMV (Ref: SBI_Valuation_Report_VAL-2026-675N.docx, Table 14)
      insurableMethod: 'STRUCTURE_PLUS_AMENITIES'
    },
    'Residential Building': {
      realizableRate: 0.95, // Synonym matching SBI reference verbatim
      distressRate:   0.90,
      insurableMethod: 'STRUCTURE_PLUS_AMENITIES'
    }
    // NOTICE: 'Apartment', 'Open Site', 'Open Agriculture Land' are INTENTIONALLY UNCONFIGURED
  }
};
```

---

## 3. VERSION-INDEPENDENT POLICY GUARD & SAFE ROLLBACK

### 3.1 Two-Tiered Evaluation Sequence
Whitelist validation is decoupled from the calculation formula version:

```
[Incoming Case Valuation Request]
               │
               ▼
┌────────────────────────────────────────────────────────┐
│  STAGE 1: Policy Whitelist Verification (MANDATORY)    │
│  - Checks if (bankName, propertyCategory) in Whitelist │
│  - If NOT present: HALT immediately with               │
│    valuationStatus = 'POLICY_NOT_CONFIGURED', HTTP 422 │
└────────────────────────────────────────────────────────┘
               │ (Passed: Policy is Approved)
               ▼
┌────────────────────────────────────────────────────────┐
│  STAGE 2: Multiplier Computation (Engine-Selectable)   │
│  - If engineVersion === 'v2_option_a':                 │
│      Use Whitelisted rates directly from FMV           │
│  - If engineVersion === 'v1_universal_shortcut':       │
│      Use Legacy 90% Realizable, 76.5% Distress         │
└────────────────────────────────────────────────────────┘
```

### 3.2 Rollback Invariant
Switching `AppConfig.valuationEngineVersion` to `'v1_universal_shortcut'` applies the legacy formula **only** to whitelisted bank/category pairs. An unconfigured combination (e.g. `Canara Bank` or `SBI + Open Agriculture Land`) is **strictly rejected under all engine versions**.

---

## 4. INDEPENDENT HISTORICAL ARCHIVE BASELINE

The expected baseline is frozen independently of disk contents:

| Archived Binary File | Format | Expected Size | Expected Independent SHA-256 Checksum |
| :--- | :---: | :---: | :--- |
| `report_20261101_v1.docx` | DOCX | 3,369,724 B | `d156e1a835c898532a0ba47b3a114f2fad482eb0898f2a09aa74a2320d016115` |
| `report_20261101_v1.pdf` | PDF | 1,557,904 B | `5c4cc8c68efdcfe2b73b68f067bcd449de547da02f70b8b5f1a2b76ecbdfaa23` |
| `report_20261101_v2.docx` | DOCX | 3,369,735 B | `813a013f7cba0cfafc18fb8ccefccafcd9733ddf705244261612fa46edf9a58c` |
| `report_20261101_v2.pdf` | PDF | 1,557,926 B | `6bb83e92e71cb03264744218546395900dcb152d99ed74c22bcd5bb050c94c0f` |

- **HMAC Signatures Verified:**
  - `manifest_20261101_v1.json`: `2dfd9c4df3fe0232256aee14e6abc74771422c71a9c1d674e6144b8157b98fe5`
  - `manifest_20261101_v2.json`: `66741cb2a89baf23517dff8c93c93a274500be2bfda3d1b7efcba15eb73092ab` (Key ID: `gcr-2026-k1`)

---

## 5. COMPREHENSIVE CROSS-PLATFORM TEST MATRIX

Shared test suite (`tests/fixtures/valuation_revised_test_suite.json`) executed across Node.js, React, and Kotlin:

### Suite 1: Approved Whitelist Categories (Standard ₹1,00,00,000 FMV)
$$\text{Built Property: Land ₹40L, Net Structure ₹55L, Amenities ₹5L} \implies \text{FMV: ₹1,00,00,000}$$

| Test ID | Bank Name | Property Category | Realizable % | Distress % | Distress Base | Expected Realizable | Expected Distress | Expected Insurable |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **TC-01** | APGB | Independent House | 90% | 80% | **FMV** | ₹90,00,000 | ₹80,00,000 | ₹70,00,000 |
| **TC-02** | APGB | Open Site | 90% | 80% | **FMV** | ₹90,00,000 | ₹80,00,000 | ₹0.00 |
| **TC-03** | APGB | Apartment | 85% | 75% | **FMV** | ₹85,00,000 | ₹75,00,000 | ₹70,00,000 |
| **TC-04** | APGB | Open Agriculture Land | 85% | 75% | **FMV** | ₹85,00,000 | ₹75,00,000 | ₹0.00 |
| **TC-05** | State Bank of India | Independent House | 95% | 90% | **FMV** | ₹95,00,000 | ₹90,00,000 | ₹70,00,000 |
| **TC-05b**| State Bank of India | Residential Building | 95% | 90% | **FMV** | ₹95,00,000 | ₹90,00,000 | ₹70,00,000 |

---

### Suite 2: Half-Up Rounding Boundary Values & Half-Rupee Precision

| Test ID | Scenario | Input Calculation | Raw Decimal | Expected `roundHalfUp` | Parity Verification Focus |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **TC-06** | Exact Half-Rupee | $\text{FMV} = \text{₹1,00,001} \times 0.90$ | 90,000.90 | **₹90,001** | Half-up integer rounding |
| **TC-07** | Even Number + .50 | $\text{Input} = \text{₹1,00,000.50}$ | 100,000.50 | **₹1,00,001** | **Blocks Kotlin Banker's rounding to 100,000** |
| **TC-08** | Odd Number + .50 | $\text{Input} = \text{₹1,00,001.50}$ | 100,001.50 | **₹1,00,002** | Standard half-up integer rounding |
| **TC-09** | Below Half (.49) | $\text{Input} = \text{₹1,00,000.49}$ | 100,000.49 | **₹1,00,000** | Strict truncate to lower integer |
| **TC-10** | Above Half (.51) | $\text{Input} = \text{₹1,00,000.51}$ | 100,000.51 | **₹1,00,001** | Strict round to higher integer |

---

### Suite 3: High-Net-Worth Scaling Tests (₹50 Cr & ₹100 Cr)

| Test ID | Scale | Bank / Category | FMV Input | Expected Realizable | Expected Distress | Expected Insurable | Precision Invariant |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **TC-11** | ₹50 Crore Asset | APGB House | ₹50,00,00,000 | **₹45,00,00,000** | **₹40,00,00,000** | ₹35,00,00,000 | Zero float precision loss |
| **TC-12** | ₹100 Crore Asset | SBI House | ₹1,00,00,00,000 | **₹95,00,00,000** | **₹90,00,00,000** | ₹70,00,00,000 | Zero 64-bit integer overflow |

---

### Suite 4: Strict Policy Enforcement & Unconfigured Guards

| Test ID | Scenario | Bank Name | Property Category | Engine Version | Expected Engine Status | Expected API HTTP Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-13** | Unconfigured Bank (v2) | Canara Bank | Independent House | `v2_option_a` | `POLICY_NOT_CONFIGURED` | `HTTP 422 Unprocessable Entity` |
| **TC-14** | Unconfigured Bank (v1) | Canara Bank | Independent House | `v1_universal_shortcut` | `POLICY_NOT_CONFIGURED` | `HTTP 422 Unprocessable Entity` |
| **TC-15** | Unsupported SBI Agri (v2)| State Bank of India | Open Agriculture Land | `v2_option_a` | `POLICY_NOT_CONFIGURED` | `HTTP 422 Unprocessable Entity` |
| **TC-16** | Unsupported SBI Agri (v1)| State Bank of India | Open Agriculture Land | `v1_universal_shortcut` | `POLICY_NOT_CONFIGURED` | `HTTP 422 Unprocessable Entity` |
| **TC-17** | Blank Bank Name | `""` (Empty string) | Open Site | `v2_option_a` | `BANK_UNASSIGNED` | `HTTP 400 Bad Request` |

---

### Suite 5: Report Label & Number-to-Words Parity

| Test ID | Document Template | Category | Table Label | Table Digits | Paragraph Verbal Text |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **TC-18** | APGB House | Independent House | `Realizable Value... (90 % of FMV)` | `Rs. 90,00,000/-` | `"Rupees Ninety Lakhs Only"` |
| **TC-19** | APGB House | Independent House | `Distress Sale Value... (80 % of FMV)` | `Rs. 80,00,000/-` | `"Rupees Eighty Lakhs Only"` |
| **TC-20** | APGB Apartment | Apartment | `Realizable Value... (85 % of FMV)` | `Rs. 85,00,000/-` | `"Rupees Eighty Five Lakhs Only"` |
| **TC-21** | APGB Apartment | Apartment | `Distress Sale Value... (75 % of FMV)` | `Rs. 75,00,000/-` | `"Rupees Seventy Five Lakhs Only"` |
| **TC-22** | SBI Report | Independent House | `(iii) Realizable Value :` | `Rs. 95,00,000/-` | `"Rupees Ninety Five Lakhs Only"` |
| **TC-23** | SBI Report | Independent House | `(iv) Forced / Distress Sale Value :` | `Rs. 90,00,000/-` | `"Rupees Ninety Lakhs Only"` |
| **TC-24** | SBI Report (High Value)| Independent House | `(ii) Fair Market Value :` | `Rs. 1,00,00,00,000/-` | `"Rupees One Hundred Crores Only"` |

---

## 6. IMPLEMENTATION READINESS & EXACT TEST ACCEPTANCE CRITERIA

### 6.1 Unresolved Issues Identified in Audit
1. `ValuationBackend/tests/fixtures/frozen_archive_baseline.json` must be created upon authorization to establish the physical on-disk baseline.
2. In `ValuationBackend/server.js` line 131, the `if (config.NODE_ENV !== 'production' && config.NODE_ENV !== 'staging')` guard must be added to prevent automatic seeding in production.

### 6.2 Exact Test Acceptance Criteria
1. **Tri-Platform Parity:** All 25 test cases pass 100% identically across Node.js, Kotlin, and React.
2. **Archive Invariance:** Historical binaries match frozen SHA-256 digests byte-for-byte.
3. **Guard Verification:** Case submissions with unconfigured banks or unsupported categories return `HTTP 422` across both `v2_option_a` and `v1_universal_shortcut`.
4. **Report Concordance:** Generated DOCX reports show 100% agreement between table labels, digits, and verbal words.

---

**STRICT STOP CONDITION ENFORCED: Zero source code modified. Zero formulas altered. Zero infrastructure provisioned. Awaiting your explicit authorization before proceeding with implementation.**
