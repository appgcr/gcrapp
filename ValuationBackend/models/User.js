const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['SUPER_ADMIN', 'ENGINEER'], default: 'ENGINEER' },
  phone: { type: String, default: '' },
  licenseNo: { type: String, default: '' },
  branch: { type: String, default: '' },
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
  currentChallenge: { type: String },
  // Biometric Facial Recognition Profile
  faceDescriptor: { type: [Number], default: [] },
  faceEnrolled: { type: Boolean, default: false },
  facePhotoUrl: { type: String, default: '' },
  faceEnrolledAt: { type: Date }
});

module.exports = mongoose.model('User', userSchema);
