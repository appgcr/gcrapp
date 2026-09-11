const assert = require('assert');
const {
  createField,
  normalizeDeedNo,
  normalizeSurveyNo,
  normalizePlotNo,
  normalizeExtent,
  normalizePropertyType,
  cleanBoundaryText
} = require('../ocr_service/canonicalSchema');
const {
  reconcileDocuments,
  areValuesEqual
} = require('../ocr_service/reconciliation');

console.log('--- Testing canonicalSchema normalizers ---');
assert.strictEqual(normalizeDeedNo(' 8582 / 2018 '), '8582/2018');
assert.strictEqual(normalizeSurveyNo(' 176 / 2 '), '176/2');
assert.strictEqual(normalizePlotNo('Plot No. 8'), '8');
assert.strictEqual(normalizePlotNo('58/384-2-1-2'), null); // Door no filtered from plot no
assert.strictEqual(normalizePlotNo('NA'), null);
assert.strictEqual(normalizeExtent('177.77 చ.గజములు'), '177.77 Sq. Yards');
assert.strictEqual(normalizeExtent('89.3 sq. yards'), '89.3 Sq. Yards');
assert.strictEqual(normalizePropertyType('Individual Residential Building'), 'Independent House');
assert.strictEqual(cleanBoundaryText('| joint south: | sont |'), null);
assert.strictEqual(cleanBoundaryText('తూర్పు : 24 అడుగులు వెడల్పు గల రోడ్డు.'), '24 అడుగులు వెడల్పు గల రోడ్డు.');

console.log('--- Testing reconciliation engine ---');
// Agreement test: Survey No matches across Sale Deed and Building Permit
const testDoc1 = {
  surveyNo: createField('176/2', 'saleDeed', 1, 0.98, 'Survey No: 176/2'),
  deedNo: createField('8582/2018', 'saleDeed', 2, 0.99, 'Doct No 8582/2018'),
  plotNo: createField('8', 'saleDeed', 5, 0.95, 'ప్లాట్ నెం. 8'),
  netExtent: createField('89.3 Sq. Yards', 'saleDeed', 6, 0.95, '89.3 Sq. Yards'),
  documentBoundaries: {
    east: createField('24 Feet Wide Road', 'saleDeed', 6, 0.95, 'East: 24 Feet Wide Road'),
    west: createField('Plot No. 9', 'saleDeed', 6, 0.95, 'West: Plot No. 9'),
    north: createField('Compound wall', 'saleDeed', 6, 0.95, 'North: Compound wall'),
    south: createField('Plot No. 7', 'saleDeed', 6, 0.95, 'South: Plot No. 7')
  }
};

const testDoc2 = {
  surveyNo: createField('176 / 2', 'buildingPlan', 1, 0.97, 'Survey No: 176/2'),
  doorNo: createField('58/384-2-1-2', 'buildingPlan', 1, 0.95, 'Premises: 58/384-2-1-2'),
  propertyType: createField('Individual Residential Building', 'buildingPlan', 1, 0.95, 'Plot Sub-Use: Individual Residential Building'),
  builderName: createField('NA', 'buildingPlan', 1, 0.95, 'Builder: NA'), // should NOT be auto-filled!
  floorAreas: [
    { floor: 'Ground Floor', area: '803.7', unit: 'sq.ft', source: 'buildingPlan' },
    { floor: 'First Floor', area: '803.7', unit: 'sq.ft', source: 'buildingPlan' }
  ]
};

const reconciled = reconcileDocuments({ saleDeed: testDoc1, buildingPlan: testDoc2 });

// Verify Survey No was agreed upon and marked VERIFIED
assert.strictEqual(reconciled.surveyNo.status, 'VERIFIED');
assert.strictEqual(reconciled.surveyNo.value, '176/2');
assert.strictEqual(reconciled.surveyNo.sources.length, 2);

// Verify Builder Name is null and not "NA"
assert.strictEqual(reconciled.builderName.value, null);

// Verify Property Type is normalized to Independent House
assert.strictEqual(reconciled.propertyType.value, 'Independent House');

// Verify actualBoundaries are strictly MANUAL and null
assert.strictEqual(reconciled.actualBoundaries.north.status, 'MANUAL');
assert.strictEqual(reconciled.actualBoundaries.north.value, null);

// Verify Floor Areas synthesized into siteValue.floors
assert.strictEqual(reconciled.siteValue.value.floors.length, 2);
assert.strictEqual(reconciled.siteValue.value.floors[0].value, '803.7');

// Conflict Test
const conflictDoc1 = { plotNo: createField('8', 'saleDeed', 1, 0.95, 'Plot 8') };
const conflictDoc2 = { plotNo: createField('12', 'buildingPlan', 1, 0.95, 'Plot 12') };
const conflictReconciled = reconcileDocuments({ saleDeed: conflictDoc1, buildingPlan: conflictDoc2 });
assert.strictEqual(conflictReconciled.plotNo.status, 'CONFLICT');
assert.strictEqual(conflictReconciled.plotNo.value, null);
assert.strictEqual(conflictReconciled.plotNo.values.length, 2);

console.log('✅ ALL RECONCILIATION TESTS PASSED!');
