const mongoose = require('mongoose');

// Latest known position of each engineer / branch admin (one document per person).
// Updated around the clock by the phone app; the Super Admin's map reads it.
const liveLocationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  role: { type: String, default: '' },
  branchId: { type: String, default: null, index: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  accuracy: { type: Number, default: null },
  at: { type: Date, default: null },          // time of the last position
  lastSeenAt: { type: Date, default: null },  // last time the phone reported anything
  off: { type: Boolean, default: false },     // location switched off / permission removed
  offSince: { type: Date, default: null },
  offAlertedAt: { type: Date, default: null },
  silentAlertedAt: { type: Date, default: null }, // "stopped reporting" alert already sent for this gap
  platform: { type: String, default: '' },
});

module.exports = mongoose.model('LiveLocation', liveLocationSchema);
