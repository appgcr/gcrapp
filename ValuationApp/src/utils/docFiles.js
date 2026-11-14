import { API_BASE_URL } from '../config/api';

// Case documents: PDF, Word or photos of any size. Big files and every PDF / Word file are kept in
// the server's file storage and saved on the case as a link (/api/files/<id>?k=<key>).

const WORD_EXT = /\.(docx?|odt|rtf)$/i;
const WORD_MIME = /msword|wordprocessingml|opendocument\.text|rtf/i;
const MIME_BY_EXT = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
};

export const DOC_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*';

/** Word file? Works for a File or a saved page ({ name, mime, isWord }). */
export const isWordFile = (f) => Boolean(f && (f.isWord || WORD_EXT.test(f.name || '') || WORD_MIME.test(f.type || f.mime || '')));

export const fileMime = (file) => {
  if (file.type) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
};

/** Saved link → full address the app can open */
export const resolveDocUrl = (url) => (typeof url === 'string' && url.startsWith('/api/files/') ? `${API_BASE_URL}${url}` : url);

/** Upload one file to the server's file storage. → '/api/files/<id>?k=<key>' */
export async function uploadDocumentFile(file) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/files`, {
      method: 'POST',
      headers: { 'Content-Type': fileMime(file), 'X-File-Name': encodeURIComponent(file.name || 'document') },
      body: file,
    });
  } catch {
    throw new Error('The file could not be uploaded — the phone could not reach the server. Check the internet connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || `The file could not be uploaded (server error ${res.status}). Please try again.`);
  return data.url;
}

export const formatMB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
