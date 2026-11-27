const mongoose = require('mongoose');

// A branch office (e.g. Kadapa). Branch Admins and Engineers belong to exactly one branch;
// the Super Admin sees every branch.
const branchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },          // BR-001
  code: { type: String, required: true, unique: true },        // KDP — used in file numbers
  name: { type: String, required: true },                      // Kadapa
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  // The branch's own letterhead (picture) for every bank report. Empty = the Kadapa letterhead
  // that is already in the bank formats.
  letterhead: {
    dataUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: String, default: '' },
  },
  // The valuer who signs this branch's reports. Empty = the valuer already in the bank formats.
  valuer: {
    name: { type: String, default: '' },          // e.g. Gouru Neelakanta Reddy
    fatherName: { type: String, default: '' },    // used in the declaration ("son of …")
    qualification: { type: String, default: '' }, // e.g. B.Tech., MISTE.
    iivNo: { type: String, default: '' },         // Indian Institution of Valuers no., e.g. F – 13622
    cell: { type: String, default: '' },
    office: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  // Where this branch's invoices are paid: account, UPI and an optional QR picture (PhonePe / GPay merchant QR).
  // Empty = the firm's default payment details. Changed by this branch's admin or the Super Admin; every change is
  // kept in history and both are told.
  payment: {
    accountName: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNo: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    upi: { type: String, default: '' },
    qrDataUrl: { type: String, default: '' },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: String, default: '' },
    updatedByName: { type: String, default: '' },
    history: { type: [mongoose.Schema.Types.Mixed], default: [] }, // last 20 changes: { at, by, byName, changed: [...] }
  },
  // Super Admin switch: this branch's engineers may upload the filled office data sheet
  // (GOURU VALUATION – OFFICE) instead of the 5 documents + check + site steps
  sheetBypass: { type: Boolean, default: false },
  // How this branch's engineers may fill a New Case (the four cards). Set by the Super Admin.
  // null = not set yet: office sheet and audio then follow sheetBypass (older setting), documents on, Valocity off.
  fillModes: {
    docs: { type: Boolean, default: null },
    sheet: { type: Boolean, default: null },
    audio: { type: Boolean, default: null },
    valocity: { type: Boolean, default: null },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Branch', branchSchema);
