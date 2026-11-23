// Downloaded reports are named after the client and the file number, e.g.
// "Smt_V_Saraswathamma_GOURU-MAIN-2026-11-0009.docx" — easy to find in WhatsApp, email and the phone's files.
export function reportFileName(c = {}, ext = 'docx', prefix = '') {
  const name = String(c.clientName || c.borrowerName || '').replace(/[^A-Za-z0-9ఀ-౿]+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 60);
  const no = String(c.fileNumber || c.id || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${[prefix, name, no].filter(Boolean).join('_') || 'Valuation_Report'}.${ext}`;
}
