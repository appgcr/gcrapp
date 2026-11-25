// Valocity (connect.valocityglobal.com) valuation form → Gouru values.
// Each row: the field's label as Valocity prints it, and the value to put there.
//   guess: true  → not stored in Gouru; a usual answer is filled and shown in orange for you to check
//   wait: true   → a dropdown whose list loads after the one above it (State → District → …)

export const valocity = {
  name: 'Valocity',
  match: (url) => /valocityglobal\.com/.test(url),
  fields: (v) => {
    const method = v.kind === 'apartment' ? 'Composite Rate' : (v.kind === 'open_site' || v.kind === 'agriculture') ? 'Land only' : 'Land & Building';
    const typeWords = { apartment: ['Apartment', 'Flat', 'Residential'], house: ['Independent House', 'House', 'Residential'],
      open_site: ['Plot', 'Open Plot', 'Land', 'Residential Plot'], agriculture: ['Agricultural', 'Agriculture Land', 'Land'],
      industrial: ['Industrial', 'Factory', 'Shed'] }[v.kind];
    return [
      // Top
      { label: 'Property Type', value: typeWords },
      { label: 'Valuation Methodology', value: method },

      // General information
      { label: 'Purpose of valuation', value: v.purpose },
      { label: 'Date of visit', value: v.inspectionDate, date: true },
      { label: 'Person met on site', value: v.personMet },
      { label: 'Name of the borrower', value: v.borrower },
      { label: 'Name of the bank official', value: v.bankOfficial },

      // Property details
      { label: 'Name and address of the owner', value: v.ownerNameAddress },
      { label: 'Brief description of the property', value: v.description },
      { label: 'State', value: v.state, section: 'Site address' },
      { label: 'District', value: v.district, wait: true },
      { label: 'Sub District', value: v.mandal, wait: true },
      { label: 'City / Town', value: v.mandal, wait: true },
      { label: 'Village', value: v.village, wait: true },
      { label: 'Locality', value: v.locality },
      { label: 'Pincode', value: v.pinCode },
      { label: 'Nearest landmark', value: v.landmark },
      { label: 'Legal address', value: v.address },
      { label: 'Year of acquisition', value: v.deedYear },
      { label: 'Door number/survey number', value: v.doorSurvey },
      { label: 'Name of the builder', value: v.builder || 'NA' },
      { label: 'Name of seller', value: v.seller },

      // Boundaries and checks
      { label: 'Boundaries matching with site', value: v.boundariesMatch },
      { label: 'Whether the security is geo-tagged', value: 'Yes', guess: true },
      { label: 'Whether property can be identified', value: 'Yes', guess: true },
      { label: 'Whether dimension of the property tallied', value: 'Yes', guess: true },
      { label: 'Whether property is land locked', value: 'No', guess: true },
      { label: 'Whether proper approach road', value: 'Yes', guess: true },
      { label: 'Width of approach road', value: v.roadWidth },
      { label: 'Whether it is insurable', value: 'Yes', guess: true },
      { label: 'Whether the property is situated in close proximity', value: 'No', guess: true },
      { label: 'Whether the property is in a sensitive area', value: 'No', guess: true },
      { label: 'Whether property situated in Coastal Regulation Zone', value: 'No', guess: true },
      { label: 'Whether property development of site/ project', value: 'No', guess: true },
      { label: 'Prior permission/ No objection certificate', value: 'No', guess: true },
      { label: 'Date of issue of and validity of approved plan', value: [v.approvalPlanNo, v.approvalPlanDate].filter(Boolean).join(' dt ') },
      { label: 'Issuing authority & approval Ref. number', value: [v.planAuthority, v.approvalPlanNo].filter(Boolean).join(', ') },

      // Location & construction
      { label: 'Advantages & disadvantages', value: v.advantages },
      { label: 'Class of the area', value: v.localityClass },
      { label: 'Civic amenities', value: v.civicAmenities },
      { label: 'Type of Valuation Report', value: v.kind === 'open_site' || v.kind === 'agriculture' ? ['Land', 'Vacant'] : ['Completed', 'Ready'] },
      { label: 'Number of floors', value: v.floors },
      { label: 'Since how long owning the property', value: v.deedYear ? `Since ${v.deedYear}` : '' },
      { label: 'Year of purchase', value: v.deedYear },

      // Land valuation
      { label: 'Adopted land/ plot area', value: v.landArea },
      { label: 'Adopted land/ plot area unit type', value: ['Sq.Yd', 'Sq Yd', 'Square Yard', 'Sq. Yards'] },
      { label: 'Land guideline rate', value: v.guidelineRate },
      { label: 'Land guideline value', value: v.guidelineRate && v.landArea ? String(Math.round(Number(v.guidelineRate) * Number(v.landArea))) : '' },

      // Final value
      { label: 'Final value (in Rs.) (in words)', value: v.finalValueWords },
      { label: 'Final value', value: v.finalValue },
      { label: 'Amount of depreciation written down', value: v.depreciation },
      { label: 'Forced sale value', value: v.forcedSaleValue },
      { label: 'Insurable value', value: v.insurableValue },

      // Final remarks
      { label: 'Remarks', value: v.remarks },
      { label: 'Property visited by', value: v.engineer },
      { label: 'Date of report', value: v.reportDate, date: true },
    ];
  },
};
