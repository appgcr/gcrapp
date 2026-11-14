const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const fileStore = require('../services/fileStore');

// POST /api/files — upload one document as raw bytes (any size up to the 1 GB safety stop).
// Headers: Content-Type = the file's type, X-File-Name = encodeURIComponent(name)
router.post('/', authenticateToken, async (req, res) => {
  try {
    let name = 'document';
    try { name = decodeURIComponent(String(req.headers['x-file-name'] || 'document')); } catch { /* keep default */ }
    const saved = await fileStore.saveStream(req, {
      filename: name,
      contentType: String(req.headers['content-type'] || 'application/octet-stream').split(';')[0],
      uploadedBy: req.user && req.user.id,
    });
    res.status(201).json(saved);
  } catch (err) {
    if (!err.status) console.error('File upload failed:', err);
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not store the file. Please try again.' });
  }
});

// GET /api/files/:id?k=<key> — the file itself (opens in viewers, <img>, PDF readers).
// The random key in the link is what allows access, so it works without a sign-in header.
router.get('/:id', async (req, res) => {
  try {
    const file = await fileStore.findFile(req.params.id, req.query.k);
    if (!file) return res.status(404).json({ error: 'File not found.' });
    const total = file.length;
    const type = file.contentType || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    const disposition = /pdf|image\//.test(type) ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename || 'document')}`);

    // Range requests let PDF viewers open big files page by page
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : total - parseInt(m[2], 10);
      let end = m[1] && m[2] ? parseInt(m[2], 10) : total - 1;
      start = Math.max(0, start); end = Math.min(total - 1, end);
      if (start > end) { res.setHeader('Content-Range', `bytes */${total}`); return res.status(416).end(); }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);
      return fileStore.openStream(req.params.id, { start, end }).on('error', () => res.end()).pipe(res);
    }
    res.setHeader('Content-Length', total);
    fileStore.openStream(req.params.id).on('error', () => res.end()).pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Could not open the file.' });
  }
});

module.exports = router;
