// Valocity (connect.valocityglobal.com) → Gouru values.
// Field IDs are the form's own (formcontrolname), read from the Karnataka Bank form
// "KBL_NEW_08012025_V4.0" (KTK Bank New Report Template). When a field ID is not on the page
// (another bank's form), the label is used instead.
//   guess: true  → not stored in Gouru; a usual answer is filled in orange for you to check
//   wait: true   → a box that only opens after the one above it is filled
//   search       → words typed into a Valocity search box (District, Village, Pincode…)

const DISTRICT_ALIASES = [
  [/kadapa|cuddapah|y\.?\s*s\.?\s*r/i, { search: ['Kadapa', 'YSR', 'Cuddapah'], names: ['YSR Kadapa', 'Y.S.R. Kadapa', 'Y.S.R', 'Kadapa', 'Cuddapah'] }],
  [/nellore|potti/i, { search: ['Nellore'], names: ['Sri Potti Sriramulu Nellore', 'Nellore'] }],
  [/anantap|ananthap/i, { search: ['Anant'], names: ['Anantapur', 'Ananthapuramu', 'Anantapuramu'] }],
  [/kurnool/i, { search: ['Kurnool'], names: ['Kurnool'] }],
  [/chittoor/i, { search: ['Chittoor'], names: ['Chittoor'] }],
  [/tirupati/i, { search: ['Tirupati'], names: ['Tirupati'] }],
  [/annamayya/i, { search: ['Annamayya'], names: ['Annamayya'] }],
];

function place(value) {
  const v = String(value || '').trim();
  if (!v) return { names: [], search: [] };
  for (const [re, a] of DISTRICT_ALIASES) if (re.test(v)) return a;
  const word = v.split(/[\s,]+/).sort((a, b) => b.length - a.length)[0];
  return { names: [v], search: [word.slice(0, Math.max(4, Math.min(8, word.length)))] };
}

function areaClass(text) {
  const t = String(text || '').toLowerCase();
  if (/upper|high|posh|elite/.test(t)) return 'Upper';
  if (/lower|poor|slum/.test(t)) return 'Lower';
  if (/middle|mid/.test(t)) return 'Middle';
  return '';
}

function urbanRural(localBody) {
  const t = String(localBody || '').toLowerCase();
  if (/corporation|municipal|nagar|city/.test(t)) return 'Urban';
  if (/panchayat|gram|village/.test(t)) return 'Rural';
  return '';
}

export const valocity = {
  name: 'Valocity',
  match: (url) => /valocityglobal\.com/.test(url),
  fields: (v) => {
    const land = v.kind === 'open_site' || v.kind === 'agriculture';
    const method = v.kind === 'apartment' ? 'Composite Rate' : land ? 'Land only' : 'Land & Building';
    const propertyType = {
      apartment: ['Res-Flat/Apartment'], house: ['Res-Building', 'Res-Villa/Bungalow'], open_site: ['Res-Plot', 'Plot'],
      agriculture: ['Agricultural Land'], industrial: ['Industrial', 'Ind-Plot'],
    }[v.kind];
    const district = place(v.district);
    const mandal = place(v.mandal);
    const village = place(v.village);
    const locality = place(v.locality);
    const cls = areaClass(v.localityClass);
    const urban = urbanRural(v.localBody);
    const guidelineValue = v.guidelineRate && v.landArea ? String(Math.round(Number(v.guidelineRate) * Number(v.landArea))) : '';

    return [
      // Top
      { id: 'mat-select-1', name: 'Units: Land', value: ['Sq Yards', 'Sq. Yards', 'Sq Yd', 'Square Yards'] },          // Units: Land
      { id: 'mat-select-0', name: 'Units: Building', value: ['Sq Feet', 'Sq. Feet', 'Sq Ft', 'Square Feet'] },            // Units: Building
      { id: 'c0d13c18-acc5-4ee3-9c68-4b388c17f489', label: 'Property Type', value: propertyType },
      { label: 'Valuation Methodology', value: method },

      // General information
      { id: 'e71af696-7c72-44d8-a5bc-1132dfc614fc', label: 'Purpose of valuation', value: v.purpose },
      { label: 'Date of visit', value: v.inspectionDate },
      { id: 'af4d0704-d4c4-45ac-9a13-4580016608ee', label: 'Person met on site', value: v.personMet },
      { id: '21ab2463-06f5-41fc-9323-15c6bbdf3f88', label: 'Name of the borrower', value: v.borrower },
      { id: 'a7b9b00f-674e-4e39-89a6-e172dac912f2', label: 'Name of the bank official', value: v.bankOfficial },

      // Property details: site address (State, then the search boxes in order)
      { id: '5822ab10-6d95-4fea-a592-36c92a5c58b7', label: 'Name and address of the owner', value: v.ownerNameAddress },
      { id: '45c49bf3-1aa5-48c5-9536-476326ef5942', label: 'Brief description of the property', value: v.description },
      { id: '7bd38127-d110-4c29-b5dd-eeee65328415-State', label: 'State', value: v.state },
      { label: 'District', value: district.names, search: district.search, wait: true },
      { label: 'Sub District', value: mandal.names, search: mandal.search, wait: true },
      { label: 'City / Town', value: mandal.names, search: mandal.search, wait: true },
      { label: 'Village', value: village.names, search: village.search, wait: true },
      { label: 'Locality', value: locality.names, search: locality.search, wait: true },
      { label: 'Pincode', value: v.pinCode, search: [v.pinCode], wait: true },
      { id: '7bd38127-d110-4c29-b5dd-eeee65328415-NearestLandmarkPOI', label: 'Nearest landmark', value: v.landmark },
      { id: '0309cfef-8fac-455e-ae79-a3916357802a', label: 'Legal address', value: v.address },
      { id: '6c62cd11-114c-4635-bc43-3160bf049187', label: 'Year of acquisition', value: v.deedYear },
      // Legal address details
      { id: 'b1b4fc84-9d48-4a2b-b71d-e5d9cb62c245-State', name: 'State (legal address)', value: v.state },
      { label: 'Taluka / Sub District', value: mandal.names, search: mandal.search, wait: true },
      { label: 'Village', value: village.names, search: village.search, wait: true },
      { id: '12a4487a-98c9-47fe-90d3-89b36368cdb7', label: 'Door number/survey number', value: v.doorSurvey },
      { id: 'ce287ead-577f-498f-92f1-b7e2d5ed42af', label: 'Name of the builder', value: v.builder || 'NA' },
      { id: '040d4327-f420-4a87-8e51-0ad03494c554', label: 'Name of seller', value: v.seller },

      // Boundaries & checks
      { id: '00712fae-85ee-455c-b3c8-024edd8065e1', label: 'Boundaries matching with site', value: v.boundariesMatch },
      { id: '9830c6f8-3453-4bd8-9dd0-7f3516e84d8d', label: 'geo-tagged', value: 'Yes', guess: true },
      { id: 'b39a8848-9274-40a0-8099-fffdef57d781', label: 'clear demarcation', value: 'Yes', guess: true },
      { id: 'a1065d8e-fff2-49f0-8f85-f1c20bc71bae', label: 'Whether dimension of the property tallied', value: 'Yes', guess: true },
      { id: '837e6c61-718a-40a1-adb6-58b0e75c3a91', label: 'land locked', value: 'No', guess: true },
      { id: 'e62db4c7-20ef-4c61-859b-3af6a919b182', label: 'proper approach road', value: 'Yes', guess: true },
      { id: 'af069092-0837-47b8-be77-a647d25e12c3', label: 'Width of approach road', value: v.roadWidth },
      { id: 'ef258a94-5603-49bb-849c-0a3c0bc0bec3', label: 'motorable', value: 'Yes', guess: true },
      { id: '4ed31084-a820-4310-93f4-5404a546ce66', label: 'sewage water drain', value: 'No', guess: true },
      { id: '39247f6d-f12e-4c09-b16b-cc70eb373313', label: 'impact on marketability', value: 'No adverse factors affecting the marketability of the property.', guess: true },
      { id: '5c1a8121-5300-47c7-a82a-d040f94718b9', label: 'sensitive area', value: 'No', guess: true },
      { id: '0b7227fc-f1f1-479f-bf5e-66c12280d53b', label: 'Coastal Regulation Zone', value: 'No', guess: true },
      { id: '1201f097-c411-4cad-a8cb-684fc3d399d8', label: 'National Monuments Authority', value: 'No', guess: true },
      { id: '1aaa739c-611f-4d0b-9706-98c4090ded36', label: 'No objection certificate', value: 'NA', guess: true },
      { id: 'b4b8504c-56c3-4408-a121-99be64091f0f', label: 'Date of issue of and validity of approved plan', value: v.approvalPlanDate },
      { id: 'ef8852b3-8680-4417-9fb1-91a780fcd6aa', label: 'Issuing authority & approval Ref', value: [v.planAuthority, v.approvalPlanNo].filter(Boolean).join(', ') },
      { id: 'eebf3da6-7a97-4418-af1a-fa0e51a0cf8d', label: 'genuineness or authenticity', value: v.approvalPlanNo ? 'Yes' : '', guess: true },

      // Location & construction
      { id: '92c65958-a4ea-4fa0-a3f3-85cd35f302b8', label: 'Advantage', value: v.advantages },
      { id: 'fef40ef8-094a-473f-a3e6-a6c61787e1e9', label: 'Class of the area', value: cls || 'Middle', guess: !cls },
      { id: '4f305311-9f07-4569-9820-bcaf3b6aac1e', label: 'Classification of the area', value: urban || 'Semi Urban', guess: !urban },
      { id: '94c65dcc-af87-490b-b001-a17969c0b3e1', label: 'Civic amenities', value: v.civicAmenities },
      { id: '25f7398a-55be-4def-a9da-fc5c119e1f64', label: 'Type of Valuation Report', value: 'Market Value' },
      { id: 'e2954558-dab6-4ba8-8ab3-f19c107825fc', label: 'Number of floors', value: land ? '' : v.floors },
      { id: 'b34c8904-609f-4e76-a755-aa6ff2fa5648', label: 'Present condition of building', value: land ? '' : 'Good', guess: true },
      { id: 'ed73d722-73ac-485b-988f-b847f1e860aa', label: 'Since how long owning the property', value: v.deedYear ? `Since ${v.deedYear}` : '' },
      { id: '693e7a45-2534-47ae-8b10-b48794123861', label: 'Year of purchase', value: v.deedYear },
      { id: '3d45788b-f8ec-41a9-b567-d8fb47c64a6a', label: 'Type of ownership', value: 'Sole', guess: true },

      // Land valuation
      { id: 'f54bebec-06ed-4ea0-8a1e-e0ee45191b2a', label: 'Adopted land/ plot area', value: v.landArea },
      { id: '06ffeec8-2c7a-43ba-b8b2-334e09d54e5d', label: 'unit type', value: ['Sq Yards', 'Sq. Yards'] },
      { id: '8bd82dfb-d446-467e-b1f5-d6cd56d3d121', label: 'Land guideline rate', value: v.guidelineRate },
      { id: '5f476077-0f7a-4590-9c01-492d343a8c30', label: 'Land guideline value', value: guidelineValue },

      // Final value ("Calculated" boxes are left to Valocity's Calculate button)
      { id: '63554869-c954-4003-9504-be12c4cade70', label: 'in words', value: v.finalValueWords, guess: true },
      { id: 'fd613c54-1828-4675-9278-8703c1634988', label: 'Amount of depreciation', value: v.depreciation },
      { id: 'e0ec11a1-918c-4e3e-a36b-76be70f9782b', label: 'Forced sale value', value: v.forcedSaleValue },
      { id: '2ec7798d-a670-431c-99b1-1a3e5d5d68fa', label: 'Insurable value', value: v.insurableValue },

      // Final remarks
      { id: '86497685-2ccc-4eb9-8f1d-49dc2bb0b85a', label: 'disposed', value: 'Yes', guess: true },
      { id: '1f5e2f3c-7787-4a68-976c-f8f62c499696', label: 'Remarks', value: v.remarks },
      { id: '1e8617f8-b2ec-4af9-9085-c93edf1b4754', label: 'Property visited by', value: v.engineer },
      { label: 'Date of report', value: v.reportDate },
    ];
  },
};
