const mongoose = require('mongoose');

const valuationCaseVersionSchema = new mongoose.Schema({
  caseId: { type: String, required: true, index: true },
  version: { type: Number, required: true },
  snapshotData: { type: mongoose.Schema.Types.Mixed, required: true },
  submittedBy: { type: String, required: true },
  submittedByName: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  statusAtSubmission: { type: String, default: 'Reviewing' },
  
  // Admin Review Decision on this specific version
  adminDecision: { type: String, enum: ['Pending', 'Approved', 'Returned'], default: 'Pending' },
  decisionBy: { type: String, default: '' },
  decisionAt: { type: Date, default: null },
  decisionComment: { type: String, default: '' },
  
  // Valuation Summary snapshot for immediate audit
  valuationSummary: {
    landValue: { type: Number, default: 0 },
    replacementCost: { type: Number, default: 0 },
    depreciationAmount: { type: Number, default: 0 },
    netStructureValue: { type: Number, default: 0 },
    amenitiesValue: { type: Number, default: 0 },
    fairMarketValue: { type: Number, default: 0 },
    realizableValue: { type: Number, default: 0 },
    distressSaleValue: { type: Number, default: 0 }
  },

  // Document/Report generation metadata
  reportMetadata: {
    docxAvailable: { type: Boolean, default: false },
    pdfAvailable: { type: Boolean, default: false },
    lastGeneratedAt: { type: Date, default: null },
    docxSha256: { type: String, default: null },
    pdfSha256: { type: String, default: null },
    archiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportArchive', default: null }
  }
}, { timestamps: true });

// Compound unique index: guarantees each version number is unique per caseId
valuationCaseVersionSchema.index({ caseId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('ValuationCaseVersion', valuationCaseVersionSchema);
