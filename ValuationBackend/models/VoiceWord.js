const mongoose = require('mongoose');

// A spelling the voice fill learned from an engineer's correction: Gouru AI wrote `heard`, the engineer
// changed it to `fixed` (a name, a place, a branch…). Given to Gouru AI next time so it writes it right.
const voiceWordSchema = new mongoose.Schema({
  branchId: { type: String, default: null, index: true },
  field: { type: String, default: '' },       // where it was corrected (ownerName, address, boundaries.west…)
  heard: { type: String, required: true },    // lower-case, as Gouru AI wrote it
  fixed: { type: String, required: true },    // as the engineer wrote it
  count: { type: Number, default: 1 },
  lastAt: { type: Date, default: Date.now },
});
voiceWordSchema.index({ branchId: 1, heard: 1, fixed: 1 }, { unique: true });

module.exports = mongoose.model('VoiceWord', voiceWordSchema);
