# GCR VALUATION CALCULATION SPECIFICATION
## Comprehensive Mathematical and Financial Rules for Banking Property Valuations

**Author:** Principal Software Architect & Banking Property Valuation Domain Specialist  
**Authoritative Implementation Files:**
- Backend: [`ValuationBackend/services/valuationCalculator.js`](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/services/valuationCalculator.js)
- Frontend: [`ValuationApp/src/utils/valuationCalculator.js`](file:///Users/apple/GCR%20/gcrapp/ValuationApp/src/utils/valuationCalculator.js)
- Test Suite: [`ValuationBackend/tests/valuation_calculation.test.js`](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/tests/valuation_calculation.test.js)

---

## 1. Unit Conversion Rules & Standards

Indian banking valuations in Andhra Pradesh / Telangana operate across several local and metric measurement systems. The engine strictly standardizes all area calculations into **Square Yards** (for Land) and **Square Feet** (for Building Plinth Areas).

| Original Entered Unit | Telugu / English Synonyms | Standard Conversion Formula to Sq. Yards | Standard Conversion to Sq. Feet |
|:---|:---|:---|:---|
| **Cent** | `cent`, `cents`, `సెంట్`, `సెంట్లు` | `1 Cent = 48.40 Sq. Yards` | `1 Cent = 435.60 Sq. Feet` |
| **Acre** | `acre`, `acres`, `ఎకరం`, `ఎకరాలు` | `1 Acre = 4840.00 Sq. Yards` (100 Cents) | `1 Acre = 43560.00 Sq. Feet` |
| **Square Feet** | `sq.ft`, `sq ft`, `sft`, `చ.అడుగులు` | `Area in Sft / 9.00` | `1 Sq. Ft = 1.00 Sq. Ft` |
| **Ankanam** *(Kadapa / Rayalaseema)* | `ankanam`, `అంకణము` | `1 Ankanam = 8.00 Sq. Yards` | `1 Ankanam = 72.00 Sq. Feet` |
| **Gunta** *(Telangana / Border)* | `gunta`, `గుంట` | `1 Gunta = 121.00 Sq. Yards` | `1 Gunta = 1089.00 Sq. Feet` |
| **Square Metres** | `sq.mtr`, `sqm`, `చ.మీటర్లు` | `Area in Sq.Mtr × 1.196` | `Area in Sq.Mtr × 10.764` |
| **Square Yards** | `sq.yds`, `sqyd`, `గజాలు` | `1 Sq. Yard = 1.00 Sq. Yard` | `1 Sq. Yard = 9.00 Sq. Feet` |

---

## 2. Land Valuation (Part A)

### Formula:
$$\text{Net Land Extent (Sq. Yds)} = \text{parseExtentToSqYards}(\text{extent})$$
$$\text{Land Value} = \text{Round}(\text{Net Land Extent} \times \text{Land Rate per Sq. Yd})$$

- **Dual Extent Principle:** If document extent differs from physical site inspection extent, banking guidelines mandate taking the **Lesser of the Two Extents** for valuation:
  $$\text{Valuation Extent} = \min(\text{Extent}_{\text{Document}}, \text{Extent}_{\text{Actual}})$$
- **Agricultural Land:** When extent is measured in Acres/Cents, rate is either applied per Acre ($\text{Rate} / 4840$) or per Cent ($\text{Rate} / 48.4$).

---

## 3. Building Structure Valuation (Part B)

### 3.1 Base Construction Rates by Structure Type
Default baseline construction rates per Square Foot (unless overridden by prevailing municipal SRO schedule or valuer inspection):
- **RCC Framed Structure:** `Rs. 1,800 / Sq.Ft`
- **Load Bearing Brick Masonry:** `Rs. 1,400 / Sq.Ft`
- **Steel / Industrial Precast Shed:** `Rs. 1,600 / Sq.Ft`

### 3.2 Floor-Wise Plinth Area Calculation
Each floor (Ground Floor, First Floor, Second Floor, etc.) is calculated dynamically:
$$\text{Floor Replacement Cost}_i = \text{Plinth Area}_i \times \text{Rate}_i$$
$$\text{Gross Replacement Cost} = \sum_{i=1}^{n} \text{Floor Replacement Cost}_i$$
$$\text{Total Plinth Area} = \sum_{i=1}^{n} \text{Plinth Area}_i$$

---

## 4. Depreciation Methodology

Banking panel valuer standards utilize the **Straight Line Depreciation Method** based on building age and total estimated life of the structure.

### Structure Life Expectations:
- **RCC Framed Structure:** $L = 60 \text{ Years}$
- **Load Bearing Structure:** $L = 40 \text{ Years}$
- **Industrial Shed:** $L = 30 \text{ Years}$

### Depreciation Formula:
$$\text{Building Age (Years)} = A = \max(0, \text{age})$$
$$\text{Depreciation Percentage} = D\% = \min\left(90\%, \text{Round}\left(\frac{A}{L} \times 100\right)\right)$$
$$\text{Depreciation Amount} = \text{Round}\left(\text{Gross Replacement Cost} \times \frac{D\%}{100}\right)$$
$$\text{Net Structure Value} = \max(0, \text{Gross Replacement Cost} - \text{Depreciation Amount})$$

> **Cap Rule:** Depreciation is strictly capped at **90%** of replacement cost to represent residual salvage value of masonry and materials.

---

## 5. Extra Items, Amenities, Services & Additions (Parts C, D, E, F)

All dynamic additions, extra structural items, compound walls, wardrobes, water tanks, and sanitary installations are aggregated:
$$\text{Amenities / Extra Value} = \sum (\text{Quantity}_j \times \text{Rate}_j)$$

---

## 6. Final Banking Valuation Metrics

### 6.1 Fair Market Value (FMV)
The prevailing total open-market value of the property:
$$\text{FMV}_{\text{Raw}} = \text{Land Value} + \text{Net Structure Value} + \text{Amenities Value}$$
$$\text{Fair Market Value (FMV)} = \text{Round}(\text{FMV}_{\text{Raw}})$$

### 6.2 Realizable Value (RV)
The estimated value obtainable in an ordinary open market sale over a reasonable marketing timeframe.
- **Standard Bank Factor:** **90%** of Fair Market Value (or verified bank parameter):
$$\text{Realizable Value} = \text{Round}(\text{FMV} \times 0.90)$$

### 6.3 Distress Sale Value (DV)
The forced sale value in case of immediate liquidation or recovery auction under SARFAESI Act.
- **Standard APGB / Banking Factor:** **80%** of Fair Market Value (or 85% of Realizable Value):
$$\text{Distress Sale Value} = \text{Round}(\text{FMV} \times 0.80)$$

### 6.4 Insurable Value (IV)
The total cost required to completely reconstruct the physical improvements and structures following damage/destruction (strictly excludes land value):
$$\text{Insurable Value} = \text{Gross Replacement Cost} + \text{Amenities / Extra Items Value}$$

---

## 7. Numeric Safety & Parsing Normalization

To eliminate `Rs. NaN` and undefined calculations:
1. **Strict Regex Numeric Extraction:** Strip non-numeric artifacts (e.g. `"1,850 Sq.Ft"`, `"Rs. 25,00,000/-"`) via:
   ```javascript
   function sanitizeNumber(val, defaultVal = 0) {
     if (val === null || val === undefined) return defaultVal;
     if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
     const cleaned = String(val).replace(/,/g, '').match(/-?[0-9]+(?:\.[0-9]+)?/);
     return cleaned ? parseFloat(cleaned[0]) : defaultVal;
   }
   ```
2. **No Automatic Zero Overwrite:** When an input is legitimately absent or under evaluation, indicate `0` with explicit audit flags rather than silently swallowing input failures.
