const mongoose = require('mongoose');

// One row per reminder actually sent. The unique `key` (e.g. "checkin:ENG-001:2026-11-09")
// is claimed BEFORE sending, so a reminder goes out once even after restarts or with
// several server instances running.
const reminderLogSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  rule: { type: String, required: true },
  sentTo: { type: String, default: '' },
  sentAt: { type: Date, default: Date.now }
});

// Old log rows are removed automatically after 45 days
reminderLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 45 * 24 * 3600 });

module.exports = mongoose.model('ReminderLog', reminderLogSchema);
