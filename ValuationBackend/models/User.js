const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Password the admin issued (encrypted, see services/secretBox.js). Never selected by default.
  // Cleared when the engineer changes their own password.
  issuedPasswordEnc: { type: String, select: false },
  issuedPasswordAt: { type: Date },
  passwordChangedBySelfAt: { type: Date },
  name: { type: String, required: true },
  role: { type: String, enum: ['SUPER_ADMIN', 'ADMIN', 'ENGINEER', 'BANK'], default: 'ENGINEER' },
  // BANK = a bank employee who sends valuation requests to a GCR branch (branchId) and
  // follows them until the approved report is ready. Created by a GCR admin.
  bankName: { type: String, default: '' },      // official name from Settings → Banks
  bankBranch: { type: String, default: '' },    // the employee's own bank branch, e.g. "Kadapa Main"
  designation: { type: String, default: '' },   // e.g. Branch Manager, Loan Officer
  email: { type: String, default: '' },
  // Branch Admins and Engineers belong to exactly one branch (Branch.id); Super Admins to none
  branchId: { type: String, default: null, index: true },
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
  // Engineer's digital signature (PNG data URL), saved once in Settings and applied to reports
  savedSignature: { type: String, default: '' },
  savedSignatureAt: { type: Date },
  faceEnrolledAt: { type: Date },
  // Agreed (on first sign-in) that their location is shared with the office at all times
  locationConsentAt: { type: Date, default: null },
  locationConsentVersion: { type: String, default: '' },
  // Per-person alert switches { categoryKey: false } — missing = on (see services/notificationCategories.js)
  notificationPrefs: { type: Map, of: Boolean, default: {} },
  // First app-open time per day (last 30 days) — used to learn each person's usual start time
  activityLog: { type: [Date], default: [] },
  // Phone push addresses (FCM registration tokens), one per signed-in device
  pushTokens: [{
    token: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    updatedAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('User', userSchema);
