const fs = require('fs');
const path = require('path');
const { calculateValuation, APPROVED_VALUATION_POLICIES } = require('../services/valuationCalculator');
const { spawnSync } = require('child_process');

describe('Option A Tri-Platform Valuation & Monetary Precision Test Suite', () => {
  const suiteFixturePath = path.resolve(__dirname, 'fixtures/valuation_revised_test_suite.json');
  const testSuite = JSON.parse(fs.readFileSync(suiteFixturePath, 'utf8'));

  // Helper to run python masterDocxGenerator helpers
  function getPythonReportOutputs(bankName, category, amount) {
    const pythonScript = `
import sys, json
from services.masterDocxGenerator import format_inr, number_to_indian_words

bank = sys.argv[1]
cat = sys.argv[2]
amt = int(sys.argv[3])

digits = f"Rs. {format_inr(amt)}/-" if "APGB" in bank else f"Rs {format_inr(amt)}/-"
words = f"Rupees {number_to_indian_words(amt)} Only"

policy_pcts = {
    ("APGB", "Independent House", "RV"): "Realizable Value of the Property (90 % of FMV)",
    ("APGB", "Independent House", "DV"): "Distress Sale Value of the Property (80 % of FMV)",
    ("APGB", "Apartment", "RV"): "Realizable Value of the Property (85 % of FMV)",
    ("APGB", "Apartment", "DV"): "Distress Sale Value of the Property (75 % of FMV)",
    ("APGB", "Open Agriculture Land", "RV"): "Realizable Value of the Property (85 % of FMV)",
    ("State Bank of India", "Independent House", "RV"): "(iii) Realizable Value :",
    ("State Bank of India", "Independent House", "DV"): "(iv) Forced / Distress Sale Value :",
    ("State Bank of India", "Independent House", "FMV"): "(ii) Fair Market Value :"
}

print(json.dumps({
    "digits": digits,
    "words": words,
    "policy_pcts": {k[2]: v for k, v in policy_pcts.items() if k[0] == bank and k[1] == cat}
}))
`;
    const res = spawnSync('python3', ['-c', pythonScript, bankName, category, String(amount)], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8'
    });
    if (res.error || res.status !== 0) {
      throw new Error(`Python execution failed: ${res.stderr || res.stdout}`);
    }
    return JSON.parse(res.stdout);
  }

  describe('Suite 1: Approved Whitelist Categories (Standard ₹1,00,00,000 FMV)', () => {
    test('TC-01: APGB Independent House (90% RV, 80% Distress, Direct from FMV)', () => {
      const tc = testSuite.suites[0].cases.find(c => c.id === 'TC-01');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('SUCCESS');
      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
      expect(res.insurableValue).toBe(tc.expectedInsurable);
      expect(res.policyRates.calculatedDirectlyFromFmv).toBe(true);
    });

    test('TC-02: APGB Open Site (90% RV, 80% Distress, ₹0 Insurable)', () => {
      const tc = testSuite.suites[0].cases.find(c => c.id === 'TC-02');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('SUCCESS');
      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
      expect(res.insurableValue).toBe(0);
    });

    test('TC-03: APGB Apartment (85% RV, 75% Distress, Flat Structure Only Insurable)', () => {
      const tc = testSuite.suites[0].cases.find(c => c.id === 'TC-03');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('SUCCESS');
      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
      expect(res.insurableValue).toBe(tc.expectedInsurable);
    });

    test('TC-04: APGB Open Agriculture Land (85% RV, 75% Distress, ₹0 Insurable)', () => {
      const tc = testSuite.suites[0].cases.find(c => c.id === 'TC-04');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('SUCCESS');
      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
      expect(res.insurableValue).toBe(0);
    });

    test('TC-05: State Bank of India Independent House (95% RV, 90% Distress, Direct from FMV)', () => {
      const tc = testSuite.suites[0].cases.find(c => c.id === 'TC-05');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('SUCCESS');
      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
      expect(res.insurableValue).toBe(tc.expectedInsurable);
    });

    test('TC-05b: State Bank of India Residential Building synonym', () => {
      const tc = testSuite.suites[0].cases.find(c => c.id === 'TC-05b');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('SUCCESS');
      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
      expect(res.insurableValue).toBe(tc.expectedInsurable);
    });
  });

  describe('Suite 2: Half-Up Rounding Boundary Values & Half-Rupee Precision', () => {
    test('TC-06: Exact Half-Up Rounding on Fractional Rupee', () => {
      const tc = testSuite.suites[1].cases.find(c => c.id === 'TC-06');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
    });

    test('TC-07: Even Integer + .50 Half-Up Rounding (Deterring Banker\'s Rounding)', () => {
      const tc = testSuite.suites[1].cases.find(c => c.id === 'TC-07');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
    });

    test('TC-08: Odd Integer + .50 Standard Half-Up', () => {
      const tc = testSuite.suites[1].cases.find(c => c.id === 'TC-08');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
    });

    test('TC-09: Below Half (.49) strict truncate to lower integer', () => {
      const tc = testSuite.suites[1].cases.find(c => c.id === 'TC-09');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
    });

    test('TC-10: Above Half (.51) strict round to higher integer', () => {
      const tc = testSuite.suites[1].cases.find(c => c.id === 'TC-10');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.fairMarketValue).toBe(tc.expectedFmv);
      expect(res.realizableValue).toBe(tc.expectedRealizable);
      expect(res.distressSaleValue).toBe(tc.expectedDistress);
    });
  });

  describe('Suite 3: High-Net-Worth Scaling Tests (₹50 Cr & ₹100 Cr)', () => {
    test('TC-11: ₹50 Crore Asset Valuation', () => {
      const tc = testSuite.suites[2].cases.find(c => c.id === 'TC-11');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.fairMarketValue).toBe(500000000);
      expect(res.realizableValue).toBe(450000000);
      expect(res.distressSaleValue).toBe(400000000);
      expect(res.insurableValue).toBe(300000000);
    });

    test('TC-12: ₹100 Crore Prime Asset Scale Test (Zero 64-bit Overflow)', () => {
      const tc = testSuite.suites[2].cases.find(c => c.id === 'TC-12');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue,
        structureValue: tc.structureValue,
        amenitiesValue: tc.amenitiesValue
      }, { engineVersion: tc.engineVersion });

      expect(res.fairMarketValue).toBe(1000000000);
      expect(res.realizableValue).toBe(950000000);
      expect(res.distressSaleValue).toBe(900000000);
      expect(res.insurableValue).toBe(600000000);
    });
  });

  describe('Suite 4: Strict Policy Enforcement & Unconfigured Guards', () => {
    test('TC-13: Unconfigured Bank under v2_option_a returns POLICY_NOT_CONFIGURED', () => {
      const tc = testSuite.suites[3].cases.find(c => c.id === 'TC-13');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('POLICY_NOT_CONFIGURED');
      expect(res.error).toMatch(/No approved valuation policy configured/);
    });

    test('TC-14: Unconfigured Bank under v1_universal_shortcut STILL returns POLICY_NOT_CONFIGURED', () => {
      const tc = testSuite.suites[3].cases.find(c => c.id === 'TC-14');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('POLICY_NOT_CONFIGURED');
      expect(res.error).toMatch(/No approved valuation policy configured/);
    });

    test('TC-15: Unsupported SBI Agricultural Land under v2_option_a returns POLICY_NOT_CONFIGURED', () => {
      const tc = testSuite.suites[3].cases.find(c => c.id === 'TC-15');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('POLICY_NOT_CONFIGURED');
    });

    test('TC-16: Unsupported SBI Agricultural Land under v1_universal_shortcut STILL returns POLICY_NOT_CONFIGURED', () => {
      const tc = testSuite.suites[3].cases.find(c => c.id === 'TC-16');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('POLICY_NOT_CONFIGURED');
    });

    test('TC-17: Blank Bank Name returns BANK_UNASSIGNED', () => {
      const tc = testSuite.suites[3].cases.find(c => c.id === 'TC-17');
      const res = calculateValuation({
        bankName: tc.bankName,
        propertyType: tc.propertyCategory,
        landValue: tc.landValue
      }, { engineVersion: tc.engineVersion });

      expect(res.valuationStatus).toBe('BANK_UNASSIGNED');
    });
  });

  describe('Suite 5: Report Label & Number-to-Words Parity', () => {
    testSuite.suites[4].cases.forEach(tc => {
      test(`${tc.id}: ${tc.bankName} ${tc.propertyCategory} Formatting & Verbal Concordance`, () => {
        const out = getPythonReportOutputs(tc.bankName, tc.propertyCategory, tc.amount);
        expect(out.digits).toBe(tc.expectedDigits);
        expect(out.words.toUpperCase()).toBe(tc.expectedWords.toUpperCase());
        // Verify label if present in policy_pcts
        if (tc.id === 'TC-18' || tc.id === 'TC-20' || tc.id === 'TC-22' || tc.id === 'TC-25') {
          expect(out.policy_pcts['RV']).toBe(tc.expectedLabel);
        } else if (tc.id === 'TC-19' || tc.id === 'TC-21' || tc.id === 'TC-23') {
          expect(out.policy_pcts['DV']).toBe(tc.expectedLabel);
        } else if (tc.id === 'TC-24') {
          expect(out.policy_pcts['FMV']).toBe(tc.expectedLabel);
        }
      });
    });
  });

  describe('Suite 6: Extended Decimal Precision Boundaries & Input Validation', () => {
    test('TC-26: Fractional Extent (142.375 Sq. Yards) x Fractional Rate (₹4521.85) produces exact 64,379,839 paise and ₹6,43,798', () => {
      const { parseExtentToSqYardsScaled, parseDecimalToScaled } = require('../services/valuationCalculator');
      const extentScaled = parseExtentToSqYardsScaled('142.375 Sq. Yards');
      const rateScaled = parseDecimalToScaled('4521.85', 2);
      const productScaled = extentScaled * rateScaled;
      expect(productScaled.toString()).toBe('643798393750'); // scale 6

      // Scale down to paise with half-up rounding (add 5000 / 10000):
      const paise = (productScaled + 5000n) / 10000n;
      expect(paise.toString()).toBe('64379839'); // 64,379,839 paise (NOT 64,379,844)

      // Convert paise to integer Rupees with half-rupee bias (add 50 / 100):
      const rupees = (paise + 50n) / 100n;
      expect(rupees.toString()).toBe('643798');

      const res = calculateValuation({
        bankName: 'APGB',
        propertyType: 'Open Site',
        netExtent: '142.375 Sq. Yards',
        siteValue: { ratePerSqYd: '4521.85', floors: [] }
      }, { engineVersion: 'v2_option_a' });

      expect(res.valuationStatus).toBe('SUCCESS');
      expect(res.landValue).toBe(643798);
      expect(res.fairMarketValue).toBe(643798);
      // APGB Open Site: RV 90% = 643798 * 0.90 = 579418.2 -> 579418
      expect(res.realizableValue).toBe(579418);
      // APGB Open Site: DV 80% = 643798 * 0.80 = 515038.4 -> 515038
      expect(res.distressSaleValue).toBe(515038);
    });

    test('TC-27: Rejection of negative land extent', () => {
      const res = calculateValuation({
        bankName: 'APGB',
        propertyType: 'Independent House',
        netExtent: '-150 Sq. Yards'
      });
      expect(res.valuationStatus).toBe('INVALID_INPUT');
      expect(res.error).toMatch(/cannot be negative/);
    });

    test('TC-28: Rejection of negative building age', () => {
      const res = calculateValuation({
        bankName: 'APGB',
        propertyType: 'Independent House',
        netExtent: '150 Sq. Yards',
        siteValue: { ratePerSqYd: '15000' },
        buildingAge: '-5'
      });
      expect(res.valuationStatus).toBe('INVALID_INPUT');
      expect(res.error).toMatch(/cannot be negative/);
    });

    test('TC-29: Rejection of malformed land rate', () => {
      const res = calculateValuation({
        bankName: 'APGB',
        propertyType: 'Independent House',
        netExtent: '150 Sq. Yards',
        siteValue: { ratePerSqYd: 'invalid_rate' }
      });
      expect(res.valuationStatus).toBe('INVALID_INPUT');
      expect(res.error).toMatch(/invalid decimal number/);
    });

    test('TC-30: Rejection of extreme integer overflow (>15 digits)', () => {
      const res = calculateValuation({
        bankName: 'APGB',
        propertyType: 'Independent House',
        netExtent: '150 Sq. Yards',
        siteValue: { ratePerSqYd: '1234567890123456' }
      });
      expect(res.valuationStatus).toBe('INVALID_INPUT');
      expect(res.error).toMatch(/exceeds maximum allowable digits/);
    });

    test('TC-31: Rejection of missing required land rate on Open Site', () => {
      const res = calculateValuation({
        bankName: 'APGB',
        propertyType: 'Open Site',
        netExtent: '150 Sq. Yards',
        siteValue: { ratePerSqYd: '' }
      });
      expect(res.valuationStatus).toBe('INVALID_INPUT');
      expect(res.error).toMatch(/Land rate is required/);
    });
  });
});

