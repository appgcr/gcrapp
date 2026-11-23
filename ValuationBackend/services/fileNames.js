// Report file names: client name + file number ("Smt_V_Saraswathamma_GOURU-MAIN-2026-11-0009.docx").
// Header-safe (ASCII only) so every phone and mail app shows it.
function reportFileName(c = {}, ext = 'docx', prefix = '') {
  const name = String(c.clientName || c.borrowerName || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 60);
  const no = String(c.fileNumber || c.id || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${[prefix, name, no].filter(Boolean).join('_') || 'Valuation_Report'}.${ext}`;
}
module.exports = { reportFileName };
