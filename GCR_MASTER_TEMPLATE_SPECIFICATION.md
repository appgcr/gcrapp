# GCR MASTER TEMPLATE SPECIFICATION
## Comprehensive Specification for Common Master Valuation Report Based on Andhra Pragathi Grameena Bank (APGB) Reference Documents

**Author:** Principal Software Architect & Banking Property Valuation Domain Specialist  
**Project:** GCR Property Valuation Management System  
**Reference Document Sources:**
1. `reference_documents/HOUSE APGB NEW FORMET.docx` (Residential House / Building)
2. `reference_documents/APGB APARTMENTS (1).docx` (Apartment / Flat)
3. `reference_documents/OPEN SITE APGB.docx` (Open Site / Commercial Plot)
4. `reference_documents/OPEN AGRICULTURE LAND APGB NEW FORMET.docx` (Agricultural Land)
5. `reference_documents/SBI_Valuation_Report_VAL-2026-675N.docx` (State Bank of India Reference)

---

## 1. Executive Summary & Design Principle

GCR supports 14+ Indian scheduled commercial banks and regional rural banks (including APGB, SBI, Canara Bank, Union Bank, PNB, Indian Bank, etc.). In accordance with **Section 1.1 of the Business Requirements**:

> **All banks use ONE COMMON MASTER REPORT FORMAT based on the verified APGB reference report.**
> The report structure remains 100% identical across all banks:
> - Same page sequence
> - Same section sequence
> - Same headings
> - Same standard wording
> - Same tables & breakdown
> - Same declarations & code of conduct
> - Same headers, footers & signatures
> - Same annexures
>
> **Only dynamic variables change:**
> Bank logo, bank name, branch details, inspection/valuation dates, borrower details, valuer credentials, property measurements, valuation figures, site photos, and geo-maps.

---

## 2. Master Document Structural Anatomy

The verified APGB Master Document consists of 9 core modules spanning multiple pages:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. VALUER LETTERHEAD & APPOINTING BANK HEADER                          │
│    - Panel Valuer Contact, Qualifications, Wealth Tax Reg, Reg No      │
│    - Appointing Bank Name, Logo, District, Branch, Date, File No       │
├────────────────────────────────────────────────────────────────────────┤
│ 2. CASE TITLE & PREFACE SUMMARY                                        │
│    - Borrower/Owner Name, Door No, Deed No, Survey No, Net Extent      │
│    - Building Approval Details (B.A. No, Date)                         │
│    - Total Valuation Figure (Numbers + Words in Rupees)                │
├────────────────────────────────────────────────────────────────────────┤
│ 3. PART I: GENERAL INFORMATION (TABLE 0 - 24 Rows)                     │
│    - Purpose, Inspection Date, Valuation Date, Documents Perused      │
│    - Postal Address, Municipal/Gram Panchayat limits, Approvals        │
├────────────────────────────────────────────────────────────────────────┤
│ 4. PART II: SITE CHARACTERISTICS & BOUNDARIES (TABLE 1 - 54 Rows)      │
│    - Boundaries (Doc vs Actual) for North, South, East, West           │
│    - Linear Dimensions (Doc vs Actual) in Links, Feet, Metres          │
│    - GPS Coordinates (Latitude, Longitude), Extent Considered          │
│    - Classification of Locality, Road Width, Road Type, Plot Type      │
├────────────────────────────────────────────────────────────────────────┤
│ 5. PART B: VALUATION OF BUILDING / STRUCTURE (TABLES 2, 3, 4)          │
│    - Technical Details: RCC/Load Bearing, Year Built, Building Age     │
│    - Construction Specifications (Foundation, Basement, Roof, Joinery) │
│    - Floor-by-Floor Plinth Area Table (GF, FF, SF, TF, etc.)           │
│    - Roof Height, Floor Area (Sq.Ft), Replacement Rate, Depreciation   │
├────────────────────────────────────────────────────────────────────────┤
│ 6. VALUATION BREAKDOWN PARTS C, D, E, F (TABLES 5, 6, 7, 8)            │
│    - Part C: Extra Items (Portico, Front Door, Steel Grills, Tank)     │
│    - Part D: Amenities (Wardrobes, Interior Decorations, Glazed Tiles) │
│    - Part E: Miscellaneous (Separate Toilet, Sump, Trees, Garden)      │
│    - Part F: Services (Water Supply, Drainage, Compound Wall, Electr.) │
├────────────────────────────────────────────────────────────────────────┤
│ 7. SUMMARY OF VALUATION & REALIZABLE/DISTRESS VALUES (TABLES 9 & 10)   │
│    - Part A (Land), Part B (Building), Part C, D, E, F                 │
│    - Total Value & "Say As" Rounded Figure                             │
│    - Fair Market Value (100%), Realizable (90%), Distress (80%)        │
├────────────────────────────────────────────────────────────────────────┤
│ 8. STATUTORY VALUER CERTIFICATE & ANNEXURE III (TABLE 11 & CODE)       │
│    - 12-Point Mandated Valuer Comment Matrix (Asset Info, Purpose, etc)│
│    - Wealth Tax Act 1957 Sec 34AB Declaration                          │
│    - Model Code of Conduct for Empanelled Valuers                      │
│    - Valuer Signature Block & Seal                                     │
├────────────────────────────────────────────────────────────────────────┤
│ 9. ANNEXURES: MAPS & PHOTOGRAPHS                                       │
│    - Geo-tagged Site Photographs (Front, Sides, Interior, Road)        │
│    - Cadastral / Location Map / Google Satellite Map with GPS pin      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Page-by-Page and Section-by-Section Mapping

### Page 1: Letterhead, Bank Heading & Executive Summary

#### 1. Valuer Letterhead (Top Header)
- **Valuer Name & Titles:** `Sri Gouru. Neelakanta Reddy, B.Tech, MISTE, F.I.V.` (Configurable from Valuer Profile)
- **Designation:** `Civil Engineering Consultant, Approved Panel Valuer`
- **Panel of Banks:** Listed panel memberships
- **Contact:** Mobile / Office Phone numbers
- **Office Address:** `Door No: 21/659, Beside L.G Show Room, 7 Roads, Kadapa, Y.S.R (Dist), A.P.`
- **Registration Details:** `Indian Institution of Valuers F – 13622`, `Wealth Tax Reg Under Sec 34AB`
- **File Number:** `FILE NO: {case.id}`

#### 2. Bank Identity Block
- **Document Title:** `VALUATION REPORT`
- **Bank Logo:** Dynamically placed left/center (Official bank logo asset)
- **Bank Name:** Dynamic (e.g. `ANDHRA PRADESH GRAMEENA BANK`, `STATE BANK OF INDIA`, etc.)
- **District:** `{case.bankDistrict}`
- **Branch:** `{case.bankBranch}`
- **Date of Valuation:** `{valuationDate}` (DD-MM-YYYY)

#### 3. Brief Particulars
- **Belongs to (Applicant/Owner):** `{case.clientName}, S/o {case.clientFatherName}`
- **Property Address:** `{case.address || case.propertyDetails.doorNo + ', ' + ...}`
- **Registration Deed Details:** `Deed No: {deedNo}/{deedYear}`, `Survey No: {surveyNo}`, `Plot No: {plotNo}`
- **Net Extent:** `{netExtent}` (in Cents / Sq.Yards)
- **Building Approval:** `Plan Approved Under B.A.No: {approvalPlanNo}, Dt: {approvalPlanDate}`
- **Total Valuation Amount:** `Rs. {fairMarketValue}/-` (`RUPEES {amountInWords} ONLY`)

---

### Pages 2 & 3: Part I (General) & Part II (Site Characteristics & Boundaries)

#### Table 0: Part I — General Information
| Sl No | Description | Reference / Value |
|:---|:---|:---|
| 1. | Purpose for which valuation is made | `Bank Purpose / Collateral Security` |
| 2. a) | Date of inspection | `{inspectionDate}` |
| 2. b) | Date on which valuation is made | `{valuationDate}` |
| 3. | List of documents produced for perusal | `Sale Deed No. {deedNo}, Building Plan, Property Tax, EC` |
| 4. | Name of the owner(s) and address | `{ownerName}, {doorNo}, {locality}, {mandal}, {district}` |
| 5. | Brief description of the property | `{propertyType} comprising {plinthArea} Sq.Ft` |
| 6. | Location of property (Door No, Survey No, Ward No) | `Survey No: {surveyNo}, Door No: {doorNo}, Ward: {wardNo}` |
| 7. | Postal Address of the property | Complete verified postal address |
| 8. | City / Town / Village / Mandal | `{locality}, {mandal}, {district}` |
| 9. | Coming under Corporation / Municipality / Panchayat | `{localBodyType}` |
| 10. | Enactments / Urban Land Ceiling applicability | `No / Not Covered` |

#### Table 1: Part II — Site Characteristics & Four Boundaries
| Sl No | Description | As Per Deed | Actual on Ground |
|:---|:---|:---|:---|
| **13. East** | East Boundary | `{boundariesDoc.east}` | `{boundariesActual.east}` |
| **13. West** | West Boundary | `{boundariesDoc.west}` | `{boundariesActual.west}` |
| **13. North** | North Boundary | `{boundariesDoc.north}` | `{boundariesActual.north}` |
| **13. South** | South Boundary | `{boundariesDoc.south}` | `{boundariesActual.south}` |
| **14.1 East** | Linear Dimension East | `{dimensionsDoc.east} {unit}` | `{dimensionsActual.east} {unit}` |
| **14.1 West** | Linear Dimension West | `{dimensionsDoc.west} {unit}` | `{dimensionsActual.west} {unit}` |
| **14.1 North** | Linear Dimension North | `{dimensionsDoc.north} {unit}` | `{dimensionsActual.north} {unit}` |
| **14.1 South** | Linear Dimension South | `{dimensionsDoc.south} {unit}` | `{dimensionsActual.south} {unit}` |
| **14.2** | GPS Coordinates | Latitude: `{lat}` | Longitude: `{lng}` |
| **15.** | Extent of the site | `{netExtent}` (in Cents, Sq.Yds, Sq.Mtrs) |
| **16.** | Extent considered for valuation | **Least of Document Extent & Actual Extent** |
| **17.** | Occupancy Status | `Owner Occupied / Tenanted` |
| **18.** | Road Width & Access | `{roadWidth} Feet/Mtrs {roadType}` |
| **19.** | Plot Type | `{plotType}` (Corner / Intermediary / Road-Facing) |

---

### Pages 4 & 5: Part B — Valuation of Building / Construction Specifications

#### Table 2: Technical Details of Building
- **Type of Building:** `Residential / Commercial / Industrial / Apartment`
- **Type of Construction:** `RCC Framed Structure / Load Bearing / Steel Framed`
- **Year of Construction:** `{yearOfConstruction}`
- **Age of the Building:** `{buildingAge} Years`
- **Estimated Total Life of Structure:** `60 Years (RCC) / 40 Years (Load Bearing)`

#### Table 3: Construction Specifications Table
| S.No | Description | Ground Floor | Upper Floors |
|:---|:---|:---|:---|
| 1. | Foundation | `R.C.C Framed Isolated Footing` | `Column Extension` |
| 2. | Basement | `R.R. Stone Masonry in C.M` | `N/A` |
| 3. | Superstructure | `Brick Masonry in C.M (1:6)` | `Brick Masonry in C.M (1:6)` |
| 4. | Joinery / Doors & Windows | `Teakwood Frame & Flush Shutters` | `Country Wood / UPVC` |
| 5. | Flooring | `{flooringType}` | `{flooringType}` |
| 6. | Roofing | `R.C.C. Slab (1:2:4)` | `R.C.C. Slab (1:2:4)` |
| 7. | Plastering | `Cement Plastered with smooth finish` | `Cement Plastered` |
| 8. | Painting | `Plastic Emulsion / OBD` | `Plastic Emulsion / OBD` |
| 9. | Electrical Installation | `Concealed PVC Conduit Copper Wiring` | `Concealed Copper Wiring` |

#### Table 4: Floor-by-Floor Plinth Area & Replacement Cost
| S.No | Particulars of Item | Plinth Area | Roof Height | Age | Replacement Rate | Replacement Cost | Depreciation Amount | Net Value |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| 1 | Ground Floor | `{f[0].area} Sq.Ft` | 10' | `{age} Yrs` | `Rs. {f[0].rate}/-` | `Rs. {f[0].gross}` | `Rs. {f[0].deprec}` | `Rs. {f[0].net}` |
| 2 | First Floor | `{f[1].area} Sq.Ft` | 10' | `{age} Yrs` | `Rs. {f[1].rate}/-` | `Rs. {f[1].gross}` | `Rs. {f[1].deprec}` | `Rs. {f[1].net}` |
| .. | Additional Floors | ... | ... | ... | ... | ... | ... | ... |
| **Total** | **Building Replacement Total** | **{totalArea} Sq.Ft** | | | | **Rs. {grossBldg}** | **Rs. {totalDeprec}** | **Rs. {netBldg}** |

---

### Page 6: Parts C, D, E, F & Summary Table 9 & 10

#### Tables 5, 6, 7, 8: Extra Items, Amenities, Services
- **Part C (Extra Items):** Portico, Sit-out/Verandah, Overhead Tank, Steel Gates.
- **Part D (Amenities):** Wardrobes/Cupboards, Interior Decorations, False Ceiling.
- **Part E (Miscellaneous):** Sump, Septic Tank, Boundary Compound Wall, Trees.
- **Part F (Services):** Water supply, Drainage connection, Electricity CB deposits.

#### Table 9: Summary of Valuation
| Part | Item Description | Amount in Rupees |
|:---|:---|:---|
| **Part - A** | **Land Value (Extent × Rate)** | `Rs. {valuation.landValue}/-` |
| **Part - B** | **Building Value (Net Structure)** | `Rs. {valuation.netStructureValue}/-` |
| **Part - C** | **Extra Items** | `Rs. {valuation.extraItemsValue}/-` |
| **Part - D** | **Amenities** | `Rs. {valuation.amenitiesValue}/-` |
| **Part - E** | **Miscellaneous** | `Rs. {valuation.miscValue}/-` |
| **Part - F** | **Services** | `Rs. {valuation.servicesValue}/-` |
| | **Total Value Arrived At** | `Rs. {fairMarketValueRaw}/-` |
| | **Say As (Rounded Market Value)** | **Rs. {fairMarketValue}/-** |
| | **Amount in Words** | **Rupees {amountInWords} Only** |

#### Table 10: Banking Security Valuation (FMV, Realizable, Distress)
| Security Valuation Parameter | Standard Bank Factor | Calculated Amount |
|:---|:---|:---|
| **Fair Market Value of the Property** | 100% of Evaluated Worth | **Rs. {fairMarketValue}/-** |
| **Realizable Value of the Property** | **90%** of Fair Market Value | **Rs. {realizableValue}/-** |
| **Distress Sale Value of the Property** | **80%** of Fair Market Value | **Rs. {distressSaleValue}/-** |
| **Insurable Value of Building Structure** | Gross Replacement Cost + Amenities | **Rs. {insurableValue}/-** |

---

### Page 7: Statutory Valuer Declaration & Model Code of Conduct (Table 11)

#### Table 11: 12-Point Mandated Valuer Comment Matrix
1. **Background information of the asset being valued**
2. **Purpose of valuation and appointing authority**
3. **Identity of the valuer and any other experts involved**
4. **Disclosure of valuer interest or conflict**
5. **Date of appointment, valuation date and inspection date**
6. **Inspections and investigations undertaken**
7. **Nature and source of information relied upon**
8. **Procedures adopted in carrying out the valuation**
9. **Major factors that influenced the valuation**
10. **Caveats, limitations, and disclaimers**
11. **Valuation methodology used**
12. **Declaration of compliance with Companies Act / Wealth Tax Act**

#### Valuer Declarations & Indemnity
- Registered under Section 34 AB of Wealth Tax Act, 1957.
- Model Code of Conduct under Annexure-III fully accepted.
- Valuer Signature Block, Date, Place (Kadapa), Official Seal.

---

### Pages 8 & 9: Location Maps & Geo-Tagged Site Photographs
- **Location Map / Cadastral Map:** Scaled layout showing approach road and surroundings.
- **Google Satellite View:** Plotted GPS pin with coordinates `14.xxxx° N, 78.xxxx° E`.
- **Site Photographs Matrix:** 4 to 8 high-resolution photos:
  - Front Elevation with Main Entrance
  - Approach Road (showing width and road type)
  - Left & Right Boundary lines
  - Interior Hall / Rooms / Flooring
  - Rooftop / Structural Elements
  - Time, date, and GPS watermark beneath every photograph.

---

## 4. Property Category Variations in Master Format

While the master structure is 100% unified, property category determines which sub-tables activate:

| Property Category | Land Table | Building Table 4 | Amenities / Extras | Key Unique Fields |
|:---|:---|:---|:---|:---|
| **Independent House** | Extent in Cents/Sq.Yards | Multi-floor plinth (GF, FF, SF) | Full (Parts C, D, E, F) | Age, Roof Height, Structure Type |
| **Apartment** | Undivided Share of Land (UDS) | Flat Built-up / Carpet Area | Full (Interior/Lift/Amenities) | Flat No, Floor No, Builder Name, UDS |
| **Open Site** | Extent in Cents/Sq.Yards | Not Applicable (`---`) | Compound Wall / Fencing | Corner/Road-facing, Layout Approval |
| **Open Agriculture** | Extent in Acres / Cents | Not Applicable (`---`) | Borewell, Sump, Crop | Sub-Registrar Wet/Dry Rate, Survey No |
| **Commercial Building** | Commercial Site Extent | Multi-floor Commercial specs | Heavy Wiring, Lift, Rollers | Usage, Rent Potential, Rolling Shutters |
| **Industrial Unit** | Industrial Extent | Shed Plinth / Heavy RCC | Substation, Sheds, Craneway | Industrial Zone, Shed Height, Floor Load |

---

## 5. Technical Deliverable Checklist

1. **Authoritative Generator Location:** `ValuationBackend/services/masterDocxGenerator.js` (Server-side single source of truth).
2. **Elimination of Competing Generators:** Frontend `docxGenerator.js` retired in favor of direct streaming from backend `GET /api/cases/:id/report`.
3. **Format Support:** High-fidelity DOCX generation with matching server-side PDF conversion.
