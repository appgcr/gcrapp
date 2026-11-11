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
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Branch', branchSchema);
