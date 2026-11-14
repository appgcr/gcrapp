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
