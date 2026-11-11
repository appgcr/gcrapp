const mongoose = require('mongoose');

// Admin-editable reminder settings (single document, key: 'reminders').
// Times are "HH:MM" in India Standard Time (Asia/Kolkata).
const reminderSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'reminders' },
  enabled: { type: Boolean, default: true },            // master switch
  skipSundays: { type: Boolean, default: true },

  morningDigest: {
    enabled: { type: Boolean, default: true },
    time: { type: String, default: '08:30' }        // fallback time
  },
  engineerDigest: {
    enabled: { type: Boolean, default: true },
    time: { type: String, default: '08:45' }        // fallback time
  },
  // Send morning summaries at each person's usual start time (learned), else the fallback times
  personalTiming: { type: Boolean, default: true },
  // Non-urgent phone pushes are held during quiet hours and delivered (bundled) at quietHours.end
  quietHours: {
    enabled: { type: Boolean, default: true },
    start: { type: String, default: '19:00' },
    end: { type: String, default: '09:00' }
  },
  checkIn: {
    enabled: { type: Boolean, default: true },
    time: { type: String, default: '09:30' }
  },
  inspection: {
    enabled: { type: Boolean, default: true },
    minutesBefore: { type: Number, default: 60, min: 15, max: 240 }
  },
  overdue: {
    enabled: { type: Boolean, default: true },
    unassignedHours: { type: Number, default: 24, min: 1, max: 168 },
    reviewHours: { type: Number, default: 48, min: 1, max: 336 }
  },
  checkOut: {
    enabled: { type: Boolean, default: true },
    time: { type: String, default: '19:00' }
  },

  updatedBy: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ReminderSettings', reminderSettingsSchema);
