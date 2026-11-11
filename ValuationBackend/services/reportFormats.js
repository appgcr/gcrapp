// Bank → report format registry. When the branch admin picks a bank on a case, the case
// records which bank's format its report must use. Each bank's own template is plugged in
// here as it is supplied; until then the standard GCR template for the property type is used.
//
// To add a bank's template: put the .docx in services/templates/banks/<key>/<propertyType>.docx
// and set `templates` below, e.g. { house: 'banks/sbi/house.docx' }.

const BANKS = [
  { key: 'sbi', label: 'State Bank of India', match: [/state bank of india/i, /\bsbi\b/i], templates: {} },
  { key: 'apgb', label: 'Andhra Pradesh Grameena Bank', match: [/grameena/i, /\bapgb\b/i], templates: {} },
  { key: 'canara', label: 'Canara Bank', match: [/canara/i], templates: {} },
  { key: 'union', label: 'Union Bank of India', match: [/union bank/i], templates: {} },
  { key: 'bob', label: 'Bank of Baroda', match: [/baroda/i, /\bbob\b/i], templates: {} },
  { key: 'pnb', label: 'Punjab National Bank', match: [/punjab national/i, /\bpnb\b/i], templates: {} },
  { key: 'indian', label: 'Indian Bank', match: [/^indian bank/i], templates: {} },
  { key: 'iob', label: 'Indian Overseas Bank', match: [/indian overseas/i, /\biob\b/i], templates: {} },
  { key: 'boi', label: 'Bank of India', match: [/^bank of india/i, /\bboi\b/i], templates: {} },
  { key: 'hdfc', label: 'HDFC Bank', match: [/hdfc/i], templates: {} },
  { key: 'icici', label: 'ICICI Bank', match: [/icici/i], templates: {} },
  { key: 'axis', label: 'Axis Bank', match: [/axis/i], templates: {} },
];

function bankFor(bankName) {
  const name = String(bankName || '').trim();
  if (!name) return null;
  return BANKS.find((b) => b.match.some((re) => re.test(name))) || { key: 'other', label: name, templates: {} };
}

// What the case stores: which bank format, and whether that bank's own template is installed yet
function reportFormatFor(bankName) {
  const bank = bankFor(bankName);
  if (!bank) return null;
  return { bankKey: bank.key, label: bank.label, bankTemplate: Object.keys(bank.templates).length > 0 };
}

module.exports = { BANKS, bankFor, reportFormatFor };
