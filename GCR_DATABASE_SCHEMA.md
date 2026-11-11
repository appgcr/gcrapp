# GCR — MASTER DATABASE SCHEMA & DATA DICTIONARY
**Document ID:** `GCR_DATABASE_SCHEMA.md`  
**Date:** November 4, 2026  
**Role:** Senior Database Architect, MongoDB Reliability Specialist, and Security Auditor  
**Database Engine:** MongoDB 7.0+ / MongoDB Atlas with Mongoose 8.5 ODM  

---

## 1. Overview of Collections

The GCR valuation ecosystem persists data across 7 primary operational collections:

1. `valuationcases` — Authoritative records for valuation assignments and inspection states.
2. `valuationcaseversions` — Version-specific historical snapshots of property data and calculations.
3. `reportarchives` — Cryptographic archival records, checksums, and audit trails.
4. `users` — User credentials, roles, and administrative statuses.
5. `attendances` — Geolocation-tagged field engineer attendance logs.
6. `notifications` — Operational alerts, case assignments, and feedback messages.
7. `chatmessages` — Real-time case-specific collaboration and support messages.

---

## 2. Collection Schemas & Data Dictionaries

### 2.1 Collection: `valuationcases`

Stores the primary case entity, tracking progress through the banking inspection workflow.

```javascript
{
  caseId: { type: String, required: true, unique: true, index: true },
  applicantName: { type: String, required: true, index: true },
  propertyLocation: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  assignedEngineerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedEngineerName: { type: String },
  bankName: { type: String, default: null, index: true }, // Optional at creation
  bankBranch: { type: String, default: null },
  propertyType: { 
    type: String, 
    enum: ['INDEPENDENT_HOUSE', 'APARTMENT', 'OPEN_SITE', 'AGRICULTURAL_LAND', 'COMMERCIAL', 'INDUSTRIAL'],
    default: 'INDEPENDENT_HOUSE'
  },
  status: {
    type: String,
    enum: ['Draft', 'Assigned', 'In Progress', 'Completed (Under Review)', 'Approved', 'Returned for Corrections'],
    default: 'Assigned',
    index: true
  },
  currentVersion: { type: Number, default: 1 },
  legalDocuments: [{
    docType: { type: String },
    fileUrl: { type: String },
    filename: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    extractedData: { type: mongoose.Schema.Types.Mixed }
  }],
  sitePhotos: [{
    photoType: { type: String },
    fileUrl: { type: String },
    caption: { type: String },
    geotag: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number }
    },
    capturedAt: { type: Date, default: Date.now }
  }],
  inspectionData: { type: mongoose.Schema.Types.Mixed },
  valuationData: {
    landRate: { type: Number },
    landExtent: { type: Number },
    landValue: { type: Number },
    plinthArea: { type: Number },
    constructionRate: { type: Number },
    replacementCost: { type: Number },
    buildingAge: { type: Number },
    depreciationRate: { type: Number },
    depreciationAmount: { type: Number },
    netBuildingValue: { type: Number },
    extraAmenitiesValue: { type: Number },
    fairMarketValue: { type: Number },
    realizableValue: { type: Number },
    distressValue: { type: Number },
    insurableValue: { type: Number },
    calculatedAt: { type: Date }
  },
  feedbackRemarks: [{
    comment: { type: String },
    returnedBy: { type: String },
    returnedAt: { type: Date, default: Date.now }
  }],
  digitalSignature: { type: String },
  signedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}
```

**Indexes:**
- `{ caseId: 1 }` (Unique)
- `{ assignedEngineerId: 1, status: 1 }` (Compound query optimization)
- `{ status: 1, createdAt: -1 }` (Admin monitoring query)

---

### 2.2 Collection: `reportarchives`

Cryptographic record of permanently preserved DOCX and PDF valuation reports.

```javascript
{
  caseId: { type: String, required: true, index: true },
  version: { type: Number, required: true },
  keyId: { type: String, required: true, default: 'gcr-2026-k1', index: true },
  docxFilename: { type: String, required: true },
  docxSha256: { type: String, required: true },
  docxSizeBytes: { type: Number, required: true },
  docxStoragePath: { type: String, required: true },
  pdfFilename: { type: String, required: true },
  pdfSha256: { type: String, required: true },
  pdfSizeBytes: { type: Number, required: true },
  pdfStoragePath: { type: String, required: true },
  manifestStoragePath: { type: String, required: true },
  digitalSignature: { type: String, required: true },
  signatureAlgorithm: { type: String, default: 'HMAC-SHA256' },
  approvalStatus: { type: String, enum: ['Approved', 'Pending', 'Returned'], default: 'Pending' },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  templateId: { type: String, required: true },
  templateVersion: { type: String, default: '1.0' },
  auditTrail: [{
    event: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    performedBy: { type: String, default: 'system' },
    details: { type: mongoose.Schema.Types.Mixed }
  }],
  createdAt: { type: Date, default: Date.now, index: true }
}
```

**Indexes:**
- `{ caseId: 1, version: 1 }` (Unique compound index preventing duplicate archives)
- `{ keyId: 1 }` (Keyring auditing)

---

### 2.3 Collection: `users`

Staff identities, roles, and authentication records.

```javascript
{
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true }, // Salted bcrypt hash
  name: { type: String, required: true },
  role: { type: String, enum: ['SUPER_ADMIN', 'ENGINEER', 'STAFF'], default: 'ENGINEER', index: true },
  mobile: { type: String },
  status: { type: String, enum: ['Active', 'Suspended'], default: 'Active' },
  biometricEnrolled: { type: Boolean, default: false },
  faceEmbedding: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
}
```

---

### 2.4 Collection: `attendances`

Authoritative GPS and biometric attendance records.

```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  engineerName: { type: String, required: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  type: { type: String, enum: ['CLOCK_IN', 'CLOCK_OUT'], required: true },
  timestamp: { type: Date, default: Date.now },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number },
  verificationMethod: { type: String, enum: ['FACE_BIOMETRIC', 'DEVICE_CREDENTIAL', 'GPS_ONLY'] },
  selfieUrl: { type: String }
}
```

**Indexes:**
- `{ userId: 1, date: 1, type: 1 }` (Unique compound index preventing duplicate clock-ins on same day)

---

## 3. Data Integrity & Concurrency Rules

1. **Compound Uniqueness:** Both `reportarchives` (`caseId_1_version_1`) and `attendances` (`userId_1_date_1_type_1`) employ MongoDB compound unique indexes to guarantee concurrency safety against duplicate submissions.
2. **Immutable Versioning:** `valuationcaseversions` records are write-once, read-many. Once written, versions are never updated or truncated.
3. **No Soft Overwrite:** Overwrite attempts on approved records in `ReportArchive` are trapped at the database level and rejected with `ARCHIVE_ALREADY_EXISTS`.
