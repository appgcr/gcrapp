# GCR ENGINEER FORM FIELD MAPPING & CANONICAL SCHEMA

## Authoritative Form Field Inventory & Mapping Specification

**Author:** Principal Software Architect & Senior QA Lead  
**Applicable Components:**
- Frontend Form: [`Step3PropertyDetails.jsx`](file:///Users/apple/GCR%20/gcrapp/ValuationApp/src/components/EngineerPortal/CaseModalSteps/Step3PropertyDetails.jsx)
- Frontend Validation: [`caseValidationHelpers.js`](file:///Users/apple/GCR%20/gcrapp/ValuationApp/src/components/EngineerPortal/caseValidationHelpers.js)
- Canonical Schemas:
  - Frontend: [`ValuationApp/src/utils/canonicalSchema.js`](file:///Users/apple/GCR%20/gcrapp/ValuationApp/src/utils/canonicalSchema.js)
  - Backend: [`ValuationBackend/ocr_service/canonicalSchema.js`](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/ocr_service/canonicalSchema.js)
- Database Model: [`ValuationBackend/models/ValuationCase.js`](file:///Users/apple/GCR%20/gcrapp/ValuationBackend/models/ValuationCase.js)
- Native Android DTO: [`GCRNativeAndroid/app/src/main/kotlin/com/gcrapp/valuation/data/model/ValuationCaseDto.kt`](file:///Users/apple/GCR%20/gcrapp/GCRNativeAndroid/app/src/main/kotlin/com/gcrapp/valuation/data/model/ValuationCaseDto.kt)

---

## 1. Unified Property Categories

Authoritative synchronized list across backend `AppConfig.js`, MongoDB schema, React dropdowns, and Android Kotlin DTOs:

1. **Apartment** (`"Apartment"`)
2. **Independent House** (`"Independent House"`)
3. **Open Agriculture Land** (`"Open Agriculture Land"`)
4. **Open Site** (`"Open Site"`)
5. **Commercial Building** (`"Commercial Building"`)
6. **Industrial Unit** (`"Industrial Unit"`)

---

## 2. Conditional Field Visibility Matrix

Fields dynamically render based on selected `propertyType`:

| Field Name | DB Key | Apartment | Independent House | Open Site | Open Ag Land | Commercial | Industrial |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Deed No & Year** | `deedNo`, `deedYear` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Survey No / S.No** | `surveyNo` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Plot No / D.No** | `plotNo`, `doorNo` | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **Net Land Extent** | `netExtent` | ✓ (UDS) | ✓ | ✓ | ✓ (Acres) | ✓ | ✓ |
| **Boundaries (N, S, E, W)** | `boundariesDoc`, `boundariesActual` | ✓ (Flat/Bldg) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Boundary Dimensions** | `dimensionsDoc`, `dimensionsActual` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Road Width & Type** | `roadWidth`, `roadType` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Plot Type** | `plotType` | — | ✓ | ✓ | — | ✓ | ✓ |
| **Building Age / Year** | `buildingAge`, `yearOfConstruction` | ✓ | ✓ | — | — | ✓ | ✓ |
| **Structure Type** | `structureType` | ✓ | ✓ | — | — | ✓ | ✓ |
| **Flooring Type** | `flooringType` | ✓ | ✓ | — | — | ✓ | ✓ |
| **Builder / Partner** | `builderName`, `managingPartner` | ✓ | — | — | — | — | — |
| **Flat No & Floor No** | `flatNo`, `floorNo` | ✓ | — | — | — | — | — |
| **Multi-Floor Plinth Area** | `siteValue.floors[]` | — | ✓ | — | — | ✓ | ✓ |
| **Extra Items & Additions** | `additionsWork[]` | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **APGB Specific Card** | `wardNo`, `fathersName`, etc. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 3. Detailed Field Inventory & Harmonization

### 3.1 Boundaries & Dimensions (N, S, E, W)
- **Document Boundary Description:** String (e.g. `"30 Feet Wide Road"`, `"House of Ramana"`)
- **Actual Ground Boundary:** String
- **Document Linear Dimension:** Numeric value
- **Actual Linear Dimension:** Numeric value
- **Dimension Unit:** Selectable: `Feet`, `Metres`, `Links` (Default: `Feet`, with auto-conversion to Feet & Metres in Master Report).

### 3.2 Plot Types
Authoritative options:
1. `Corner Plot`
2. `Intermediary Plot`
3. `Road-Facing Plot`

### 3.3 Road Types
Authoritative options:
1. `CC Road` (Cement Concrete)
2. `BT Road` (Black Top / Tar Road)
3. `Metal Road`
4. `WBM Road` (Water Bound Macadam)
5. `Mud / Gravel Road`

### 3.4 Flooring Types
Authoritative options:
1. `Granite`
2. `Tiles`
3. `Vitrified Tiles`
4. `Marble`
5. `Cement Flooring`
6. `Mosaic`

### 3.5 Dynamic Multi-Floor Structure
Dynamic floor array supporting up to 10 floors (`Ground Floor`, `First Floor`, `Second Floor`, `Third Floor`, `Fourth Floor`, `Fifth Floor`, etc.):
```javascript
{
  id: "floor_0",
  label: "Ground Floor (GF)",
  plinthArea: 750,        // Sq.Ft
  rate: 1800,             // Rate per Sq.Ft
  roofHeight: "10'",      // Standard roof height
  flooringType: "Vitrified Tiles",
  description: "Living hall, 2 bed rooms, kitchen, attached bath"
}
```
