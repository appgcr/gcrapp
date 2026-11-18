// Every report is made only from the bank's own exact format. When a bank has no format for a
// property type yet, nothing is generated (the old reference templates hold another case's figures)
// and people see this message instead.

const path = require('path');
const { spawnSync } = require('child_process');

const TYPE_WORDS = { house: 'House', apartment: 'Apartment / Flat', open_site: 'Open Site', agriculture: 'Agriculture Land', industrial: 'Industrial' };

function noFormatMessage(bank, propertyType) {
  return `The ${bank || 'bank'} report format for ${propertyType || 'this property type'} is not installed yet, so the report can't be made. `
    + 'Please send a sample report of this bank for this property type to add it (or pick this bank\'s format in Settings → Banks).';
}

/** Python stderr → the plain message, or null when it wasn't a missing format */
function fromGeneratorError(stderr) {
  const m = /NO_FORMAT\|([^|\n]*)\|([^\n]*)/.exec(String(stderr || ''));
  return m ? noFormatMessage(m[1].trim(), m[2].trim()) : null;
}

/** { ok, format, message } for a case prepared by bankInfoForReport */
function checkFormat(preparedCase) {
  const r = spawnSync('python3', [path.join(__dirname, 'reports', 'check_format.py')], {
    input: JSON.stringify(preparedCase), timeout: 20000, maxBuffer: 4 * 1024 * 1024,
  });
  try {
    const out = JSON.parse(String(r.stdout || '{}'));
    const pt = preparedCase?.propertyDetails?.propertyType || TYPE_WORDS[out.format] || '';
    return { ok: !!out.ok, format: out.format || null, message: out.ok ? '' : noFormatMessage(preparedCase?.bankName, pt) };
  } catch {
    return { ok: true, format: null, message: '' }; // never block on a checker failure
  }
}

module.exports = { checkFormat, fromGeneratorError, noFormatMessage };
