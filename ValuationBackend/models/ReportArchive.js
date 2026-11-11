const mongoose = require('mongoose');

const reportArchiveSchema = new mongoose.Schema({
  caseId: { type: String, required: true, index: true },
  version: { type: Number, required: true },

  // Storage reference paths (relative to backend uploads or persistent root)
  docxStoragePath: { type: String, required: true },
  pdfStoragePath: { type: String, required: true },
  manifestStoragePath: { type: String, default: null },

  // Cryptographic checksums (SHA-256) and Digital Signature
  docxSha256: { type: String, required: true },
  pdfSha256: { type: String, required: true },
  digitalSignature: { type: String, default: null },
  keyId: { type: String, default: 'gcr-2026-k1' },

  // File size metrics
  docxSizeBytes: { type: Number, default: 0 },
  pdfSizeBytes: { type: Number, default: 0 },

  // Template and Generation Metadata
  templateId: { type: String, default: 'HOUSE_APGB_NEW_FORMAT' },
  templateVersion: { type: String, default: '1.0.0' },
  generatedAt: { type: Date, default: Date.now },
  submittedBy: { type: String, default: '' },
  submittedByName: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankBranch: { type: String, default: '' },
  propertyType: { type: String, default: '' },

  // Approval / Lifecycle Status
  approvalStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Returned', 'Rejected', 'Archive_Unavailable'],
    default: 'Pending'
  },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  decisionComment: { type: String, default: null },

  // Immutable append-only audit trail
  auditTrail: [{
    action: {
      type: String,
      required: true,
      enum: ['ARCHIVED', 'DOWNLOADED', 'APPROVED', 'RETURNED', 'CHECKSUM_VERIFIED', 'INTEGRITY_FAILED']
    },
    actor: { type: String, default: 'SYSTEM' },
    role: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
  }]
}, {
  timestamps: true
});

// Enforce compound uniqueness: exactly one archive record per caseId + version
reportArchiveSchema.index({ caseId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('ReportArchive', reportArchiveSchema);
