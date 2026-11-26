// Restore a Gouru backup (from Settings → Database backup) into an EMPTY database — for a disaster, or to make a
// staging copy. It refuses a database that already has cases or users, so live data can never be overwritten.
//   MONGODB_URI="mongodb+srv://…/gcr_restore" node scripts/restore-backup.js gouru-backup-data-2026-11-26.jsonl.gz
const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');

(async () => {
  const file = process.argv[2];
  const uri = process.env.MONGODB_URI;
  if (!file || !fs.existsSync(file)) { console.error('Give the backup file: node scripts/restore-backup.js <file.jsonl.gz>'); process.exit(1); }
  if (!uri) { console.error('Set MONGODB_URI to the (empty) database to restore into.'); process.exit(1); }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  for (const c of ['valuationcases', 'users']) {
    if (await db.collection(c).estimatedDocumentCount()) { console.error(`Stopped: this database already has ${c}. Restore only into an empty database.`); process.exit(2); }
  }
  const { EJSON } = mongoose.mongo.BSON;
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  const batch = new Map(); let total = 0; let meta = null;
  const flush = async (name) => { const docs = batch.get(name) || []; if (docs.length) { await db.collection(name).insertMany(docs, { ordered: false }); total += docs.length; } batch.set(name, []); };
  for await (const line of rl) {
    if (!line.trim()) continue;
    const { c, d } = JSON.parse(line);
    if (c === '_meta') { meta = d; continue; }
    const list = batch.get(c) || []; list.push(EJSON.deserialize(d, { relaxed: false })); batch.set(c, list);
    if (list.length >= 500) await flush(c);
  }
  for (const name of [...batch.keys()]) await flush(name);
  console.log(`Restored ${total} records${meta ? ` from the ${meta.kind} backup of ${meta.at}` : ''}.`);
  await mongoose.disconnect();
})().catch((err) => { console.error('Restore failed:', err.message); process.exit(1); });
