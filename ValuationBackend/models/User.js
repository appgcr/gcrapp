const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['SUPER_ADMIN', 'ENGINEER'], default: 'ENGINEER' },
  phone: { type: String, default: '9440164412' },
  licenseNo: { type: String, default: 'Indian Institution of Valuers F – 13622' },
  branch: { type: String, default: '1. State Bank of India (SBI) - RACPC Branch, Kadapa' },
  status: { type: String, default: 'Active' },
  createdAt: { type: String, default: () => new Date().toLocaleDateString('en-IN') },
  // WebAuthn Passkey Credentials
  credentials: [{
    credentialID: { type: Buffer, required: true },
    credentialPublicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true },
    transports: { type: [String], default: [] }
  }],
  // Challenge used during WebAuthn registration/authentication
  currentChallenge: { type: String }
});

module.exports = mongoose.model('User', userSchema);
