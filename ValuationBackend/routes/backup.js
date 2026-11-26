// Database backup for the Super Admin: the whole database as one gzip file on their own computer.
// GET /api/backup/download            → data (every collection; uploaded files listed but not their bytes)
// GET /api/backup/download?files=1    → full (also every uploaded document / photo — large)
// GET /api/backup/status              → { lastAt, lastBy, lastKind, daysSince }
// Format: one JSON line per record — {"c": "<collection>", "d": <document as Extended JSON>} — restored by
// scripts/restore-backup.js into an EMPTY database only.
const express = require('express');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth');
const { isSuper } = require('../services/access');
const AppConfig = require('../models/AppConfig');

const router = express.Router();
router.use(authenticateToken, (req, res, next) => (isSuper(req.user) ? next() : res.status(403).json({ error: 'Only the Super Admin can take a backup.' })));

const FILE_CHUNKS = 'casefiles.chunks'; // GridFS bytes of uploaded documents and photos (services/fileStore.js)

router.get('/status', async (req, res) => {
  const cfg = await AppConfig.findOne({ key: 'global' }).select('backup').lean();
  const b = (cfg && cfg.backup) || {};
  res.json({ lastAt: b.lastAt || null, lastBy: b.lastBy || '', lastKind: b.lastKind || '', daysSince: b.lastAt ? Math.floor((Date.now() - new Date(b.lastAt)) / 86400000) : null });
});

router.get('/download', async (req, res) => {
  const withFiles = String(req.query.files || '') === '1';
  const db = mongoose.connection.db;
  if (!db) return res.status(503).json({ error: 'Database not connected.' });
  const { EJSON } = mongoose.mongo.BSON;
  const day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="gouru-backup-${withFiles ? 'full' : 'data'}-${day}.jsonl.gz"`);
  res.setHeader('Cache-Control', 'no-store');
  const gz = zlib.createGzip({ level: 6 });
  gz.pipe(res);
  const write = (line) => new Promise((resolve) => { if (!gz.write(line)) gz.once('drain', resolve); else resolve(); });
  let count = 0;
  try {
    await write(`${JSON.stringify({ c: '_meta', d: { app: 'Gouru Valuations', at: new Date().toISOString(), kind: withFiles ? 'full' : 'data', by: req.user.name || req.user.id } })}\n`);
    const cols = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
    for (const name of cols) {
      if (name === FILE_CHUNKS && !withFiles) continue;
      const cursor = db.collection(name).find({}, { batchSize: 200 });
      for await (const doc of cursor) {
        await write(`${JSON.stringify({ c: name, d: EJSON.serialize(doc, { relaxed: false }) })}\n`);
        count += 1;
      }
    }
    gz.end();
    await AppConfig.updateOne({ key: 'global' }, { $set: { backup: { lastAt: new Date(), lastBy: req.user.name || req.user.id, lastKind: withFiles ? 'full' : 'data', records: count } } }, { upsert: true });
  } catch (err) {
    console.error('backup:', err.message);
    gz.destroy(err); // the download fails visibly rather than saving half a backup
  }
});

module.exports = router;
