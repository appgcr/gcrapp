const mongoose = require('mongoose');

// A sign-in on a new device waiting for the Super Admin (services/loginApproval.js).
// The phone checks it with the pollKey it was given; only a hash of the key is stored.
const loginRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  role: { type: String, default: '' },
  branchId: { type: String, default: null },
  deviceId: { type: String, default: '' },
  device: { type: String, default: '' },
  ip: { type: String, default: '' },
  pollKeyHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied', 'used'], default: 'pending', index: true },
  createdAt: { type: Date, default: Date.now },
  decidedAt: { type: Date, default: null },
  decidedBy: { type: String, default: '' },
});

// Old requests clean themselves away after a day
loginRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 3600 });

module.exports = mongoose.model('LoginRequest', loginRequestSchema);
