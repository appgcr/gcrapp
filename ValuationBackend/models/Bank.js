const mongoose = require('mongoose');

// A bank the valuer works for. Managed by the Super Admin (Settings → Banks).
// Every bank picker, case, report and valuation reads from here.
const percent = { type: Number, min: 0, max: 100, default: null };
const policy = { realizable: percent, distress: percent };

const bankSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },              // BANK-001
  name: { type: String, required: true, trim: true },              // Andhra Pradesh Grameena Bank
  shortName: { type: String, default: '', trim: true },            // APGB
  aliases: { type: [String], default: [] },                        // other spellings / old names
  branches: { type: [String], default: [] },                       // this bank's branches (ITI Road, 7 Roads…)
  // Where approved reports go: a default email, and per-branch email / WhatsApp number
  email: { type: String, default: '', trim: true },
  contacts: { type: [{ branch: String, email: String, phone: String }], default: [] },
  autoSend: { type: Boolean, default: true },                      // email the report when it is approved
  // Our fee for this bank's valuations (Rs, before GST), per property type
  fees: {
    house: { type: Number, default: null }, apartment: { type: Number, default: null }, openSite: { type: Number, default: null },
    agriculture: { type: Number, default: null }, industrial: { type: Number, default: null },
  },
  // Which report layout the bank uses: 'apgb' = the bank's own exact format (installed),
  // 'standard' = the general GCR report until that bank's format is supplied
  format: { type: String, default: 'standard' },
  // Realizable / distress value as % of fair market value, per property type
  policies: {
    house: policy,
    apartment: policy,
    openSite: policy,
    agriculture: policy,
    industrial: policy,
  },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bank', bankSchema);
