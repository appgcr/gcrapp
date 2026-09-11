import React from 'react';

export const REQUIRED_DOCS = [
  { id: 'saleDeed', label: '1. Registered Document / Sale Deed' },
  { id: 'buildingPlan', label: '2. Approved Building Plan / Permit Order' },
  { id: 'propertyTax', label: '3. Property Tax Assessment / Receipt' },
  { id: 'marketValue', label: '4. Market Value / Guideline Certificate' },
  { id: 'layoutPlan', label: '5. Layout / Approval Plan (Site & Architectural Drawings)' },
];

export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
  return `${(bytes / (k * k)).toFixed(2)} MB`;
};

export const getPageDisplayInfo = (page, idx) => {
  if (!page) return { name: `Document_${idx + 1}`, ext: 'FILE', size: '', uploadedAt: '', isPdf: false };
  const rawName = page.name || `Document_Page_${idx + 1}`;
  let ext = page.extension;
  if (!ext) {
    if (rawName && rawName.includes('.')) {
      ext = rawName.split('.').pop();
    } else {
      ext = page.isPdf ? 'PDF' : 'JPG';
    }
  }
  ext = (ext || (page.isPdf ? 'PDF' : 'FILE')).toUpperCase().replace(/^\./, '');

  let size = page.sizeFormatted;
  if (!size && page.size) {
    size = formatFileSize(page.size);
  } else if (!size && page.url && page.url.startsWith('data:')) {
    const approx = Math.round((page.url.length * 3) / 4);
    size = formatFileSize(approx);
  }

  const isPdf = Boolean(page.isPdf || ext === 'PDF');

  return {
    name: rawName,
    ext,
    size: size || '',
    uploadedAt: page.uploadedAt || '',
    isPdf,
    pageCount: page.pageCount || (isPdf ? 1 : 1)
  };
};

export const getDocMetaPills = (docMeta) => {
  if (!docMeta || typeof docMeta !== 'object') return [];
  const pills = [];
  const labelMap = {
    ownerName: 'Owner',
    clientName: 'Owner',
    purchaserName: 'Purchaser / Owner',
    claimant: 'Claimant / Owner',
    fatherName: 'Father/Spouse',
    fathersName: 'Father/Spouse',
    vendorName: 'Vendor',
    executant: 'Executant',
    deedNo: 'Deed No',
    deedYear: 'Deed Year',
    surveyNo: 'Survey No',
    netExtent: 'Net Extent',
    plotNo: 'Plot No',
    assessmentNo: 'Assessment No',
    doorNo: 'Door No',
    village: 'Village/Locality',
    district: 'District',
    approvalPlanNo: 'Plan No',
    bankName: 'Bank',
    valuationTotal: 'Total Valuation',
    propertyType: 'Property Type',
    structureType: 'Structure Type',
    roadWidth: 'Road Width',
    buildingAge: 'Building Age'
  };

  Object.entries(docMeta).forEach(([k, item]) => {
    const val = typeof item === 'object' && item !== null && 'value' in item ? item.value : (typeof item === 'object' && item !== null ? item.value || null : item);
    if (val && typeof val === 'string' && val.trim() && val !== 'N/A' && val !== 'null' && labelMap[k]) {
      if (!pills.some(p => p.label === labelMap[k])) {
        pills.push({ label: labelMap[k], value: val.trim() });
      }
    }
  });

  return pills;
};

export const FLOOR_LABELS = [
  'Ground Floor (GF)', 'First Floor (FF)', 'Second Floor (SF)', 
  'Third Floor (TF)', 'Fourth Floor (4F)', 'Fifth Floor (5F)', 
  'Sixth Floor (6F)', 'Seventh Floor (7F)'
];

export const toFieldValue = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('value' in val) return toFieldValue(val.value);
    return '';
  }
  const str = String(val).trim();
  if (str === '[object Object]' || str === 'null' || str === 'undefined' || str.toLowerCase() === 'optional') return '';
  return str;
};

export const formatCurrency = (val) => {
  if (!val) return '';
  const num = val.toString().replace(/\D/g, '');
  if (!num) return '';
  return new Intl.NumberFormat('en-IN').format(num);
};
