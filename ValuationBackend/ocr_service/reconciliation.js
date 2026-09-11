/**
 * CROSS-DOCUMENT RECONCILIATION ENGINE
 * 
 * Reconciles extracted metadata across 5 valuation document slots:
 * 1. Registered Sale Deed (saleDeed)
 * 2. Approved Building Plan / Permit Order (buildingPlan)
 * 3. Property Tax Assessment / Receipt (propertyTax)
 * 4. Market Value / Guideline Certificate (marketValue)
 * 5. Layout / Approval Plan (layoutPlan)
 * 
 * Rules:
 * - If multiple documents provide comparable evidence and agree: status = 'VERIFIED'
 * - If documents provide conflicting evidence: status = 'CONFLICT' (DO NOT silently pick one!)
 * - If only one document provides evidence: status = 'EXTRACTED'
 * - actualBoundaries is strictly NEVER populated from documents (status = 'MANUAL')
 * - Applicant name is NEVER used as builderName
 * - Property type adheres to documentary evidence (e.g. "Individual Residential Building" -> "Independent House")
 */

const {
  createField,
  createEmptyCanonicalMetadata,
  isStrictlyEmpty,
  normalizeDeedNo,
  normalizeSurveyNo,
  normalizePlotNo,
  normalizeExtent,
  normalizeRoadWidth,
  normalizePropertyType,
  normalizeStructureType,
  cleanBoundaryText,
  normalizeCurrency
} = require('./canonicalSchema');

function areValuesEqual(fieldKey, val1, val2) {
  if (val1 === val2) return true;
  if (isStrictlyEmpty(val1) && isStrictlyEmpty(val2)) return true;
  if (isStrictlyEmpty(val1) || isStrictlyEmpty(val2)) return false;

  const s1 = String(val1).trim().toLowerCase();
  const s2 = String(val2).trim().toLowerCase();
  if (s1 === s2) return true;

  // Field specific normalizations
  if (fieldKey === 'surveyNo') {
    return normalizeSurveyNo(val1) === normalizeSurveyNo(val2);
  }
  if (fieldKey === 'deedNo') {
    return normalizeDeedNo(val1) === normalizeDeedNo(val2);
  }
  if (fieldKey === 'netExtent') {
    return normalizeExtent(val1) === normalizeExtent(val2);
  }
  if (fieldKey === 'roadWidth' || fieldKey === 'approachRoadWidth') {
    return normalizeRoadWidth(val1) === normalizeRoadWidth(val2);
  }
  if (fieldKey === 'propertyType') {
    return normalizePropertyType(val1) === normalizePropertyType(val2);
  }
  if (fieldKey === 'structureType') {
    return normalizeStructureType(val1) === normalizeStructureType(val2);
  }
  if (fieldKey === 'marketValue' || fieldKey === 'compositeValue') {
    return normalizeCurrency(val1) === normalizeCurrency(val2);
  }

  return false;
}

function normalizeFieldValue(fieldKey, rawVal) {
  if (isStrictlyEmpty(rawVal)) return null;
  if (fieldKey === 'propertyType') return normalizePropertyType(rawVal) || rawVal;
  if (fieldKey === 'surveyNo') return normalizeSurveyNo(rawVal) || rawVal;
  if (fieldKey === 'deedNo') return normalizeDeedNo(rawVal) || rawVal;
  if (fieldKey === 'netExtent') return normalizeExtent(rawVal) || rawVal;
  if (fieldKey === 'roadWidth' || fieldKey === 'approachRoadWidth') return normalizeRoadWidth(rawVal) || rawVal;
  if (fieldKey === 'structureType') return normalizeStructureType(rawVal) || rawVal;
  if (fieldKey === 'plotNo') return normalizePlotNo(rawVal);
  return rawVal;
}

function reconcileSingleField(fieldKey, candidateEntries) {
  // candidateEntries: Array of { value, sourceDocument, sourcePage, confidence, evidence }
  const validCandidates = candidateEntries.filter(c => !isStrictlyEmpty(c?.value));

  if (validCandidates.length === 0) {
    return createField(null, null, null, 0, null, 'EMPTY');
  }

  if (validCandidates.length === 1) {
    const c = validCandidates[0];
    const normalizedVal = normalizeFieldValue(fieldKey, c.value);
    return createField(
      normalizedVal,
      c.sourceDocument,
      c.sourcePage,
      c.confidence,
      c.evidence,
      'EXTRACTED',
      { sources: [{ source: c.sourceDocument, page: c.sourcePage, value: normalizedVal, confidence: c.confidence }] }
    );
  }

  // 2 or more candidates exist: check if they agree
  const first = validCandidates[0];
  const allAgree = validCandidates.every(c => areValuesEqual(fieldKey, first.value, c.value));

  if (allAgree) {
    const maxConf = Math.max(...validCandidates.map(c => c.confidence || 0.8));
    const normalizedVal = normalizeFieldValue(fieldKey, first.value);
    const allSources = validCandidates.map(c => ({
      source: c.sourceDocument,
      page: c.sourcePage,
      value: normalizeFieldValue(fieldKey, c.value),
      confidence: c.confidence,
      evidence: c.evidence
    }));
    return createField(
      normalizedVal,
      first.sourceDocument,
      first.sourcePage,
      maxConf,
      first.evidence,
      'VERIFIED',
      { sources: allSources }
    );
  } else {
    // Conflict detected!
    const conflictValues = validCandidates.map(c => ({
      value: normalizeFieldValue(fieldKey, c.value),
      source: c.sourceDocument,
      page: c.sourcePage,
      confidence: c.confidence,
      evidence: c.evidence
    }));
    const sourcePriority = {
      deedNo: ['saleDeed', 'marketValue', 'buildingPlan', 'propertyTax'],
      deedYear: ['saleDeed', 'marketValue', 'buildingPlan', 'propertyTax'],
      deedDate: ['saleDeed', 'marketValue', 'buildingPlan', 'propertyTax'],
      netExtent: ['saleDeed', 'buildingPlan', 'marketValue', 'propertyTax'],
      surveyNo: ['saleDeed', 'buildingPlan', 'marketValue', 'propertyTax'],
      plotNo: ['saleDeed', 'buildingPlan', 'layoutPlan', 'marketValue'],
      approvalPlanNo: ['buildingPlan', 'layoutPlan', 'saleDeed', 'propertyTax'],
      approvalPlanDate: ['buildingPlan', 'layoutPlan', 'saleDeed', 'propertyTax'],
      assessmentNo: ['propertyTax', 'saleDeed', 'buildingPlan', 'marketValue'],
      doorNo: ['buildingPlan', 'propertyTax', 'saleDeed', 'marketValue'],
      marketValue: ['marketValue', 'saleDeed', 'propertyTax', 'buildingPlan'],
      propertyType: ['buildingPlan', 'saleDeed', 'marketValue', 'propertyTax']
    };
    const prefOrder = sourcePriority[fieldKey] || [];
    let bestCandidate = validCandidates[0];
    for (const prefSrc of prefOrder) {
      const found = validCandidates.find(c => c.sourceDocument === prefSrc);
      if (found) {
        bestCandidate = found;
        break;
      }
    }
    const chosenVal = normalizeFieldValue(fieldKey, bestCandidate.value);
    return createField(
      chosenVal,
      bestCandidate.sourceDocument,
      bestCandidate.sourcePage,
      bestCandidate.confidence || 0.75,
      `Conflict between ${validCandidates.map(c => c.sourceDocument).join(', ')}`,
      'CONFLICT',
      { values: conflictValues }
    );
  }
}

function reconcileBoundaries(boundaryCandidateList) {
  // boundaryCandidateList: Array of { boundaries: { north, south, east, west }, sourceDocument, sourcePage, confidence }
  const dirs = ['north', 'south', 'east', 'west'];
  const reconciled = {};

  for (const dir of dirs) {
    const candidates = [];
    for (const item of boundaryCandidateList) {
      const bObj = item?.boundaries;
      if (bObj && bObj[dir]) {
        let raw = bObj[dir];
        if (raw && typeof raw === 'object') {
          raw = raw.value !== undefined ? raw.value : raw.text;
        }
        if (!isStrictlyEmpty(raw)) {
          const cleaned = cleanBoundaryText(raw);
          if (cleaned) {
            candidates.push({
              value: cleaned,
              sourceDocument: item.sourceDocument,
              sourcePage: (typeof bObj[dir] === 'object' && bObj[dir].sourcePage) ? bObj[dir].sourcePage : item.sourcePage,
              confidence: (typeof bObj[dir] === 'object' && bObj[dir].confidence) ? bObj[dir].confidence : (item.confidence || 0.85),
              evidence: (typeof bObj[dir] === 'object' && bObj[dir].evidence) ? bObj[dir].evidence : cleaned
            });
          }
        }
      }
    }
    reconciled[dir] = reconcileSingleField(`boundary_${dir}`, candidates);
  }

  return reconciled;
}

function reconcileFloorAreas(docsMap) {
  const floorList = [];
  const seenFloors = new Set();

  for (const [docId, docMeta] of Object.entries(docsMap)) {
    if (!docMeta) continue;
    const areas = docMeta.floorAreas?.value || docMeta.floorAreas;
    if (Array.isArray(areas) && areas.length > 0) {
      for (const fa of areas) {
        if (!fa || !fa.floor || !fa.area) continue;
        const key = fa.floor.trim().toLowerCase();
        if (!seenFloors.has(key)) {
          seenFloors.add(key);
          floorList.push({
            floor: fa.floor.trim(),
            area: String(fa.area).trim(),
            unit: fa.unit || 'sq.ft',
            source: docId
          });
        }
      }
    }
  }

  // Synthesize siteValue floors
  const siteFloors = floorList.map((f, idx) => ({
    id: idx === 0 ? 'gf' : `f${idx}`,
    label: f.floor.includes('(') ? f.floor : `${f.floor} (${f.floor.split(' ')[0]})`,
    value: f.area
  }));

  const totalPlinth = floorList.reduce((acc, f) => {
    const num = parseFloat(f.area);
    return !isNaN(num) ? acc + num : acc;
  }, 0);

  return {
    floorAreas: createField(floorList, floorList[0]?.source || null, null, floorList.length > 0 ? 0.95 : 0, null, floorList.length > 0 ? 'EXTRACTED' : 'EMPTY'),
    siteValue: createField({
      plinthArea: totalPlinth > 0 ? `${totalPlinth.toFixed(2)}` : '',
      floors: siteFloors.length > 0 ? siteFloors : [{ id: 'gf', label: 'Ground Floor (GF)', value: '' }]
    }, floorList[0]?.source || null, null, siteFloors.length > 0 ? 0.95 : 0, null, siteFloors.length > 0 ? 'EXTRACTED' : 'EMPTY')
  };
}

/**
 * Master Cross-Document Reconciliation Entry Point
 * @param {Object} docsMap - { saleDeed?: canonicalMeta, buildingPlan?: canonicalMeta, propertyTax?: canonicalMeta, marketValue?: canonicalMeta, layoutPlan?: canonicalMeta }
 * @returns {Object} Reconciled canonical property metadata object
 */
function reconcileDocuments(docsMap = {}) {
  const result = createEmptyCanonicalMetadata();
  const docKeys = Object.keys(docsMap).filter(k => docsMap[k] && typeof docsMap[k] === 'object');

  if (docKeys.length === 0) {
    return result;
  }

  const standardFields = [
    'deedNo', 'deedYear', 'deedDate', 'surveyNo', 'plotNo', 'netExtent',
    'khathaNo', 'assessmentNo', 'doorNo', 'approvalPlanNo', 'approvalPlanDate',
    'ownerName', 'builderName', 'managingPartner', 'flatNo', 'floorNo',
    'propertyType', 'buildingAge', 'roadWidth', 'roadType', 'plotType',
    'structureType', 'flooringType', 'plinthArea', 'floorsSanctioned',
    'unitRatePerSqYd', 'marketValue', 'compositeValue', 'lpNo',
    'approvalBody', 'approachRoadWidth', 'sroOffice', 'village', 'mandal',
    'district', 'locality', 'wardNo', 'fathersName', 'branchName',
    'valuationLand', 'valuationBuilding', 'valuationAmenities', 'valuationServices',
    'valuationTotal', 'latitude', 'longitude', 'documentPreparedBy', 'correctionDetails'
  ];

  for (const field of standardFields) {
    const candidates = [];
    for (const docId of docKeys) {
      const docMeta = docsMap[docId];
      if (!docMeta) continue;

      const rawField = docMeta[field];
      if (!rawField) continue;

      const val = typeof rawField === 'object' && rawField !== null && 'value' in rawField ? rawField.value : rawField;
      if (!isStrictlyEmpty(val)) {
        // Strict guard: Do not use applicant as builder
        if (field === 'builderName') {
          const valLower = String(val).trim().toLowerCase();
          if (valLower === 'na' || valLower === 'nil' || valLower.includes('applicant')) {
            continue;
          }
        }

        candidates.push({
          value: val,
          sourceDocument: docId,
          sourcePage: (typeof rawField === 'object' && rawField.sourcePage) ? rawField.sourcePage : null,
          confidence: (typeof rawField === 'object' && rawField.confidence) ? rawField.confidence : 0.88,
          evidence: (typeof rawField === 'object' && rawField.evidence) ? rawField.evidence : null
        });
      }
    }

    result[field] = reconcileSingleField(field, candidates);
  }

  // Reconcile Document Boundaries
  const boundaryList = [];
  for (const docId of docKeys) {
    const docMeta = docsMap[docId];
    if (!docMeta) continue;
    const b = docMeta.documentBoundaries || docMeta.boundaries;
    if (b) {
      boundaryList.push({
        boundaries: b,
        sourceDocument: docId,
        sourcePage: (typeof b === 'object' && b.sourcePage) ? b.sourcePage : null,
        confidence: 0.90
      });
    }
  }
  result.documentBoundaries = reconcileBoundaries(boundaryList);

  // actualBoundaries is ALWAYS strictly MANUAL and never auto-filled
  result.actualBoundaries = {
    north: createField(null, null, null, 0, null, 'MANUAL'),
    south: createField(null, null, null, 0, null, 'MANUAL'),
    east: createField(null, null, null, 0, null, 'MANUAL'),
    west: createField(null, null, null, 0, null, 'MANUAL')
  };

  // Reconcile Floor plinth areas & siteValue
  const floorReconciled = reconcileFloorAreas(docsMap);
  result.floorAreas = floorReconciled.floorAreas;
  result.siteValue = floorReconciled.siteValue;

  return result;
}

module.exports = {
  areValuesEqual,
  reconcileSingleField,
  reconcileBoundaries,
  reconcileFloorAreas,
  reconcileDocuments
};
