/**
 * FRONTEND CROSS-DOCUMENT RECONCILIATION ENGINE
 */

import {
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
} from './canonicalSchema';

export function areValuesEqual(fieldKey, val1, val2) {
  if (val1 === val2) return true;
  if (isStrictlyEmpty(val1) && isStrictlyEmpty(val2)) return true;
  if (isStrictlyEmpty(val1) || isStrictlyEmpty(val2)) return false;

  const s1 = String(val1).trim().toLowerCase();
  const s2 = String(val2).trim().toLowerCase();
  if (s1 === s2) return true;

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

export function normalizeFieldValue(fieldKey, rawVal) {
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

export function reconcileSingleField(fieldKey, candidateEntries) {
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

export function reconcileBoundaries(boundaryCandidateList) {
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

export function reconcileFloorAreas(docsMap) {
  const floorList = [];
  const seenFloors = new Set();

  for (const [docId, docMeta] of Object.entries(docsMap)) {
    if (!docMeta) continue;
    const areas = docMeta.floorAreas?.value || docMeta.floorAreas;
    if (Array.isArray(areas) && areas.length > 0) {
      for (const fa of areas) {
        if (!fa || !fa.floor || !fa.area) continue;
        const floorStr = String(fa.floor).trim();
        const key = floorStr.toLowerCase();
        if (!seenFloors.has(key)) {
          seenFloors.add(key);
          floorList.push({
            floor: floorStr,
            area: String(fa.area).trim(),
            unit: fa.unit || 'sq.ft',
            source: docId
          });
        }
      }
    }
  }

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

export function reconcileDocuments(docsMap = {}) {
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

  result.actualBoundaries = {
    north: createField(null, null, null, 0, null, 'MANUAL'),
    south: createField(null, null, null, 0, null, 'MANUAL'),
    east: createField(null, null, null, 0, null, 'MANUAL'),
    west: createField(null, null, null, 0, null, 'MANUAL')
  };

  const floorReconciled = reconcileFloorAreas(docsMap);
  result.floorAreas = floorReconciled.floorAreas;
  result.siteValue = floorReconciled.siteValue;

  return result;
}
