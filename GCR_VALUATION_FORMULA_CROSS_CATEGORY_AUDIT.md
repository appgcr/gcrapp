# GCR — CRITICAL VALUATION FORMULA CROSS-CATEGORY AUDIT & SPECIFICATION

**Document Identifier:** GCR-VAL-AUDIT-2026-V2  
**Date:** November 4, 2026  
**Status:** **AUDIT ONLY — FORMULAS IN CODE REMAIN UNCHANGED PENDING USER APPROVAL**  
**Evaluator:** Principal Banking Software Architect & Valuation Systems Lead  

---

## 1. EXECUTIVE SUMMARY & CORE DISCREPANCY FINDINGS

An exhaustive, page-by-page and table-by-table audit was performed on all five official reference banking valuation documents stored in `reference_documents/`.

### 1.1 Root Cause of the Discrepancy
1. **The Codebase Assumption:** The active codebase (Kotlin `ValuationEngine.kt`, Node.js `valuationCalculator.js`, React `valuationCalculator.js`) standardized on a single universal mathematical shortcut:
   - $\text{Realizable Value} = \text{FMV} \times 0.90$ (90% of Fair Market Value)
   - $\text{Distress Value} = \text{Realizable Value} \times 0.85 = \text{FMV} \times 0.765$ (85% of Realizable Value, yielding net **76.5%** of FMV)
2. **The Reference Reality:** The actual bank reference documents **do NOT apply universal percentages**, and **NEVER calculate Distress Value from Realizable Value**:
   - In **every single reference document**, Distress Value is explicitly calculated as a direct percentage of **Fair Market Value**.
   - Different property categories and banks prescribe fundamentally distinct percentage tiers based on asset liquidity and structure risk:
     - **APGB Independent House:** Realizable = **90%** of FMV | Distress = **80%** of FMV
     - **APGB Open Site:** Realizable = **90%** of FMV | Distress = **80%** of FMV
     - **APGB Apartment (Flat):** Realizable = **85%** of FMV | Distress = **75%** of FMV
     - **APGB Agricultural Land:** Realizable = **85%** of FMV | Distress = **75%** of FMV
     - **SBI Standard Report:** Realizable = **95%** of FMV | Distress = **90%** of FMV

---

## 2. CATEGORY-BY-CATEGORY REFERENCE AUDIT

### 2.1 Category 1: APGB Independent House

- **Exact Reference Document:** `reference_documents/HOUSE APGB NEW FORMET.docx`
- **Location:** Table #11 (Valuation Abstract) and Paragraphs #68, #71, #72 (approx. Page 6–7)
- **Original Verbatim Wording:**
  - *Table #11, Row 0:* `Fair Market Value Of The Property | Rs  87,14,000/-`
  - *Table #11, Row 1:* `Realizable Value of the property (90 % of the Fair Market Value of the Property) | Rs  78,42,000/-`
  - *Table #11, Row 2:* `Distress Sale Value of the Property (80 % of the Fair Market Value of the Property | Rs  69,71,000/-`
  - *Paragraph #71:* `"Net Realizable Value of the Above Property is Rs 78,42,000/- (Rupees Seventy Eight Lakhs Forty Two Thousand Only)."`
  - *Paragraph #72:* `"Distress Value of the Above Property is Rs 69,71,000/- (Rupees Sixty Nine Lakhs Seventy One Thousand Only)."`
- **Fair Market Value Formula:**
  $$\text{FMV} = \text{Land Value} + \text{Net Structure Value (after depreciation)} + \text{Amenities / Extra Items}$$
  *(Land Value = Net Extent in Sq. Yds $\times$ Adopted Land Rate; Net Structure = Total Plinth Area $\times$ Construction Rate $-$ Annual Depreciation)*
- **Realizable Value Percentage:** **90.0%**
- **Distress Value Percentage:** **80.0%**
- **Distress Base:** Directly from **Fair Market Value** (`80 % of the Fair Market Value of the Property`).
- **Insurable Value Methodology:**
  - *Reference Document:* Table #5 explicitly details "Replacement cost of building" (`Rs. 51,57,000/-`) plus services. Does not include land value.
  - *Standard Methodology:* $\text{Insurable Value} = \text{Gross Structure Replacement Cost} + \text{Amenities}$ (Excludes Land).
- **Existing Backend Formula (`valuationCalculator.js`):**
  - $\text{Realizable} = \text{round}(\text{FMV} \times 0.90)$
  - $\text{Distress} = \text{round}(\text{Realizable} \times 0.85) = \text{round}(\text{FMV} \times 0.765)$
- **Existing Kotlin Formula (`ValuationEngine.kt`):**
  - `val realizableValue = (fairMarketValue * 0.90).roundToLong().toDouble()`
  - `val distressSaleValue = (realizableValue * 0.85).roundToLong().toDouble()`
- **Existing Frontend Formula (`valuationCalculator.js`):**
  - `const realizableValue = Math.round(fairMarketValue * 0.90)`
  - `const distressSaleValue = Math.round(realizableValue * 0.85)`
- **Wording vs. Implementation Variance:**
  - Realizable percentage matches (90%).
  - Distress value in existing code is **76.5% of FMV** ($0.90 \times 0.85$), whereas the APGB House reference mandates **80.0% of FMV**. The existing code undervalues distress by **3.5% of FMV**.

---

### 2.2 Category 2: APGB Apartment (Residential Flat)

- **Exact Reference Document:** `reference_documents/APGB APARTMENTS (1).docx`
- **Location:** Table #4 (Composite Rate VI), Table #5 (Valuation Abstract), Paragraphs #52–54 (approx. Page 6–7)
- **Original Verbatim Wording:**
  - *Table #5, Row 12:* `Total | Rs 53,04,343,/- Say Rs 53,04,000/-`
  - *Paragraph #52:* `"As a result of my appraisal and analysis, it is my considered opinion that the present fair market value of the above property in the prevailing condition with aforesaid specifications is Rs. 53,04,000/- (Rupees Fifty Three Lakhs Four Thousands only)."`
  - *Paragraph #53:* `"The Realizable value of the above property is Rs.45,08,000/- (Rupees Forty  Five  Lakhs Eight Thousand only)."`
  - *Paragraph #54:* `"The distressed value Rs. 39,78,000/- (Rupees Thirty Five Lakhs Fifty Thousand only)."`
- **Mathematical Relationship in Reference:**
  - $\text{Realizable} / \text{FMV} = 45,08,000 / 53,04,000 = \mathbf{85.0\%}$
  - $\text{Distress} / \text{FMV} = 39,78,000 / 53,04,000 = \mathbf{75.0\%}$
- **Fair Market Value Formula:**
  $$\text{FMV} = (\text{Super Built-up Area} \times \text{Composite Flat Rate}) + \text{Car Parking} + \text{Amenities / Interior Extras}$$
  *(Composite Rate combines Undivided Share of Land (UDS) and depreciated construction cost per sq. ft.)*
- **Realizable Value Percentage:** **85.0%**
- **Distress Value Percentage:** **75.0%**
- **Distress Base:** Directly from **Fair Market Value** ($53,04,000 \times 0.75 = 39,78,000$).
- **Insurable Value Methodology:**
  - *Reference Document Table #4 Row 2:* `"Replacement cost of flat with Services {V (3)i} : Rs 33,18,750/-"`.
  - Excludes Undivided Share of Land (UDS). Insurable value equals gross flat replacement cost with services.
- **Existing Backend Formula:** $\text{Realizable} = \text{FMV} \times 0.90$; $\text{Distress} = \text{FMV} \times 0.765$
- **Existing Kotlin Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Existing Frontend Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Wording vs. Implementation Variance:**
  - Existing code uses universal 90% Realizable (overstates APGB Apartment realizable value by **5.0% of FMV**).
  - Existing code uses 76.5% Distress (overstates APGB Apartment distress value by **1.5% of FMV**).

---

### 2.3 Category 3: APGB Open Site (Vacant Residential/Commercial Plot)

- **Exact Reference Document:** `reference_documents/OPEN SITE APGB.docx`
- **Location:** Section Part F (Total Abstract), Paragraphs #52–54 (approx. Page 4–5)
- **Original Verbatim Wording:**
  - *Paragraph #52:* `"As a result of my appraisal and analysis, it is my considered opinion that the present Market value of the above property in the prevailing condition with aforesaid specification is"`
  - *Paragraph #53:* `"Rs. 14,07,000/- (Rupees Fourteen Lakhs Seven Thousand Only),"`
  - *Paragraph #54:* `"Net Realizable Value is Rs. 12,66,000/-(Rupees Twelve Lakhs Sixty Six Thousand Only) and the Distress Value Rs. 11,25,000/- (Rupees Eleven Lakhs Twenty Five Thousand Only)."`
- **Mathematical Relationship in Reference:**
  - $\text{Realizable} / \text{FMV} = 12,66,000 / 14,07,000 = \mathbf{89.98\%} \approx \mathbf{90.0\%}$ ($14,07,000 \times 0.90 = 12,66,300 \to 12,66,000$)
  - $\text{Distress} / \text{FMV} = 11,25,000 / 14,07,000 = \mathbf{79.96\%} \approx \mathbf{80.0\%}$ ($14,07,000 \times 0.80 = 11,25,600 \to 11,25,000$)
- **Fair Market Value Formula:**
  $$\text{FMV} = \text{Net Plot Extent (in Sq. Yards)} \times \text{Prevailing Market Rate per Sq. Yard}$$
  *(No structure, depreciation, or building plinth).*
- **Realizable Value Percentage:** **90.0%**
- **Distress Value Percentage:** **80.0%**
- **Distress Base:** Directly from **Fair Market Value** ($14,07,000 \times 0.80 = 11,25,600$).
- **Insurable Value Methodology:**
  - Open land has zero combustible or insurable improvements.
  - $\text{Insurable Value} = \mathbf{0.00}$ (or "Not Applicable").
- **Existing Backend Formula:** $\text{Realizable} = \text{FMV} \times 0.90$; $\text{Distress} = \text{FMV} \times 0.765$
- **Existing Kotlin Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Existing Frontend Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Wording vs. Implementation Variance:**
  - Realizable percentage matches (90%).
  - Distress value in existing code is **76.5% of FMV**, whereas reference mandates **80.0% of FMV** (code undervalues distress by **3.5% of FMV**).

---

### 2.4 Category 4: APGB Agricultural Land

- **Exact Reference Document:** `reference_documents/OPEN AGRICULTURE LAND APGB NEW FORMET.docx`
- **Location:** Table #3 (Valuation Abstract) and Paragraphs #45–46 (approx. Page 4–5)
- **Original Verbatim Wording:**
  - *Table #3, Row 0:* `Fair Market Value Of The Property | RS 20,40,000/-`
  - *Table #3, Row 1:* `Realizable Value of the property (85 % of the Fair Market Value of the Property) | Rs 17,34,000/-`
  - *Table #3, Row 2:* `Distress Sale Value of the Property (75 % of the Fair Market Value of the Property | Rs 15,30,000/-`
  - *Paragraph #45:* `"As a result of my appraisal and analysis, it is my considered opinion that the present fair market value of the above property in the prevailing condition with aforesaid specifications is Rs 20,40,000/- ... Net Realizable Value of the Above Property is Rs 17,34,000/- (Rupees Seventeen Lakhs Thirty Four Thousand Only)."`
  - *Paragraph #46:* `"Distress Value of the Above Property is Rs 15,30,000/- (Rupees Fifteen Lakhs Thirty Thousand Only)."`
- **Mathematical Verification in Reference:**
  - $20,40,000 \times 0.85 = \mathbf{17,34,000}$ (Exact match to single Rupee)
  - $20,40,000 \times 0.75 = \mathbf{15,30,000}$ (Exact match to single Rupee)
- **Fair Market Value Formula:**
  $$\text{FMV} = \text{Agricultural Land Extent (Acres / Guntas / Cents)} \times \text{Market Rate per Unit}$$
  *(No building, no plinth depreciation).*
- **Realizable Value Percentage:** **85.0%**
- **Distress Value Percentage:** **75.0%**
- **Distress Base:** Directly from **Fair Market Value** (`75 % of the Fair Market Value of the Property`).
- **Insurable Value Methodology:**
  - Agricultural open fields have no structural risk.
  - $\text{Insurable Value} = \mathbf{0.00}$ (Not Applicable).
- **Existing Backend Formula:** $\text{Realizable} = \text{FMV} \times 0.90$; $\text{Distress} = \text{FMV} \times 0.765$
- **Existing Kotlin Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Existing Frontend Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Wording vs. Implementation Variance:**
  - Existing code uses universal 90% Realizable (overstates APGB Agricultural realizable value by **5.0% of FMV**).
  - Existing code uses 76.5% Distress (overstates APGB Agricultural distress value by **1.5% of FMV**).

---

### 2.5 Category 5: State Bank of India (SBI) Valuation Report

- **Exact Reference Document:** `reference_documents/SBI_Valuation_Report_VAL-2026-675N.docx`
- **Location:** Table #14 (Valuation Abstract) and Table #9 (Depreciation Table) (approx. Page 8–9)
- **Original Verbatim Wording:**
  - *Table #14, Row 1:* `Land : Rs 84,60,000/-`
  - *Table #14, Row 2:* `Building : Rs 1,17,90,000/-`
  - *Table #14, Row 7:* `Total : Rs 2,02,50,000/- Say As Rs 2,02,50,000/-`
  - *Table #14, Row 8:* `(ii) Fair Market Value : Rs 2,02,50,000/-`
  - *Table #14, Row 9:* `(iii) Realizable Value : Rs 1,92,37,000/-`
  - *Table #14, Row 10:* `(iv) Forced / Distress Sale Value : Rs 1,82,25,000/-`
- **Mathematical Verification in Reference:**
  - $\text{Realizable} / \text{FMV} = 1,92,37,000 / 2,02,50,000 = \mathbf{94.9975\%} \approx \mathbf{95.0\%}$ ($2,02,50,000 \times 0.95 = 1,92,37,500 \to 1,92,37,000$)
  - $\text{Distress} / \text{FMV} = 1,82,25,000 / 2,02,50,000 = \mathbf{90.000\%}$ ($2,02,50,000 \times 0.90 = 1,82,25,000$ exact)
- **Fair Market Value Formula:**
  $$\text{FMV} = \text{Land Value} + \text{Net Depreciated Building Value} + \text{Extra Items / Services}$$
- **Realizable Value Percentage:** **95.0%**
- **Distress / Forced Sale Value Percentage:** **90.0%**
- **Distress Base:** Directly from **Fair Market Value** ($2,02,50,000 \times 0.90 = 1,82,25,000$).
- **Insurable Value Methodology:**
  - *Reference Document Table #9:* Replacement Cost of Building (`Rs. 1,17,90,000/-`).
  - Standard SBI Guidelines: Insurable Value equals Gross Construction Replacement Cost + Extra Amenities (excludes Land).
- **Existing Backend Formula:** $\text{Realizable} = \text{FMV} \times 0.90$; $\text{Distress} = \text{FMV} \times 0.765$
- **Existing Kotlin Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Existing Frontend Formula:** `realizable = FMV * 0.90`; `distress = realizable * 0.85`
- **Wording vs. Implementation Variance:**
  - Existing code uses universal 90% Realizable (understates SBI realizable value by **5.0% of FMV**).
  - Existing code uses 76.5% Distress (understates SBI distress value by **13.5% of FMV**).

---

## 3. MASTER CROSS-CATEGORY COMPARISON MATRIX

| Bank & Property Category | Reference Document & Table | Ref Realizable % | Code Realizable % | Ref Distress % | Code Distress % | Distress Base (Ref) | Distress Base (Code) | Insurable Value Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **APGB Independent House** | `HOUSE APGB NEW FORMET.docx` (Table 11) | **90%** | 90% | **80%** | 76.5% | **FMV** | Realizable $\times$ 0.85 | Replacement Cost + Amenities |
| **APGB Open Site** | `OPEN SITE APGB.docx` (Part F, Para 54) | **90%** | 90% | **80%** | 76.5% | **FMV** | Realizable $\times$ 0.85 | N/A (0.00) |
| **APGB Apartment (Flat)** | `APGB APARTMENTS (1).docx` (Table 5, Para 53) | **85%** | 90% | **75%** | 76.5% | **FMV** | Realizable $\times$ 0.85 | Flat Replacement Cost w/o UDS |
| **APGB Agricultural Land** | `OPEN AGRICULTURE LAND...` (Table 3) | **85%** | 90% | **75%** | 76.5% | **FMV** | Realizable $\times$ 0.85 | N/A (0.00) |
| **SBI Standard Report** | `SBI_Valuation_Report...` (Table 14) | **95%** | 90% | **90%** | 76.5% | **FMV** | Realizable $\times$ 0.85 | Gross Replacement + Amenities |

---

## 4. WORKED EXAMPLES (SAME ₹1,00,00,000 FAIR MARKET VALUE)

To provide maximum financial clarity, here is a worked simulation using an identical **Fair Market Value of ₹1,00,00,000 (Rupees One Crore / 10 Million INR)** across all five property categories.

### Property Breakdown Assumptions:
- **For Built Properties (House / Apartment / SBI):**
  - Land Value (or UDS Share): ₹40,00,000
  - Net Structure Value (after depreciation): ₹55,00,000 (Gross Replacement ₹65,00,000 $-$ Depreciation ₹10,00,000)
  - Amenities / Extra Work: ₹5,00,000
  - **Fair Market Value (FMV): ₹1,00,00,000**
  - **Insurable Value (Gross Replacement ₹65L + Amenities ₹5L): ₹70,00,000**
- **For Open Land (Open Site / Agricultural Land):**
  - Land Value: ₹1,00,00,000
  - Structure Value: ₹0
  - Amenities: ₹0
  - **Fair Market Value (FMV): ₹1,00,00,000**
  - **Insurable Value: ₹0**

---

### 4.1 APGB Independent House (FMV: ₹1,00,00,000)

| Valuation Metric | Reference Template Methodology | Current Active Codebase | Rupee Variance | Impact Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Fair Market Value** | ₹1,00,00,000 | ₹1,00,00,000 | ₹0 | Identical |
| **Realizable Value** | ₹90,00,000 (90% of FMV) | ₹90,00,000 (90% of FMV) | ₹0 | Identical |
| **Distress Value** | **₹80,00,000** (80% of FMV) | **₹76,50,000** (85% of Real.) | **$-$₹3,50,000** | Code undervalues bank distress margin by ₹3.50 Lakhs |
| **Insurable Value** | ₹70,00,000 | ₹70,00,000 | ₹0 | Identical |

---

### 4.2 APGB Open Site (FMV: ₹1,00,00,000)

| Valuation Metric | Reference Template Methodology | Current Active Codebase | Rupee Variance | Impact Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Fair Market Value** | ₹1,00,00,000 | ₹1,00,00,000 | ₹0 | Identical |
| **Realizable Value** | ₹90,00,000 (90% of FMV) | ₹90,00,000 (90% of FMV) | ₹0 | Identical |
| **Distress Value** | **₹80,00,000** (80% of FMV) | **₹76,50,000** (85% of Real.) | **$-$₹3,50,000** | Code undervalues distress by ₹3.50 Lakhs |
| **Insurable Value** | ₹0 (Not Applicable) | ₹0 (No Structure) | ₹0 | Identical |

---

### 4.3 APGB Apartment (FMV: ₹1,00,00,000)

| Valuation Metric | Reference Template Methodology | Current Active Codebase | Rupee Variance | Impact Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Fair Market Value** | ₹1,00,00,000 | ₹1,00,00,000 | ₹0 | Identical |
| **Realizable Value** | **₹85,00,000** (85% of FMV) | **₹90,00,000** (90% of FMV) | **+₹5,00,000** | Code overstates apartment realizable liquidity by ₹5.00 Lakhs |
| **Distress Value** | **₹75,00,000** (75% of FMV) | **₹76,50,000** (85% of Real.) | **+₹1,50,000** | Code overstates apartment distress value by ₹1.50 Lakhs |
| **Insurable Value** | ₹70,00,000 | ₹70,00,000 | ₹0 | Identical |

---

### 4.4 APGB Agricultural Land (FMV: ₹1,00,00,000)

| Valuation Metric | Reference Template Methodology | Current Active Codebase | Rupee Variance | Impact Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Fair Market Value** | ₹1,00,00,000 | ₹1,00,00,000 | ₹0 | Identical |
| **Realizable Value** | **₹85,00,000** (85% of FMV) | **₹90,00,000** (90% of FMV) | **+₹5,00,000** | Code overstates agricultural liquidity by ₹5.00 Lakhs |
| **Distress Value** | **₹75,00,000** (75% of FMV) | **₹76,50,000** (85% of Real.) | **+₹1,50,000** | Code overstates agricultural distress value by ₹1.50 Lakhs |
| **Insurable Value** | ₹0 (Not Applicable) | ₹0 (No Structure) | ₹0 | Identical |

---

### 4.5 State Bank of India (SBI) Valuation (FMV: ₹1,00,00,000)

| Valuation Metric | Reference Template Methodology | Current Active Codebase | Rupee Variance | Impact Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Fair Market Value** | ₹1,00,00,000 | ₹1,00,00,000 | ₹0 | Identical |
| **Realizable Value** | **₹95,00,000** (95% of FMV) | **₹90,00,000** (90% of FMV) | **$-$₹5,00,000** | Code understates SBI realizable liquidity by ₹5.00 Lakhs |
| **Distress Value** | **₹90,00,000** (90% of FMV) | **₹76,50,000** (85% of Real.) | **$-$₹13,50,000** | Code severely understates SBI forced sale value by ₹13.50 Lakhs |
| **Insurable Value** | ₹70,00,000 | ₹70,00,000 | ₹0 | Identical |

---

## 5. PROPOSED METHODOLOGY & TRANSITION PLAN

> [!IMPORTANT]
> **NO FORMULAS HAVE BEEN MODIFIED IN CODE.**  
> In strict compliance with your stop condition, the existing formulas remain in place across Kotlin, Node.js, and React.
> 
> The proposed category-specific resolution below is presented for your review and explicit approval.

### Proposed Code Configuration Schema
Upon receiving your explicit approval, we will configure dynamic category-specific multipliers in `AppConfig` and update the valuation engines across all three layers (Kotlin, Node.js, React):

```javascript
// Bank & Category-Specific Valuation Multiplier Matrix
const VALUATION_METHODOLOGY_MATRIX = {
  'APGB': {
    'Independent House':       { realizableRate: 0.90, distressRate: 0.80 },
    'Open Site':               { realizableRate: 0.90, distressRate: 0.80 },
    'Apartment':               { realizableRate: 0.85, distressRate: 0.75 },
    'Open Agriculture Land':   { realizableRate: 0.85, distressRate: 0.75 }
  },
  'State Bank of India': {
    'Independent House':       { realizableRate: 0.95, distressRate: 0.90 },
    'Open Site':               { realizableRate: 0.95, distressRate: 0.90 },
    'Apartment':               { realizableRate: 0.95, distressRate: 0.90 },
    'Open Agriculture Land':   { realizableRate: 0.95, distressRate: 0.90 }
  },
  'DEFAULT': {
    'Independent House':       { realizableRate: 0.90, distressRate: 0.80 },
    'Open Site':               { realizableRate: 0.90, distressRate: 0.80 },
    'Apartment':               { realizableRate: 0.85, distressRate: 0.75 },
    'Open Agriculture Land':   { realizableRate: 0.85, distressRate: 0.75 }
  }
};

// Common Standard Calculation:
// realizableValue = Math.round(fairMarketValue * rates.realizableRate);
// distressSaleValue = Math.round(fairMarketValue * rates.distressRate);
// insurableValue = (propertyType === 'Open Site' || propertyType === 'Open Agriculture Land') ? 0 : (replacementCost + amenitiesValue);
```

### Action Required:
Please confirm whether to:
1. **Option A (Recommended):** Activate the bank- and category-specific matrix above (matching all five bank reference documents verbatim).
2. **Option B:** Maintain the current universal formula (90% Realizable, 76.5% Distress).
