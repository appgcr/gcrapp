/**
 * Frontend Mathematical Property Valuation Engine for Banking Panel Valuers
 * Option A Multi-Bank Implementation with Strict Fixed-Point Decimal Arithmetic.
 * Strictly synchronized with backend services/valuationCalculator.js
 */

export const APPROVED_VALUATION_POLICIES = {
  // Andhra Pragathi Grameena Bank (APGB)
  'APGB': {
    'Independent House': {
      realizableRate: 0.90, // 90% of FMV
      distressRate:   0.80, // 80% of FMV
      insurableMethod: 'STRUCTURE_PLUS_AMENITIES'
    },
    'Open Site': {
      realizableRate: 0.90, // 90% of FMV
      distressRate:   0.80, // 80% of FMV
      insurableMethod: 'NOT_APPLICABLE' // ₹0.00
    },
    'Apartment': {
      realizableRate: 0.85, // 85% of FMV
      distressRate:   0.75, // 75% of FMV
      insurableMethod: 'FLAT_STRUCTURE_ONLY'
    },
    'Open Agriculture Land': {
      realizableRate: 0.85, // 85% of FMV
      distressRate:   0.75, // 75% of FMV
      insurableMethod: 'NOT_APPLICABLE' // ₹0.00
    },
    'Agricultural Land': { // Synonym
      realizableRate: 0.85,
      distressRate:   0.75,
      insurableMethod: 'NOT_APPLICABLE'
    }
  },

  // State Bank of India (SBI) — Approved Residential Land & Building Only
  'State Bank of India': {
    'Residential Building': {
      realizableRate: 0.95, // 95% of FMV
      distressRate:   0.90, // 90% of FMV
      insurableMethod: 'STRUCTURE_PLUS_AMENITIES'
    },
    'Independent House': { // Approved residential classification synonym
      realizableRate: 0.95,
      distressRate:   0.90,
      insurableMethod: 'STRUCTURE_PLUS_AMENITIES'
    }
  }
};

export function normalizeBank(b) {
  if (!b || typeof b !== 'string' || !b.trim()) return '';
  const s = b.trim();
  if (/andhra\s*pragathi|apgb/i.test(s)) return 'APGB';
  if (/state\s*bank\s*of\s*india|sbi/i.test(s)) return 'State Bank of India';
  return s;
}

export function normalizeCategory(c) {
  if (!c || typeof c !== 'string' || !c.trim()) return '';
  const s = c.trim();
  if (/independent\s*house/i.test(s)) return 'Independent House';
  if (/residential\s*building/i.test(s)) return 'Residential Building';
  if (/apartment|flat/i.test(s)) return 'Apartment';
  if (/open\s*site|vacant\s*site/i.test(s)) return 'Open Site';
  if (/agri.*land|open\s*agriculture/i.test(s)) return 'Open Agriculture Land';
  return s;
}

export function parseDecimalToScaled(input, scale, fieldName = 'Value') {
  if (input === null || input === undefined) {
    throw new Error(`${fieldName} is required.`);
  }
  const str = String(input).trim().replace(/,/g, '');
  if (!str) {
    throw new Error(`${fieldName} cannot be empty.`);
  }
  if (str.startsWith('-')) {
    throw new Error(`${fieldName} cannot be negative: ${str}`);
  }
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`${fieldName} contains an invalid decimal number: ${str}`);
  }

  const [intPart, fracPart = ''] = str.split('.');
  if (intPart.length > 15) {
    throw new Error(`${fieldName} exceeds maximum allowable digits (overflow protection).`);
  }

  const paddedFrac = (fracPart + '0'.repeat(scale)).slice(0, scale);
  const nextDigit = fracPart.length > scale ? parseInt(fracPart[scale], 10) : 0;
  let scaled = BigInt(intPart + paddedFrac);
  if (nextDigit >= 5) {
    scaled += 1n;
  }
  return scaled;
}

export function parseExtentToSqYardsScaled(extentInput) {
  if (extentInput === null || extentInput === undefined) {
    throw new Error('Land extent is required.');
  }
  const s = String(extentInput).trim().toLowerCase().replace(/,/g, '');
  if (!s) throw new Error('Land extent cannot be empty.');
  if (s.startsWith('-')) throw new Error(`Land extent cannot be negative: ${extentInput}`);

  const match = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
  if (!match) throw new Error(`Invalid land extent format: ${extentInput}`);

  const numStr = match[1];
  const unitStr = match[2];

  const rawScaled = parseDecimalToScaled(numStr, 4, 'Land Extent');

  if (unitStr.includes('cent') || unitStr.includes('సెంట్లు') || unitStr.includes('సెంట్')) {
    return (rawScaled * 484n + 5n) / 10n;
  } else if (unitStr.includes('sq.ft') || unitStr.includes('sq ft') || unitStr.includes('sft') || unitStr.includes('చ.అడుగులు')) {
    return (rawScaled + 4n) / 9n;
  } else if (unitStr.includes('ankanam') || unitStr.includes('అంకణము')) {
    return rawScaled * 8n;
  }
  return rawScaled;
}

export function parseExtentToSqYards(extentStr) {
  try {
    const scaled = parseExtentToSqYardsScaled(extentStr);
    return Number(scaled) / 10000;
  } catch (err) {
    return 0;
  }
}

export function calculateValuation(propertyDetails = {}, config = {}) {
  const p = propertyDetails || {};

  const rawBank = p.bankName || config.bankName || '';
  const normBank = normalizeBank(rawBank);
  if (!normBank) {
    return {
      valuationStatus: 'BANK_UNASSIGNED',
      error: 'Bank name is required for valuation policy assignment.'
    };
  }

  const rawCategory = p.propertyType || p.propertyCategory || config.propertyCategory || '';
  const normCat = normalizeCategory(rawCategory);
  const bankPolicies = APPROVED_VALUATION_POLICIES[normBank];
  const policy = bankPolicies ? bankPolicies[normCat] : null;

  if (!policy) {
    return {
      valuationStatus: 'POLICY_NOT_CONFIGURED',
      error: `No approved valuation policy configured for bank '${normBank}' and category '${normCat || 'Unspecified'}'. Universal fallback is prohibited.`
    };
  }

  try {
    const engineVersion = config.engineVersion || config.valuationEngineVersion || 'v2_option_a';

    let landPaise = 0n;
    let netExtentSqYards = 0;
    let landRate = 0;

    if (p.landValue !== undefined) {
      landPaise = parseDecimalToScaled(p.landValue, 2, 'Land Value');
      landRate = p.landRate ? Number(p.landRate) : 0;
    } else {
      const extentScaled = parseExtentToSqYardsScaled(p.netExtent || p.extent || '0');
      netExtentSqYards = Number(extentScaled) / 10000;

      let rawLandRate = p.siteValue?.ratePerSqYd || p.landRate || p.marketValueAmount || config.defaultLandRate;
      if (rawLandRate === undefined || rawLandRate === null || String(rawLandRate).trim() === '') {
        if (normCat !== 'Apartment') {
          throw new Error('Land rate is required.');
        } else {
          rawLandRate = '0';
        }
      }
      const rateScaled = parseDecimalToScaled(rawLandRate, 2, 'Land Rate');
      landRate = Number(rateScaled) / 100;

      landPaise = (extentScaled * rateScaled + 5000n) / 10000n;
    }
    const landValue = Number((landPaise + 50n) / 100n);

    const defaultConstructionRates = {
      'Framed structure': '1800',
      'Load bearing': '1400',
      'Steel / Precast': '1600'
    };
    const structureType = p.structureType || 'Framed structure';
    const rawBaseRate = p.constructionRate || defaultConstructionRates[structureType] || '1800';
    const baseRateScaled = parseDecimalToScaled(rawBaseRate, 2, 'Construction Rate');
    const baseConstructionRate = Number(baseRateScaled) / 100;

    let totalPlinthArea = 0;
    let replacementPaise = 0n;

    const floors = p.siteValue?.floors || [];
    if (floors.length > 0) {
      floors.forEach((f, idx) => {
        if (f.value !== undefined && String(f.value).trim() !== '') {
          const areaScaled = parseDecimalToScaled(f.value, 2, `Floor ${idx + 1} Area`);
          totalPlinthArea += Number(areaScaled) / 100;

          const fRateScaled = f.rate !== undefined && String(f.rate).trim() !== ''
            ? parseDecimalToScaled(f.rate, 2, `Floor ${idx + 1} Rate`)
            : baseRateScaled;

          const fPaise = (areaScaled * fRateScaled + 50n) / 100n;
          replacementPaise += fPaise;
        }
      });
    } else if (p.siteValue?.plinthArea) {
      const areaScaled = parseDecimalToScaled(p.siteValue.plinthArea, 2, 'Plinth Area');
      totalPlinthArea = Number(areaScaled) / 100;
      replacementPaise = (areaScaled * baseRateScaled + 50n) / 100n;
    }

    const replacementCost = Number((replacementPaise + 50n) / 100n);

    const buildingLife = structureType === 'Load bearing' ? 40 : 60;
    const buildingAgeStr = String(p.buildingAge || '0').trim();
    if (buildingAgeStr.startsWith('-')) {
      throw new Error(`Building age cannot be negative: ${p.buildingAge}`);
    }
    const buildingAge = parseInt(buildingAgeStr, 10) || 0;
    const rawDepreciationPercent = Math.min(90, Math.round((buildingAge / buildingLife) * 100));

    const depPaise = (replacementPaise * BigInt(rawDepreciationPercent) + 50n) / 100n;
    const depreciationAmount = Number((depPaise + 50n) / 100n);

    let netStructureValue = 0;
    if (p.structureValue !== undefined) {
      const structPaise = parseDecimalToScaled(p.structureValue, 2, 'Structure Value');
      netStructureValue = Number((structPaise + 50n) / 100n);
    } else {
      const netStructPaise = replacementPaise > depPaise ? replacementPaise - depPaise : 0n;
      netStructureValue = Number((netStructPaise + 50n) / 100n);
    }
    // "Additions Work Estimation" is PROPOSED work (an estimate page in the bank report), not part of
    // today's market value. Its total is kept separately; existing extras (compound wall, sump…) are
    // entered on the bank details screen and counted by the bank's own report.
    let amenitiesPaise = 0n;
    if (p.amenitiesValue !== undefined) {
      amenitiesPaise = parseDecimalToScaled(p.amenitiesValue, 2, 'Amenities Value');
    }
    let proposedPaise = 0n;
    const additions = p.additionsWork || [];
    additions.forEach((item, idx) => {
      if (item.amount !== undefined && String(item.amount).trim() !== '' && Number(item.amount) > 0) {
        proposedPaise += parseDecimalToScaled(item.amount, 2, `Addition ${idx + 1} Amount`);
      } else if (item.quantity && item.rate) {
        const qtyScaled = parseDecimalToScaled(item.quantity, 2, `Addition ${idx + 1} Quantity`);
        const rScaled = parseDecimalToScaled(item.rate, 2, `Addition ${idx + 1} Rate`);
        proposedPaise += (qtyScaled * rScaled + 50n) / 100n;
      }
    });
    const proposedAdditionsValue = Number((proposedPaise + 50n) / 100n);
    const amenitiesValue = Number((amenitiesPaise + 50n) / 100n);

    const fairMarketValue = landValue + netStructureValue + amenitiesValue;

    const fmvPaise = BigInt(fairMarketValue) * 100n;
    const realRateInt = BigInt(Math.round(policy.realizableRate * 100));
    const realizablePaise = (fmvPaise * realRateInt + 50n) / 100n;
    const realizableValue = Number((realizablePaise + 50n) / 100n);

    let distressSaleValue;
    if (engineVersion === 'v1_universal_shortcut') {
      const distPaise = (BigInt(realizableValue) * 100n * 85n + 50n) / 100n;
      distressSaleValue = Number((distPaise + 50n) / 100n);
    } else {
      const distRateInt = BigInt(Math.round(policy.distressRate * 100));
      const distPaise = (fmvPaise * distRateInt + 50n) / 100n;
      distressSaleValue = Number((distPaise + 50n) / 100n);
    }

    let insurableValue = 0;
    if (policy.insurableMethod === 'STRUCTURE_PLUS_AMENITIES') {
      insurableValue = netStructureValue + amenitiesValue;
    } else if (policy.insurableMethod === 'FLAT_STRUCTURE_ONLY') {
      insurableValue = netStructureValue;
    } else if (policy.insurableMethod === 'NOT_APPLICABLE') {
      insurableValue = 0;
    }

    return {
      valuationStatus: 'SUCCESS',
      engineVersion,
      bankName: normBank,
      propertyCategory: normCat,
      policyRates: {
        realizableRate: policy.realizableRate,
        distressRate: policy.distressRate,
        insurableMethod: policy.insurableMethod,
        calculatedDirectlyFromFmv: engineVersion !== 'v1_universal_shortcut'
      },
      netExtentSqYards,
      landRate,
      landValue,
      totalPlinthArea,
      constructionRate: baseConstructionRate,
      replacementCost,
      structureReplacementCost: replacementCost,
      buildingAge,
      buildingLife,
      depreciationPercent: rawDepreciationPercent,
      depreciationAmount,
      netStructureValue,
      amenitiesValue,
      proposedAdditionsValue,
      fairMarketValue,
      realizableValue,
      distressSaleValue,
      insurableValue
    };
  } catch (err) {
    return {
      valuationStatus: 'INVALID_INPUT',
      error: err.message
    };
  }
}
