const crypto = require('crypto');
const mongoose = require('mongoose');
// Use the driver that Mongoose itself runs on (a separately installed copy may be a different version)
const { GridFSBucket, ObjectId } = mongoose.mongo;

// Case documents (sale deeds, plans, Word files…) of any size are kept here, outside the case
// record — a MongoDB record can't be bigger than 16 MB, a scanned deed easily is.
// Each file gets a random key; its link only works with that key (/api/files/<id>?k=<key>).

const BUCKET = 'casefiles';
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB: a safety stop against a runaway upload, not a working limit

let bucket = null;
function getBucket() {
  if (!bucket) {
    if (!mongoose.connection || !mongoose.connection.db) throw new Error('Database not connected');
    bucket = new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
  }
  return bucket;
}

const cleanName = (n) => String(n || 'document').replace(/[\r\n"\\/]/g, ' ').trim().slice(0, 180) || 'document';

/** Stream an upload into storage. → { id, key, size, url } */
function saveStream(readable, { filename, contentType, uploadedBy }) {
  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString('hex');
    const up = getBucket().openUploadStream(cleanName(filename), {
      contentType: contentType || 'application/octet-stream',
      metadata: { key, uploadedBy: uploadedBy || '', uploadedAt: new Date() },
    });
    let size = 0;
    let failed = false;
    const fail = (err) => {
      if (failed) return;
      failed = true;
      up.abort().catch(() => {});
      reject(err);
    };
    readable.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        readable.unpipe(up);
        readable.resume();
        fail(Object.assign(new Error('File is larger than 1 GB.'), { status: 413 }));
      }
    });
    readable.on('error', fail);
    up.on('error', fail);
    up.on('finish', () => {
      if (failed) return;
      if (!size) return fail(Object.assign(new Error('The file is empty.'), { status: 400 }));
      const id = String(up.id);
      resolve({ id, key, size, url: `/api/files/${id}?k=${key}` });
    });
    readable.pipe(up);
  });
}

/** Stored file's details when the key matches, else null */
async function findFile(id, key) {
  if (!ObjectId.isValid(id) || !key) return null;
  const [file] = await getBucket().find({ _id: new ObjectId(id) }).limit(1).toArray();
  if (!file || !file.metadata || typeof file.metadata.key !== 'string') return null;
  const a = Buffer.from(String(key));
  const b = Buffer.from(file.metadata.key);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return file;
}

function openStream(id, range) {
  const opts = range ? { start: range.start, end: range.end + 1 } : undefined;
  return getBucket().openDownloadStream(new ObjectId(id), opts);
}

async function readBuffer(id) {
  const chunks = [];
  for await (const c of openStream(id)) chunks.push(c);
  return Buffer.concat(chunks);
}

/** /api/files/<id>?k=<key> (absolute or relative) → { id, key } or null */
function parseFileUrl(url) {
  const m = /\/api\/files\/([a-f0-9]{24})\?k=([a-f0-9]{32})/i.exec(String(url || ''));
  return m ? { id: m[1], key: m[2] } : null;
}

/**
 * Safety net when a case is saved: any document page still embedded as a big data URL
 * (older app versions, offline queue) is moved into file storage and replaced by its link.
 */
const OFFLOAD_ABOVE = 1024 * 1024;
async function offloadLargeDocuments(documents, uploadedBy) {
  if (!documents || typeof documents !== 'object') return documents;
  const { Readable } = require('stream');
  const out = {};
  for (const [slot, pages] of Object.entries(documents)) {
    if (!Array.isArray(pages)) { out[slot] = pages; continue; }
    out[slot] = [];
    for (const p of pages) {
      const m = p && typeof p.url === 'string' && p.url.length > OFFLOAD_ABOVE && /^data:([^;,]+)?(;[^,]*)?,/.exec(p.url);
      if (!m) { out[slot].push(p); continue; }
      const isB64 = /;base64/i.test(m[2] || '');
      const raw = p.url.slice(m[0].length);
      const buffer = isB64 ? Buffer.from(raw, 'base64') : Buffer.from(decodeURIComponent(raw), 'utf8');
      const saved = await saveStream(Readable.from(buffer), { filename: p.name || slot, contentType: m[1] || 'application/octet-stream', uploadedBy });
      out[slot].push({ ...p, url: saved.url, stored: true });
    }
  }
  return out;
}

module.exports = { offloadLargeDocuments, saveStream, findFile, openStream, readBuffer, parseFileUrl, MAX_BYTES };
