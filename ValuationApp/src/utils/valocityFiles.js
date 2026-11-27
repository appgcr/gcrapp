// "Valocity files": the only files of a case that go to the bank's Valocity portal. The Gouru Autofill Chrome
// extension lists just these on the Valocity page and attaches them there — never the sale deed, selfie etc.
import { API_BASE_URL } from '../config/api';
import { uploadDocumentFile } from './docFiles';
import { reportFileName } from './reportFileName';
import { matchBank } from './banks';

/** Does this bank (by name) use the Valocity portal? (Settings → Banks → Bank portal) */
export const isValocityBank = (banks, bankName) => (matchBank(banks || [], bankName)?.portal === 'valocity');

const MAX_SIDE = 2000; // px — clear for a valuation photo, small enough for portal upload limits
const SHRINK_ABOVE = 1.2 * 1024 * 1024;

/** Big phone photos → a JPEG of at most 2000 px a side. PDFs and other files are left as they are. */
export async function shrinkPhoto(file) {
  if (!/^image\/(jpeg|png|webp|heic|heif)/i.test(file.type || '') || file.size < SHRINK_ABOVE) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file; // the phone can't read it as a picture: send it unchanged
  }
}

const extOf = (file) => {
  const fromName = (String(file.name || '').match(/\.([A-Za-z0-9]{2,5})$/) || [])[1];
  if (fromName) return fromName.toLowerCase();
  if (/pdf/i.test(file.type)) return 'pdf';
  return /png/i.test(file.type) ? 'png' : 'jpg';
};

/**
 * Upload phone files (photos are made smaller) and add them to the case's Valocity list.
 * Named like the reports: 0012_11_26_KDP_Client_Name_Valocity_1.jpg
 * → the case's Valocity list
 */
export async function addValocityUploads(caseInfo, files, startAt = 0) {
  const items = [];
  let n = startAt;
  for (const original of files) {
    const file = await shrinkPhoto(original);
    n += 1;
    const name = reportFileName(caseInfo, extOf(file), `Valocity_${n}`);
    const url = await uploadDocumentFile(new File([file], name, { type: file.type, lastModified: Date.now() }));
    items.push({ name, url, type: file.type, size: file.size, from: 'upload' });
  }
  return postValocity(caseInfo.id, items);
}

/** Add files already on the case (document pages, site photos) to the Valocity list */
export const addValocityFromCase = (caseId, items) => postValocity(caseId, items.map((f) => ({ ...f, from: 'case' })));

async function postValocity(caseId, items) {
  const r = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/valocity-files`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: items }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Could not save the Valocity files.');
  return d.files || [];
}

export async function loadValocityFiles(caseId) {
  const r = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/valocity-files`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Could not load the Valocity files.');
  return d.files || [];
}

export async function removeValocityFile(caseId, fileId) {
  const r = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/valocity-files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Could not remove the file.');
  return d.files || [];
}
