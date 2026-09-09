const mongoose = require('mongoose');

const valuationCaseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  clientName: { type: String, required: true },
  clientFatherName: { type: String, default: '' },
  bankName: { type: String, required: true },
  bankBranch: { type: String, default: '' },
  bankDistrict: { type: String, default: '' },
  
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
    }
  },

  locationData: { type: String, default: '' },
  
  status: { type: String, enum: ['Pending', 'Reviewing', 'Approved', 'Rejected'], default: 'Pending' },
  assignedEngineerId: { type: String, default: 'UNASSIGNED' },
  assignedEngineerName: { type: String, default: 'Unknown' },
  rejectionReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  
  documents: { type: mongoose.Schema.Types.Mixed, default: {} },
  sitePhotos: [{ type: String }],
  
  signatureDataUrl: { type: String, default: '' },

  // Tracking fields
  trackingStatus: { type: String, enum: ['inactive', 'active'], default: 'inactive' },
  currentLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    lastUpdated: { type: Date, default: null }
  }
});

module.exports = mongoose.model('ValuationCase', valuationCaseSchema);
