const mongoose = require('mongoose');

const valuationCaseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  // Branch that owns the case, and its official file number (GCR/KDP/2026/11/0001)
  branchId: { type: String, default: null, index: true },
  // Requests sent by a bank employee (BANK login)
  source: { type: String, default: 'GCR' },            // 'BANK' when a bank employee raised it
  requestedBy: {
    id: { type: String, index: true }, name: String, phone: String, email: String,
    bankName: String, bankBranch: String, designation: String,
  },
  requestedAt: { type: Date },
  requestDetails: {                                    // what the bank asked for
    loanPurpose: String, loanAmount: String, propertyAddress: String, surveyNo: String,
    extent: String, contactPerson: String, contactPhone: String, notes: String, urgency: String,
  },
  fileNumber: { type: String, default: '', index: true },
  // Which bank's report format to use (set when the bank is chosen) — see services/reportFormats.js
  reportFormat: { bankKey: String, label: String, bankTemplate: Boolean },
  clientName: { type: String, required: true },
  clientFatherName: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankBranch: { type: String, default: '' },
  bankDistrict: { type: String, default: '' },
  bankStatus: { type: String, enum: ['Unassigned', 'Assigned'], default: 'Unassigned' },
  
  // New task assignment fields
  clientPhone: { type: String, default: '' },
  address: { type: String, default: '' },
  note: { type: String, default: '' },
  inspectionDate: { type: String, default: '' },
  inspectionTime: { type: String, default: '' },
  
  propertyDetails: {
    // Official Registration & Legal
    deedNo: String,
    deedYear: String,
    netExtent: String,
    surveyNo: String,
    plotNo: String,
    khathaNo: String,
    assessmentNo: String,
    doorNo: String,
    marketValueAmount: String,
    approvalPlanNo: String,
    approvalPlanDate: String,
    
    // Apartment / Builder specific
    builderName: String,
    managingPartner: String,
    flatNo: String,
    floorNo: String,

    // Additions & Cost Estimates (Dynamic Array)
    additionsWork: [{
      description: String,
      quantity: String,
      rate: Number,
      amount: Number
    }],

    boundariesDoc: { north: String, south: String, east: String, west: String },
    boundariesActual: { north: String, south: String, east: String, west: String },
    buildingAge: String,
    flooringType: String,
    structureType: String,
    roadWidth: String,
    propertyType: String, // e.g. Apartment, Independent House, Open Agriculture Land, Open Site
    roadType: String,
    plotType: String,
    siteValue: {
      plinthArea: String,
      floors: [{ id: String, label: String, value: String }]
    },
    deedDate: String,
    landRate: String,
    guidelineRate: String,
    // Bank-format details typed by the engineer/admin (ward, village, rates, extras…), keyed by
    // the template's field names — see services/reports/apgb.py
    report: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  locationData: { type: String, default: '' },
  
  status: { type: String, enum: ['Pending', 'Reviewing', 'Returned', 'Completed', 'Approved', 'Rejected'], default: 'Pending' },
  assignedEngineerId: { type: String, default: 'UNASSIGNED' },
  assignedEngineerName: { type: String, default: 'Unknown' },
  rejectionReason: { type: String, default: '' },
  returnedBy: { type: String, default: '' },
  returnedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  
  documents: { type: mongoose.Schema.Types.Mixed, default: {} },
  sitePhotos: [{ type: String }],
  // Content fingerprints of every uploaded document page and site photo (stops the same file being reused)
  documentHashes: { type: [String], default: [], index: true },
  
  signatureDataUrl: { type: String, default: '' },
  bankId: { type: String, default: null, index: true }, // Settings → Banks (a rename reaches every case)

  // Valuation Calculation Engine Results
  valuation: {
    landRate: { type: Number, default: 0 },
    landValue: { type: Number, default: 0 },
    netExtentSqYards: { type: Number, default: 0 },
    constructionRate: { type: Number, default: 0 },
    replacementCost: { type: Number, default: 0 },
    buildingAge: { type: Number, default: 0 },
    buildingLife: { type: Number, default: 60 },
    depreciationPercent: { type: Number, default: 0 },
    depreciationAmount: { type: Number, default: 0 },
    netStructureValue: { type: Number, default: 0 },
    amenitiesValue: { type: Number, default: 0 },
    fairMarketValue: { type: Number, default: 0 },
    realizableValue: { type: Number, default: 0 },
    distressSaleValue: { type: Number, default: 0 },
    insurableValue: { type: Number, default: 0 }
  },

  // Audit and Sync Fields
  reconciliationAudit: { type: mongoose.Schema.Types.Mixed, default: {} },
  canonicalMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  offlineSyncId: { type: String, default: '' },
  version: { type: Number, default: 1 },

  // Tracking fields
  trackingStatus: { type: String, enum: ['inactive', 'active'], default: 'inactive' },
  currentLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    lastUpdated: { type: Date, default: null }
  }
});

module.exports = mongoose.model('ValuationCase', valuationCaseSchema);
