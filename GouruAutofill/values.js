// Turns one Gouru case into plain, portal-neutral values (owner, address, boundaries, rates, values…).
// Every portal map in portals/ picks from these.

const clean = (x) => (x === undefined || x === null ? '' : String(x).trim());
const first = (...xs) => xs.map(clean).find(Boolean) || '';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigits(n) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`; }
function threeDigits(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}
// Indian system: crore, lakh, thousand
export function rupeesInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (!n) return '';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return `Rupees ${parts.join(' ')} Only`;
}

const money = (n) => (Number(n) > 0 ? String(Math.round(Number(n))) : '');

// yyyy-mm-dd or a date string → dd/mm/yyyy (Indian portals)
export function ddmmyyyy(d) {
  const s = clean(d);
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const t = new Date(s);
  if (isNaN(t)) return s;
  return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
}

// Kind of property in plain words, from the case's property type
export function propertyKind(c) {
  const t = clean(c?.propertyDetails?.propertyType).toLowerCase();
  if (/apart|flat/.test(t)) return 'apartment';
  if (/agri|farm/.test(t)) return 'agriculture';
  if (/indus|shed|factory/.test(t)) return 'industrial';
  if (/open|site|plot|vacant/.test(t)) return 'open_site';
  return 'house';
}

export function caseValues(c) {
  const pd = c.propertyDetails || {};
  const r = pd.report || {};
  const s = pd.sheet || {};
  const v = c.valuation || {};
  const kind = propertyKind(c);
  const father = first(c.clientFatherName, pd.fathersName, s.ownerRelation);
  const ownerAddress = first(r.ownerAddress, s.address, c.address);
  const bDoc = pd.boundariesDoc || {};
  const bAct = pd.boundariesActual || {};
  const same = ['north', 'south', 'east', 'west'].every((k) => !clean(bAct[k]) || clean(bAct[k]).toLowerCase() === clean(bDoc[k]).toLowerCase());
  const fmv = v.fairMarketValue || v.reportTotal || 0;
  const doorSurvey = [
    pd.doorNo && `D.No ${pd.doorNo}`, pd.plotNo && `Plot No ${pd.plotNo}`, pd.flatNo && `Flat No ${pd.flatNo}`,
    pd.surveyNo && `Sy.No ${pd.surveyNo}`, pd.assessmentNo && `Assessment No ${pd.assessmentNo}`,
  ].filter(Boolean).join(', ');

  return {
    kind,
    fileNumber: clean(c.fileNumber || c.id),
    bankName: clean(c.bankName),
    bankBranch: clean(c.bankBranch),
    bankOfficial: [c.requestedBy?.name, c.requestedBy?.designation].map(clean).filter(Boolean).join(', '),
    purpose: first(c.requestDetails?.loanPurpose, r.purpose, 'To assess the fair market value of the property for bank loan purpose'),
    inspectionDate: ddmmyyyy(c.inspectionDate),
    reportDate: ddmmyyyy(new Date().toISOString().slice(0, 10)),
    borrower: clean(c.clientName),
    personMet: first(r.personMet, c.clientName),
    ownerName: clean(c.clientName),
    ownerNameAddress: [clean(c.clientName) + (father ? ` S/o ${father}` : ''), ownerAddress].filter(Boolean).join(', '),
    propertyType: clean(pd.propertyType),
    description: [clean(pd.propertyType), r.floorsDesc, r.landmark && `at ${r.landmark}`].map(clean).filter(Boolean).join(' '),
    state: 'Andhra Pradesh',
    district: clean(pd.district),
    mandal: first(pd.mandal),
    village: first(pd.village, r.village),
    locality: first(r.landmark, pd.village),
    landmark: first(r.nearBy, r.landmark),
    pinCode: clean(r.pinCode),
    address: first(c.address, r.ownerAddress),
    doorSurvey,
    surveyNo: clean(pd.surveyNo),
    builder: first(pd.builderName, r.aptName),
    seller: [clean(r.deedExecutant), clean(r.deedExecutantRelation) && `S/o ${clean(r.deedExecutantRelation)}`].filter(Boolean).join(' '),
    deedNo: clean(pd.deedNo),
    deedDate: ddmmyyyy(pd.deedDate),
    deedYear: clean(pd.deedYear),
    boundaries: { doc: bDoc, actual: bAct },
    boundariesMatch: same ? 'Yes' : 'No',
    roadWidth: first(pd.roadWidth, r.roadWidth),
    roadType: first(pd.roadType, r.roadType),
    approvalPlanNo: clean(pd.approvalPlanNo),
    approvalPlanDate: ddmmyyyy(pd.approvalPlanDate),
    planAuthority: clean(r.planAuthority),
    advantages: clean(r.advantage1),
    localityClass: first(r.localityClass, r.localityType),
    civicAmenities: clean(r.civicAmenities),
    floors: first(r.floorsShort, r.floorsDesc),
    buildingAge: first(pd.buildingAge, v.buildingAge || ''),
    yearOfConstruction: clean(r.yearOfConstruction),
    localBody: clean(r.localBodyName),
    landArea: v.netExtentSqYards ? String(Math.round(v.netExtentSqYards * 100) / 100) : first(pd.netExtent),
    landAreaUnit: 'Sq.Yd',
    guidelineRate: first(pd.guidelineRate, r.guidelineRatePerSqyd),
    landRate: first(v.landRate ? String(v.landRate) : '', pd.landRate, r.landRatePerSqyd),
    landValue: money(v.landValue),
    buildingValue: money(v.netStructureValue),
    finalValue: money(fmv),
    finalValueWords: rupeesInWords(fmv),
    realizableValue: money(v.realizableValue),
    forcedSaleValue: money(v.distressSaleValue),
    forcedSaleValueWords: rupeesInWords(v.distressSaleValue),
    insurableValue: money(v.insurableValue),
    depreciation: money(v.depreciationAmount),
    engineer: clean(c.assignedEngineerName),
    remarks: clean(r.remarks),
  };
}
