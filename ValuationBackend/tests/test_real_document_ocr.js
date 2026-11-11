const fs = require('fs');
const path = require('path');
const {
  createField,
  normalizeDeedNo,
  normalizeSurveyNo,
  normalizePlotNo,
  normalizeExtent,
  normalizeRoadWidth,
  normalizePropertyType,
  cleanBoundaryText
} = require('../ocr_service/canonicalSchema');
const { reconcileDocuments } = require('../ocr_service/reconciliation');

console.log('================================================================');
console.log(' GCR REAL PROPERTY DOCUMENT OCR & RECONCILIATION VALIDATION');
console.log('================================================================\n');

const sampleDir = path.join(__dirname, 'sample_docs');
const files = [
  { name: 'sale_deed.pdf', type: 'SALE_DEED', expectedDocType: 'Registered Sale Deed' },
  { name: 'building_plan.jpg', type: 'BUILDING_PLAN', expectedDocType: 'Approved Building Plan / Permit Order' },
  { name: 'property_tax.jpg', type: 'PROPERTY_TAX', expectedDocType: 'Property Tax Assessment / Receipt' },
  { name: 'market_value.jpg', type: 'MARKET_VALUE', expectedDocType: 'Market Value / Guideline Certificate' },
  { name: 'layout_plan.jpg', type: 'LAYOUT_PLAN', expectedDocType: 'Layout / Approval Plan' }
];

let passCount = 0;
let failCount = 0;

function recordTest(desc, passed, details = '') {
  if (passed) {
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${desc} - ${details}`);
    failCount++;
  }
}

// 1. Verify existence of authentic sample documents
console.log('--- 1. Sample Document Inventory & Verification ---');
files.forEach(f => {
  const filePath = path.join(sampleDir, f.name);
  const exists = fs.existsSync(filePath);
  const size = exists ? fs.statSync(filePath).size : 0;
  recordTest(`Sample file exists: ${f.name} (${(size / 1024).toFixed(1)} KB)`, exists && size > 1000);
});

// 2. Canonical bilingual extraction simulation on authentic deed metadata
console.log('\n--- 2. Bilingual OCR Extractor & Normalizer Tests ---');
const deedNoRaw = ' 8859 / 2018 ';
const normalizedDeed = normalizeDeedNo(deedNoRaw);
recordTest(`Deed number normalized: "${deedNoRaw}" -> "${normalizedDeed}"`, normalizedDeed === '8859/2018');

const surveyNoRaw = ' 176 / 2B ';
const normalizedSurvey = normalizeSurveyNo(surveyNoRaw);
recordTest(`Survey number normalized: "${surveyNoRaw}" -> "${normalizedSurvey}"`, normalizedSurvey === '176/2B');

const teluguExtentRaw = '89.3 చదరపు గజములు';
const normalizedTelExtent = normalizeExtent(teluguExtentRaw);
recordTest(`Telugu extent normalized: "${teluguExtentRaw}" -> "${normalizedTelExtent}"`, normalizedTelExtent === '89.3 Sq. Yards');

const englishExtentRaw = '89.3 Sq.Yds';
const normalizedEngExtent = normalizeExtent(englishExtentRaw);
recordTest(`English extent normalized: "${englishExtentRaw}" -> "${normalizedEngExtent}"`, normalizedEngExtent === '89.3 Sq. Yards');

// 3. Boundary Noise Filtering & Direction Stripping
console.log('\n--- 3. Boundary Noise Cleaning & Formatting ---');
const rawEast = 'తూర్పు : 24 అడుగులు వెడల్పు గల రోడ్డు.';
const cleanedEast = cleanBoundaryText(rawEast);
recordTest(`Telugu direction prefix stripped: "${cleanedEast}"`, cleanedEast === '24 అడుగులు వెడల్పు గల రోడ్డు.');

const noiseBoundary = '| joint south: | sont |';
const cleanedNoise = cleanBoundaryText(noiseBoundary);
recordTest(`OCR boundary artifact rejected: "${noiseBoundary}" -> null`, cleanedNoise === null);

// 4. Cross-Document Reconciliation & Discrepancy Gate
console.log('\n--- 4. Cross-Document Reconciliation & Conflict Detection ---');
const saleDeedData = {
  surveyNo: createField('176/2', 'saleDeed', 1, 0.98, 'Survey No: 176/2'),
  deedNo: createField('8859/2018', 'saleDeed', 2, 0.99, 'Doct No 8859/2018'),
  plotNo: createField('9', 'saleDeed', 5, 0.95, 'Plot No: 9'),
  netExtent: createField('89.3 Sq. Yards', 'saleDeed', 6, 0.95, '89.3 Sq. Yards'),
  documentBoundaries: {
    east: createField('24 Feet Wide Road', 'saleDeed', 6, 0.95, 'East: 24 Feet Wide Road'),
    west: createField('Plot 10', 'saleDeed', 6, 0.95, 'West: Plot 10'),
    north: createField('Plot 8', 'saleDeed', 6, 0.95, 'North: Plot 8'),
    south: createField('Plot 7', 'saleDeed', 6, 0.95, 'South: Plot 7')
  }
};

const taxReceiptData = {
  surveyNo: createField('176/2', 'propertyTax', 1, 0.95, 'Survey No: 176/2'),
  assessmentNo: createField('1013104872', 'propertyTax', 1, 0.98, 'Assessment No: 1013104872'),
  doorNo: createField('42/337-7-2-1', 'propertyTax', 1, 0.95, 'Door No: 42/337-7-2-1'),
  plotNo: createField('42/337-7-2-1', 'propertyTax', 1, 0.50, 'Door used as plot'), // Misclassified
  ownerName: createField('P. Lakshmi Devi', 'propertyTax', 1, 0.90, 'Owner: P. Lakshmi Devi')
};

const permitData = {
  surveyNo: createField('176/2', 'buildingPlan', 1, 0.97, 'Survey No: 176/2'),
  plotNo: createField('9', 'buildingPlan', 1, 0.95, 'Plot 9'),
  floorAreas: [
    { floor: 'Ground Floor', area: '650', unit: 'sq.ft', source: 'buildingPlan' },
    { floor: 'First Floor', area: '600', unit: 'sq.ft', source: 'buildingPlan' }
  ]
};

// Reconcile
const reconciled = reconcileDocuments({
  saleDeed: saleDeedData,
  propertyTax: taxReceiptData,
  buildingPlan: permitData
});

recordTest('Survey Number verified across 3 documents', reconciled.surveyNo.status === 'VERIFIED' && reconciled.surveyNo.value === '176/2');
recordTest('Deed Number preserved from authoritative Sale Deed', reconciled.deedNo.value === '8859/2018');
recordTest('Door number rejected as plot number', reconciled.plotNo.value === '9');
recordTest('Plinth floor areas synthesized from building permit', reconciled.siteValue.value.floors.length === 2);

// 5. Critical Invariant: On-site boundaries NEVER auto-filled from documents
console.log('\n--- 5. Critical Boundary Safety Invariant ---');
recordTest('Actual North boundary remains MANUAL and null', reconciled.actualBoundaries.north.status === 'MANUAL' && reconciled.actualBoundaries.north.value === null);
recordTest('Actual South boundary remains MANUAL and null', reconciled.actualBoundaries.south.status === 'MANUAL' && reconciled.actualBoundaries.south.value === null);
recordTest('Actual East boundary remains MANUAL and null', reconciled.actualBoundaries.east.status === 'MANUAL' && reconciled.actualBoundaries.east.value === null);
recordTest('Actual West boundary remains MANUAL and null', reconciled.actualBoundaries.west.status === 'MANUAL' && reconciled.actualBoundaries.west.value === null);

// 6. Conflict Detection Test
console.log('\n--- 6. Conflict Detection & Non-Merging Invariant ---');
const conflictingDeed = {
  plotNo: createField('9', 'saleDeed', 1, 0.95, 'Plot 9')
};
const conflictingTax = {
  plotNo: createField('15', 'propertyTax', 1, 0.95, 'Plot 15')
};
const conflictResult = reconcileDocuments({
  saleDeed: conflictingDeed,
  propertyTax: conflictingTax
});

recordTest('Conflicting plot numbers detected as CONFLICT', conflictResult.plotNo.status === 'CONFLICT');
recordTest('Conflicting values NOT automatically merged (value is null)', conflictResult.plotNo.value === null);
recordTest('Conflicting sources preserved for engineer review', conflictResult.plotNo.values.length === 2);

console.log('\n================================================================');
console.log(`REAL DOCUMENT VALIDATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
