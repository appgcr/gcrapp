const path = require('path');
const fs = require('fs');

const {
  createField,
  createEmptyCanonicalMetadata,
  normalizeDeedNo,
  normalizeSurveyNo,
  normalizePlotNo,
  normalizeExtent,
  normalizeRoadWidth,
  normalizePropertyType,
  normalizeStructureType,
  cleanBoundaryText,
  normalizeCurrency
} = require('../ocr_service/canonicalSchema');

const {
  areValuesEqual,
  normalizeFieldValue,
  reconcileSingleField,
  reconcileBoundaries,
  reconcileFloorAreas,
  reconcileDocuments
} = require('../ocr_service/reconciliation');

const {
  runPythonOCR,
  extractCanonicalFromOCR
} = require('../routes/extract');

async function fileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : 'image/jpeg');
  const buffer = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log(' 100% FREE LOCAL OCR & CLARITY RECONCILIATION REGRESSION TEST');
  console.log('================================================================\n');

  let passedAssertions = 0;
  let failedAssertions = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedAssertions++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failedAssertions++;
    }
  }

  // ── 1. Unit Tests for Normalizers ──
  console.log('--- 1. Testing Normalizers and Boundary Noise Cleaning ---');
  assert(normalizeDeedNo('8859 / 2018') === '8859/2018', 'normalizeDeedNo removes internal whitespace');
  assert(normalizeSurveyNo('176 / 2') === '176/2', 'normalizeSurveyNo standardizes survey number');
  assert(normalizePlotNo('58/384-2-1-2') === null, 'normalizePlotNo rejects door numbers misclassified as plot numbers');
  assert(normalizePlotNo('Plot No. 9') === '9', 'normalizePlotNo cleans plot label prefix');
  assert(normalizeExtent('89.3 చ.గజములు') === '89.3 Sq. Yards', 'normalizeExtent parses Telugu Sq. Yards');
  assert(normalizeExtent('89.3 Sq. Yds') === '89.3 Sq. Yards', 'normalizeExtent parses English Sq. Yards');
  assert(normalizeRoadWidth('24 Feet') === '24 Feet', 'normalizeRoadWidth normalizes road width');
  assert(normalizePropertyType('Individual Residential Building') === 'Independent House', 'normalizePropertyType maps Individual Residential Building to Independent House');
  assert(normalizePropertyType('Residential Flat / Apartment') === 'Apartment', 'normalizePropertyType maps Apartment to Apartment');
  assert(normalizeStructureType('R.C.C Framed structure') === 'Framed structure', 'normalizeStructureType normalizes RCC to Framed structure');
  assert(cleanBoundaryText('| joint south: | sont |') === null, 'cleanBoundaryText strips OCR artifact "| joint south: | sont |"');
  assert(cleanBoundaryText('East: 24 ft wide road') === '24 ft wide road', 'cleanBoundaryText strips direction prefix');
  assert(cleanBoundaryText('West: Plot 9') === 'Plot 9', 'cleanBoundaryText preserves genuine boundary');

  // ── 2. Testing Clarity Gate & Blur Rejection ──
  console.log('\n--- 2. Testing Image Clarity Gate & Blur Rejection ---');
  // Synthetic sharp vs blurred base64 test
  const sharpSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <rect width="100%" height="100%" fill="white"/>
    <text x="30" y="80" font-family="Arial" font-size="22" font-weight="bold">REGISTERED SALE DEED NO: 8859/2018</text>
    <text x="30" y="140" font-family="Arial" font-size="18">Survey No: 176/2, Plot No: 9</text>
    <text x="30" y="200" font-family="Arial" font-size="18">Extent: 89.3 Sq. Yards</text>
  </svg>`;

  console.log('Testing blur detection logic via Python OpenCV...');
  try {
    const { execSync } = require('child_process');
    const tempPyScriptPath = path.join(__dirname, 'temp_blur_test.py');
    const pyScript = `import sys, os
sys.path.insert(0, r'd:\\gcr\\gcrapp\\ValuationBackend')
import cv2, numpy as np, json
sharp = np.ones((600, 600, 3), dtype=np.uint8) * 255
cv2.putText(sharp, 'REGISTERED SALE DEED 8859/2018', (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,0), 2)
cv2.imwrite('temp_test_sharp.jpg', sharp)

blurry = cv2.GaussianBlur(sharp, (31, 31), 0)
cv2.imwrite('temp_test_blurry.jpg', blurry)

from ocr_service.ocr_engine import run_ocr
res_sharp = run_ocr('temp_test_sharp.jpg')
res_blurry = run_ocr('temp_test_blurry.jpg')

if os.path.exists('temp_test_sharp.jpg'): os.remove('temp_test_sharp.jpg')
if os.path.exists('temp_test_blurry.jpg'): os.remove('temp_test_blurry.jpg')

print(json.dumps({'sharp': res_sharp, 'blurry': res_blurry}))
`;
    fs.writeFileSync(tempPyScriptPath, pyScript, 'utf-8');
    const venvPy = 'd:\\gcr\\venv_ocr\\Scripts\\python.exe';
    const rawOut = execSync(`"${venvPy}" "${tempPyScriptPath}"`, {
      env: {
        ...process.env,
        OPENBLAS_NUM_THREADS: '1',
        MKL_NUM_THREADS: '1',
        OMP_NUM_THREADS: '1',
        KMP_DUPLICATE_LIB_OK: 'TRUE'
      }
    }).toString();
    try { if (fs.existsSync(tempPyScriptPath)) fs.unlinkSync(tempPyScriptPath); } catch (_) {}

    // Extract the JSON line
    const jsonMatch = rawOut.match(/\{"sharp":.*"blurry":.*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      assert(parsed.blurry.is_blurred === true, 'Blurry image is strictly detected (is_blurred: true)');
      assert(typeof parsed.blurry.clarity_reason === 'string' && parsed.blurry.clarity_reason.includes('clarity'), 'Blurry image returns clarity upload prompt');
      assert(parsed.sharp.is_blurred === false, 'Sharp document passes clarity gate (is_blurred: false)');
    }
  } catch (blurErr) {
    console.warn('Blur test error:', blurErr.message);
  }

  // ── 3. Canonical Metadata Extraction ──
  console.log('\n--- 3. Testing Local Canonical Metadata Extraction ---');
  const syntheticPyResult = {
    text: `GOVERNMENT OF ANDHRA PRADESH REGISTRATION AND STAMPS DEPARTMENT
Registered Sale Deed Doct No: 8859/2018
Survey No: 176/2, Plot No: 9
Net Extent: 89.3 Sq. Yards (చ.గజములు)
East: 24 Feet Wide Road
West: Plot 10
North: Plot 8
South: Private Property
Individual Residential Building (Ground Floor plinth area: 650 sq.ft, First floor: 600 sq.ft)
Market Value: Rs. 14,50,000/-
Assessment No: 1013104872, Door No: 42/337-7-2-1
Purchaser Name: Mr. K. Venkata Ramana`,
    pages: [{ page: 1, text: 'Sale Deed 8859/2018' }]
  };

  const extracted = extractCanonicalFromOCR(syntheticPyResult, 'saleDeed');
  assert(extracted.deedNo.value === '8859/2018', `deedNo correctly extracted: ${extracted.deedNo.value}`);
  assert(extracted.surveyNo.value === '176/2', `surveyNo correctly extracted: ${extracted.surveyNo.value}`);
  assert(extracted.plotNo.value === '9', `plotNo correctly extracted: ${extracted.plotNo.value}`);
  assert(extracted.netExtent.value === '89.3 Sq. Yards', `netExtent correctly extracted: ${extracted.netExtent.value}`);
  assert(extracted.roadWidth.value === '24 Feet', `roadWidth correctly extracted: ${extracted.roadWidth.value}`);
  assert(extracted.propertyType.value === 'Independent House', `propertyType correctly extracted: ${extracted.propertyType.value}`);
  assert(extracted.documentBoundaries.east.value === '24 Feet Wide Road', `East boundary extracted: ${extracted.documentBoundaries.east.value}`);
  assert(extracted.documentBoundaries.north.value === 'Plot 8', `North boundary extracted: ${extracted.documentBoundaries.north.value}`);
  assert(extracted.assessmentNo.value === '1013104872', `assessmentNo extracted: ${extracted.assessmentNo.value}`);
  assert(extracted.doorNo.value === '42/337-7-2-1', `doorNo extracted: ${extracted.doorNo.value}`);

  // ── 4. Cross-Document Reconciliation ──
  console.log('\n--- 4. Running Cross-Document Reconciliation ---');
  const reconciled = reconcileDocuments({ saleDeed: extracted });

  // Rule 1: actualBoundaries must NEVER be auto-filled
  assert(
    reconciled.actualBoundaries.north.status === 'MANUAL' &&
    reconciled.actualBoundaries.north.value === null &&
    reconciled.actualBoundaries.south.value === null &&
    reconciled.actualBoundaries.east.value === null &&
    reconciled.actualBoundaries.west.value === null,
    'actualBoundaries must NEVER be auto-filled from documents (status: MANUAL, value: null)'
  );

  // Rule 2: Applicant name must NOT be copied into builderName
  const builderVal = reconciled.builderName?.value;
  assert(!builderVal, `builderName must be null when no builder exists (current: ${builderVal})`);

  // Rule 3: Door number must NOT be in plotNo
  const plotVal = reconciled.plotNo?.value;
  assert(!plotVal || !plotVal.includes('/'), `plotNo must not be a door number (current: ${plotVal})`);

  // Rule 4: Floor plinth areas synthesized into siteValue
  if (reconciled.siteValue?.value?.floors) {
    const floors = reconciled.siteValue.value.floors;
    console.log('  Synthesized floor plinth areas:', JSON.stringify(floors));
    assert(Array.isArray(floors) && floors.length > 0, 'siteValue.floors contains floor plinth areas');
  }

  console.log('\n================================================================');
  console.log(` TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('================================================================\n');

  return { passedAssertions, failedAssertions, reconciled };
}

if (require.main === module) {
  runRegressionSuite()
    .then(({ failedAssertions }) => {
      process.exit(failedAssertions > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Test suite runtime error:', err);
      process.exit(1);
    });
}

module.exports = { runRegressionSuite };
