// Downloaded reports are named: file number, month, year (2 digits), branch code, client name — e.g. file
// GOURU/KDP/2026/11/0012 for Sri P. Jaya Krishna → "0012_11_26_KDP_Sri_P_Jaya_Krishna.docx".
// Sorts by number in the phone's files, WhatsApp and email. English letters only (download headers can't carry Telugu). A prefix (e.g. "Documents") goes at the end.
export function reportFileName(c = {}, ext = 'docx', prefix = '') {
  const name = String(c.clientName || c.borrowerName || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 60);
  const fileNo = String(c.fileNumber || '');
  // GOURU / KDP / 2026 / 11 / 0012  (also "GOURU-KDP-2026-11-0012")
  const m = /^[A-Za-z]+[/-]([A-Za-z]+)[/-](\d{4})[/-](\d{1,2})[/-](\d+)$/.exec(fileNo.trim());
  let parts;
  if (m) {
    parts = [m[4], m[3].padStart(2, '0'), m[2].slice(-2), m[1].toUpperCase()];
  } else {
    // No standard file number: the number / id, then the month and year it was made
    const d = new Date(c.approvedAt || c.createdAt || Date.now());
    const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
    const no = (fileNo.match(/\d+$/) || [String(c.id || '')])[0].replace(/[^A-Za-z0-9]+/g, '');
    parts = [no, String(ist.getUTCMonth() + 1).padStart(2, '0'), String(ist.getUTCFullYear()).slice(-2), String(c.branchCode || '').toUpperCase()];
  }
  return `${[...parts, name, prefix].filter(Boolean).join('_') || 'Valuation_Report'}.${ext}`;
}
