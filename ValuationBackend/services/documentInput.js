const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const JSZip = require('jszip');
const fileStore = require('./fileStore');

// Turns an uploaded document (PDF, photo or Word file of any size, kept in file storage)
// into what the AI reader takes: one or more data URLs.

const WORD_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf', 'text/rtf',
]);
const WORD_EXT = /\.(docx?|odt|rtf)$/i;

const isWord = (mime, name) => WORD_TYPES.has(String(mime || '').toLowerCase()) || WORD_EXT.test(String(name || ''));
const toDataUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

let sofficeBin; // cached: path to LibreOffice, or '' when it isn't installed (the production image has it)
function findSoffice() {
  if (sofficeBin !== undefined) return sofficeBin;
  sofficeBin = '';
  for (const cmd of ['soffice', 'libreoffice', '/usr/bin/soffice', '/usr/bin/libreoffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice']) {
    try {
      const r = spawnSync(cmd, ['--version'], { timeout: 15000 });
      if (r.status === 0) { sofficeBin = cmd; break; }
    } catch { /* try the next one */ }
  }
  return sofficeBin;
}

function run(bin, args, ms) {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* gone */ } resolve(false); }, ms);
    p.on('error', () => { clearTimeout(t); resolve(false); });
    p.on('exit', (code) => { clearTimeout(t); resolve(code === 0); });
  });
}

/** Word → PDF with LibreOffice (pictures scaled down so the PDF stays small). null if not possible. */
async function wordToPdf(buffer, name) {
  const bin = findSoffice();
  if (!bin) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gouru_doc_'));
  const ext = (String(name).match(WORD_EXT) || ['.docx'])[0].toLowerCase();
  const src = path.join(dir, `document${ext}`);
  try {
    fs.writeFileSync(src, buffer);
    const base = ['--headless', '--norestore', '--nologo', `-env:UserInstallation=file://${path.join(dir, 'profile')}`, '--outdir', dir];
    const small = 'pdf:writer_pdf_Export:{"ReduceImageResolution":{"type":"boolean","value":"true"},"MaxImageResolution":{"type":"long","value":"200"},"Quality":{"type":"long","value":"80"}}';
    const out = path.join(dir, 'document.pdf');
    let ok = await run(bin, [...base, '--convert-to', small, src], 180000);
    if (!ok || !fs.existsSync(out)) ok = await run(bin, [...base, '--convert-to', 'pdf', src], 180000); // older LibreOffice
    return ok && fs.existsSync(out) ? fs.readFileSync(out) : null;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp folder */ }
  }
}

const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

/** .docx without LibreOffice: its text (paragraphs and tables) plus the pictures inside it */
async function readDocxDirect(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) return null;
  const xml = await xmlFile.async('string');
  const text = decodeXml(xml
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const pictures = [];
  const media = Object.values(zip.files).filter((f) => /^word\/media\/.+\.(png|jpe?g)$/i.test(f.name));
  for (const f of media.slice(0, 30)) {
    const b = await f.async('nodebuffer');
    if (b.length < 15000) continue; // logos and stamps-as-icons: skip
    pictures.push(toDataUrl(b, /\.png$/i.test(f.name) ? 'image/png' : 'image/jpeg'));
  }
  return { text, pictures };
}

/**
 * Stored file link (/api/files/<id>?k=<key>) → { dataUrls, isPdf, text, kind, numPages? }
 * Throws { status, message } with a message the engineer can act on.
 */
async function aiInputFromStoredFile(fileUrl) {
  const ref = fileStore.parseFileUrl(fileUrl);
  const file = ref && await fileStore.findFile(ref.id, ref.key);
  if (!file) throw Object.assign(new Error('The uploaded file was not found. Please upload it again.'), { status: 404 });
  const buffer = await fileStore.readBuffer(ref.id);
  const mime = String(file.contentType || '').toLowerCase();
  const name = file.filename || '';

  if (isWord(mime, name)) {
    const pdf = await wordToPdf(buffer, name);
    if (pdf) return { dataUrls: [toDataUrl(pdf, 'application/pdf')], isPdf: true, text: '', kind: 'word' };
    if (/\.docx$/i.test(name) || mime.includes('wordprocessingml')) {
      const direct = await readDocxDirect(buffer).catch(() => null);
      if (direct && (direct.text || direct.pictures.length)) {
        const parts = [];
        if (direct.text) parts.push(toDataUrl(Buffer.from(direct.text, 'utf8'), 'text/plain'));
        parts.push(...direct.pictures);
        return { dataUrls: parts, isPdf: false, text: direct.text, kind: 'word' };
      }
    }
    throw Object.assign(new Error('This Word file could not be opened. Please save it as PDF or DOCX and upload it again.'), { status: 422 });
  }
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
    return { dataUrls: [toDataUrl(buffer, 'application/pdf')], isPdf: true, text: '', kind: 'pdf' };
  }
  if (mime.startsWith('image/')) {
    return { dataUrls: [toDataUrl(buffer, mime)], isPdf: false, text: '', kind: 'image' };
  }
  throw Object.assign(new Error('This file type can’t be checked. Please upload a PDF, Word file or photo.'), { status: 415 });
}

module.exports = { aiInputFromStoredFile, isWord, wordToPdf, readDocxDirect };
