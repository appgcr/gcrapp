# GCR REPORT FIELD MAPPING MATRIX

## Full Dynamic Field Mapping: Case Database → APGB Master Report

**Author:** Principal Software Architect & Document Automation Specialist  
**Authoritative Reference File:** `reference_documents/HOUSE APGB NEW FORMET.docx`  
**Authoritative Generator Target:** `ValuationBackend/services/masterDocxGenerator.js`

---

## 1. Field-by-Field Master Mapping Matrix

| Report Field Label / Table Cell | Case Data Source (DB / Model) | Fallback / Default Value | Data Type / Format |
|:---|:---|:---|:---|
| **Header Valuer Name** | `config.valuerProfile.name` | `"Sri Gouru. Neelakanta Reddy"` | Text (Title Case) |
| **Header Valuer Qualifications** | `config.valuerProfile.qualifications` | `"B.Tech, MISTE, F.I.V."` | Text |
| **Header Valuer Wealth Tax Reg** | `config.valuerProfile.wealthTaxReg` | `"Regd under Sec 34AB of Wealth Tax Act"` | Text |
| **Header Valuer Reg No** | `config.valuerProfile.regNo` | `"F - 13622"` | Text |
| **Header File No** | `case.id` | `"2605115"` | Text / Code |
| **Bank Name** | `case.bankName` | `"ANDHRA PRADESH GRAMEENA BANK"` | Dynamic Text |
| **Bank District** | `case.bankDistrict` | `"Y.S.R"` | Text |
| **Bank Branch** | `case.bankBranch` | `"POLICE LANE BRANCH, KADAPA"` | Text |
| **Date of Valuation** | `case.propertyDetails.valuationDate` \|\| Current Date | `DD-MM-YYYY` | Formatted Date |
| **Borrower / Applicant Name** | `case.clientName` | `"Sri M. Subba Naik"` | Text |
| **Father / Husband Name** | `case.clientFatherName` \|\| `propertyDetails.fathersName` | `"Sri M. Jamla Naik (late)"` | Text |
| **Property Door No** | `case.propertyDetails.doorNo` | `""` | Text |
| **Property Survey No** | `case.propertyDetails.surveyNo` | `""` | Text |
| **Property Plot No** | `case.propertyDetails.plotNo` | `""` | Text |
| **Property Ward No** | `case.propertyDetails.wardNo` | `""` | Text |
| **Registered Deed No & Year** | `case.propertyDetails.deedNo` + `/` + `deedYear` | `""` | Text |
| **Net Extent** | `case.propertyDetails.netExtent` | `""` | Numeric + Unit |
| **Approved Plan B.A. No & Dt** | `case.propertyDetails.approvalPlanNo`, `approvalPlanDate` | `"N/A"` | Text |
| **Valuation Summary Figure** | `case.valuation.fairMarketValue` | `Rs. {amount}/-` | Indian Currency Format |
| **Valuation in Words** | `numberToIndianWords(fairMarketValue)` | `"RUPEES ... ONLY"` | Capitalized Words |
| **Table 0 - Purpose** | `"Collateral Security for Bank Loan"` | `"Bank Purpose"` | Standard Banking Text |
| **Table 0 - Date of Inspection** | `case.inspectionDate` | Date string | DD-MM-YYYY |
| **Table 0 - List of Documents** | Aggregated from uploaded documents | `"Sale Deed, Building Plan, Tax Receipt"` | Comma Separated |
| **Table 1 - Boundaries Doc (E, W, N, S)** | `propertyDetails.boundariesDoc[dir]` | `""` | Descriptive Text |
| **Table 1 - Boundaries Actual (E, W, N, S)**| `propertyDetails.boundariesActual[dir]` | `""` | Descriptive Text |
| **Table 1 - Dimensions Doc (E, W, N, S)** | `propertyDetails.dimensionsDoc[dir]` | `""` | Numeric + Unit |
| **Table 1 - Dimensions Actual (E, W, N, S)**| `propertyDetails.dimensionsActual[dir]` | `""` | Numeric + Unit |
| **Table 1 - GPS Coordinates** | `case.currentLocation.lat`, `lng` \|\| `propertyDetails.latitude`, `longitude` | `"14.448828, 78.806303"` | Decimal Lat/Lng |
| **Table 1 - Extent Considered** | `min(extentDoc, extentActual)` | Extent in Cents/Sq.Yards | Formatted Extent |
| **Table 1 - Road Width & Type** | `propertyDetails.roadWidth` + `propertyDetails.roadType` | `""` | Text |
| **Table 2 - Type of Building** | `propertyDetails.propertyType` | `"Residential"` | Text |
| **Table 2 - Type of Construction** | `propertyDetails.structureType` | `"RCC Framed Structure"` | Text |
| **Table 2 - Age of Building** | `propertyDetails.buildingAge` | `""` | Integer Years |
| **Table 3 - Construction Specifications** | Foundation, Basement, Roof, Flooring, Joinery | Mapped from property inspection | Standard Civil Specs |
| **Table 4 - Floor-wise Plinth Area** | `propertyDetails.siteValue.floors[]` | Ground Floor, First Floor, etc. | Array of Floor Rows |
| **Table 5 - Part C Extra Items** | `propertyDetails.extraItems[]` | Portico, Grills, Gates, Tank | Rows with Amounts |
| **Table 6 - Part D Amenities** | `propertyDetails.amenities[]` | Wardrobes, Interior, Tiles | Rows with Amounts |
| **Table 7 - Part E Miscellaneous** | `propertyDetails.miscellaneous[]` | Sump, Compound Wall, Garden | Rows with Amounts |
| **Table 8 - Part F Services** | `propertyDetails.services[]` | Water, Drainage, Electricity | Rows with Amounts |
| **Table 9 - Summary Breakdown** | `valuation.landValue`, `netStructureValue`, etc. | Parts A through F | Standard Banking Table |
| **Table 10 - Realizable Value** | `valuation.realizableValue` | 90% of Fair Market Value | Formatted Currency |
| **Table 10 - Distress Sale Value** | `valuation.distressSaleValue` | 80% of Fair Market Value | Formatted Currency |
| **Table 11 - Valuer Comments (12 Items)** | Standard Mandated Statutory Valuer Responses | Pre-filled standard statutory clauses | Standard Legal Text |
| **Site Photographs** | `case.sitePhotos[]` | Geo-tagged site images | Embedded Images + Coordinates |
| **Valuer Signature** | `case.signatureDataUrl` | Canvas Digital Signature | Embedded PNG Signature |

---

## 2. Multi-Bank Dynamic Variations

When different banks are selected, the document renders identically with these exact dynamic changes:
1. **Bank Name & Subtitle:** Automatically updated in letterhead subtitle and report cover.
2. **Bank Logo:** Dynamically loaded from official SVG/PNG bank asset registry.
3. **Appointing Authority Line in Table 11:** Dynamically set to `"The Branch Manager, {case.bankName}, {case.bankBranch}"`.
4. **Loan Ref / Code:** Preserved in file number.
