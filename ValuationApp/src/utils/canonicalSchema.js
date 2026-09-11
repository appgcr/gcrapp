/**
 * FRONTEND CANONICAL PROPERTY METADATA SCHEMA & NORMALIZERS
 */

export function createField(value = null, sourceDocument = null, sourcePage = null, confidence = 0, evidence = null, status = 'EMPTY', extra = {}) {
  return {
    value: value !== undefined ? value : null,
    sourceDocument: sourceDocument || null,
    sourcePage: sourcePage !== undefined ? sourcePage : null,
    confidence: typeof confidence === 'number' ? Math.min(1, Math.max(0, confidence)) : 0,
    evidence: evidence || null,
    status: status || (value !== null ? 'EXTRACTED' : 'EMPTY'),
    ...extra
  };
}

export function createEmptyCanonicalMetadata() {
  return {
    deedNo: createField(null),
    deedYear: createField(null),
    deedDate: createField(null),
    surveyNo: createField(null),
    plotNo: createField(null),
    netExtent: createField(null),
    khathaNo: createField(null),
    assessmentNo: createField(null),
    doorNo: createField(null),
    approvalPlanNo: createField(null),
    approvalPlanDate: createField(null),
    ownerName: createField(null),
    builderName: createField(null),
    managingPartner: createField(null),
    flatNo: createField(null),
    floorNo: createField(null),
    propertyType: createField(null),
    buildingAge: createField(null),
    roadWidth: createField(null),
    roadType: createField(null),
    plotType: createField(null),
    structureType: createField(null),
    flooringType: createField(null),
    documentBoundaries: {
      north: createField(null),
      south: createField(null),
      east: createField(null),
      west: createField(null)
    },
    actualBoundaries: {
      north: createField(null, null, null, 0, null, 'MANUAL'),
      south: createField(null, null, null, 0, null, 'MANUAL'),
      east: createField(null, null, null, 0, null, 'MANUAL'),
      west: createField(null, null, null, 0, null, 'MANUAL')
    },
    plinthArea: createField(null),
    floorAreas: createField([]),
    floorsSanctioned: createField(null),
    additionsWork: createField([]),
    siteValue: createField({
      plinthArea: '',
      floors: [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }]
    }),
    unitRatePerSqYd: createField(null),
    marketValue: createField(null),
    compositeValue: createField(null),
    lpNo: createField(null),
    approvalBody: createField(null),
    approachRoadWidth: createField(null),
    sroOffice: createField(null),
    village: createField(null),
    mandal: createField(null),
    district: createField(null),
    locality: createField(null),
    wardNo: createField(null),
    
    // ── APGB NEW FORMAT FIELDS ──
    fathersName: createField(null),
    branchName: createField(null),
    latitude: createField(null),
    longitude: createField(null),
    
    dimensionsDoc: {
      north: createField(null),
      south: createField(null),
      east: createField(null),
      west: createField(null)
    },
    dimensionsActual: {
      north: createField(null),
      south: createField(null),
      east: createField(null),
      west: createField(null)
    },
    
    valuationLand: createField(null),
    valuationBuilding: createField(null),
    valuationAmenities: createField(null),
    valuationServices: createField(null),
    valuationExtraItems: createField(null),
    valuationTotal: createField(null)
  };
}

export function isStrictlyEmpty(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'na' || trimmed === 'n/a' || trimmed === 'null' || trimmed === 'nil' || trimmed === 'unknown' || trimmed === 'to be verified' || trimmed === 'optional') {
      return true;
    }
  }
  return false;
}

export function normalizeDeedNo(val) {
  if (isStrictlyEmpty(val)) return null;
  const str = String(val).replace(/\s+/g, '').replace(/[-–]/g, '/');
  const match = str.match(/(\d{3,6})\/?(19\d{2}|20\d{2})?/);
  if (match) {
    return match[2] ? `${match[1]}/${match[2]}` : match[1];
  }
  return str.length >= 3 ? str : null;
}

export function normalizeSurveyNo(val) {
  if (isStrictlyEmpty(val)) return null;
  const str = String(val).trim().replace(/\s*\/\s*/g, '/');
  const match = str.match(/\b(\d{1,4}(?:\/\d{1,4}[A-Za-z0-9\-]*)?)\b/);
  return match ? match[1] : (str.length <= 20 ? str : null);
}

export function normalizePlotNo(val) {
  if (isStrictlyEmpty(val)) return null;
  const str = String(val).trim();
  if (/^\d+\/\d+-\d+/.test(str) || /^\d+\/\d+\/\d+/.test(str)) {
    return null;
  }
  const clean = str.replace(/^(?:plot\s*no\.?|ప్లాట్\s*నెం\.?)\s*/i, '').trim();
  return clean && clean.toLowerCase() !== 'na' ? clean : null;
}

export function normalizeExtent(val) {
  if (isStrictlyEmpty(val)) return null;
  const str = String(val).trim();
  const numMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  if (isNaN(num) || num <= 0) return null;

  if (/చ\.?గజములు|sq\.?\s*yards?|yds?|sy\.?\s*yards?/i.test(str)) {
    return `${num} Sq. Yards`;
  }
  if (/సెంట్లు|సెంట్ల|cents?/i.test(str)) {
    return `${num} Cents`;
  }
  if (/sq\.?\s*meters?|చ\.?మీ/i.test(str)) {
    return `${num} Sq. Meters`;
  }
  if (/sq\.?\s*ft|చ\.?అడుగులు|sft/i.test(str)) {
    return `${num} Sq. Ft`;
  }
  return `${num} Sq. Yards`;
}

export function normalizeRoadWidth(val) {
  if (isStrictlyEmpty(val)) return null;
  const str = String(val).trim();
  const numMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!numMatch) return null;
  const num = numMatch[1];
  if (/meter|మీటర్లు|mt/i.test(str)) {
    return `${num} Meters`;
  }
  return `${num} Feet`;
}

export function normalizePropertyType(val) {
  if (isStrictlyEmpty(val)) return null;
  const str = String(val).trim().toLowerCase();
  if (/apartment|multi[\s-]*dwelling|flats?|residential\s*apartment/i.test(str)) {
    return 'Apartment';
  }
  if (/individual\s*residential|single\s*family|independent\s*house|residential\s*building|house/i.test(str)) {
    return 'Independent House';
  }
  if (/vacant\s*land|open\s*plot|open\s*site/i.test(str)) {
    return 'Open Site';
  }
  if (/agriculture|agricultural|farm\s*land/i.test(str)) {
    return 'Open Agriculture Land';
  }
  return null;
}

export function normalizeStructureType(val) {
  if (isStrictlyEmpty(val)) return null;
  const str = String(val).trim().toLowerCase();
  if (/framed|rcc|r\.c\.c|reinforced\s*concrete/i.test(str)) {
    return 'Framed structure';
  }
  if (/load\s*bearing/i.test(str)) {
    return 'Load bearing';
  }
  if (/steel/i.test(str)) {
    return 'Steel Structure';
  }
  return null;
}

export function cleanBoundaryText(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (val.value !== undefined) {
      val = val.value;
    } else if (val.text !== undefined) {
      val = val.text;
    } else {
      return null;
    }
  }
  if (isStrictlyEmpty(val)) return null;
  let s = String(val).trim();
  if (s === '[object Object]' || s === 'object Object') return null;
  if (/sont/i.test(s) || /joint\s*south/i.test(s)) {
    return null;
  }
  s = s.replace(/^[\|\s\:\-]+/, '').replace(/[\|\s\:\-]+$/, '').trim();
  s = s.replace(/^(?:north|south|east|west|ఉత్తరం|దక్షిణం|తూర్పు|పడమర)\s*[:\-\.]\s*/i, '');
  s = s.replace(/[\|\:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length <= 2 || /^[a-zA-Z]{1,2}$/.test(s) || /^[\:\.\|\-]+$/.test(s)) {
    return null;
  }
  return s;
}

export function normalizeCurrency(val) {
  if (isStrictlyEmpty(val)) return null;
  const cleaned = String(val).replace(/[^0-9]/g, '');
  if (!cleaned || parseInt(cleaned, 10) === 0) return null;
  return cleaned;
}
