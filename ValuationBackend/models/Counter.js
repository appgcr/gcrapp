const mongoose = require('mongoose');

// Atomic running numbers, e.g. key "file:KDP:2026-11" → 1, 2, 3 …
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
