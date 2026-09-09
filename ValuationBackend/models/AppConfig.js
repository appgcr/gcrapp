const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  banks: {
    type: [String],
    default: [
      "State Bank of India (SBI)",
      "Punjab National Bank (PNB)",
      "Bank of Baroda",
      "Canara Bank",
      "Union Bank of India",
      "Bank of India",
      "Indian Bank",
      "Central Bank of India",
      "Indian Overseas Bank",
      "UCO Bank",
      "Bank of Maharashtra",
      "Punjab & Sind Bank",
      "HDFC Bank",
      "ICICI Bank",
      "Axis Bank",
      "Kotak Mahindra Bank",
      "IndusInd Bank",
      "Yes Bank",
      "IDFC FIRST Bank",
      "Federal Bank",
      "Bandhan Bank",
      "LIC Housing Finance"
    ]
  },
  districts: {
    type: [String],
    default: ["Y.S.R", "Kadapa", "Anantapur", "Chittoor", "Kurnool", "Nellore", "Tirupati"]
  },
  propertyTypes: {
    type: [String],
    default: [
      "Apartment",
      "Independent House",
      "Open Agriculture Land",
      "Open Site",
      "Commercial Building",
      "Industrial Unit"
    ]
  },
  plotTypes: {
    type: [String],
    default: ["Corner plot", "Intermediary plot", "Road-facing plot"]
  },
  roadTypes: {
    type: [String],
    default: ["CC Road", "BT", "Metal", "WBM Road", "Mud / Gravel"]
  },
  structureTypes: {
    type: [String],
    default: ["Framed structure", "Load bearing", "Steel / Precast"]
  },
  flooringTypes: {
    type: [String],
    default: ["Granite", "Tiles", "Vitrified Tiles", "Marble", "Mosaic", "Cement Flooring"]
  },
  floorLabels: {
    type: [String],
    default: [
      'Ground Floor (GF)', 'First Floor (FF)', 'Second Floor (SF)',
      'Third Floor (TF)', 'Fourth Floor (4F)', 'Fifth Floor (5F)',
      'Sixth Floor (6F)', 'Seventh Floor (7F)', 'Eighth Floor (8F)',
      'Basement Level', 'Stilt Parking'
    ]
  },
  requiredDocs: {
    type: [{
      id: String,
      label: String,
      name: String,
      tier1: [String],
      tier2: [String]
    }],
    default: [
      {
        id: 'saleDeed',
        label: '1. Registered Document / Sale Deed',
        name: 'Registered Sale Deed',
        tier1: ['sale deed', 'registered document', 'schedule of property', 'sub-registrar', 'vendor and purchaser', 'consideration amount', 'stamp duty paid', 'registration fee', 'document no', 'deed no'],
        tier2: ['sale', 'deed', 'registration', 'property', 'vendor', 'purchaser', 'stamp', 'witness', 'schedule', 'boundary', 'extent', 'survey', 'pattadar', 'khata', 'transfer']
      },
      {
        id: 'buildingPlan',
        label: '2. Approved Building Plan',
        name: 'Approved Building Plan',
        tier1: ['building plan approval', 'municipal corporation', 'gram panchayat', 'planning permission', 'building permission', 'approved plan no', 'floor plan', 'architect certificate', 'occupancy certificate'],
        tier2: ['plan', 'approval', 'municipal', 'panchayat', 'engineer', 'architect', 'drawing', 'scale', 'plot', 'floor', 'elevation', 'setback', 'bays', 'site', 'structure']
      },
      {
        id: 'propertyTax',
        label: '3. Property Tax Assessment',
        name: 'Property Tax Receipt',
        tier1: ['property tax', 'tax receipt', 'assessment number', 'challan number', 'tax assessment', 'revenue receipt', 'municipal tax', 'house tax', 'ward number', 'door number'],
        tier2: ['tax', 'assessment', 'receipt', 'municipal', 'revenue', 'property', 'paid', 'amount', 'challan', 'ward', 'owner', 'due', 'penalty', 'demand', 'arrear']
      },
      {
        id: 'marketValue',
        label: '4. Market Value Document',
        name: 'Market Value / Guideline Rate Certificate',
        tier1: ['guideline value', 'market value', 'sub-registrar office', 'sro', 'ready reckoner', 'basic value', 'circle rate', 'registration department', 'ec certificate', 'encumbrance certificate'],
        tier2: ['market', 'value', 'guideline', 'rate', 'sq.yd', 'sq.ft', 'valuation', 'land', 'plot', 'per sq', 'locality', 'zone', 'area', 'registrar', 'certificate']
      },
      {
        id: 'layoutPlan',
        label: '5. Layout / Approval Plan',
        name: 'Layout / Approval Plan',
        tier1: ['layout approval', 'dtcp approval', 'hmda approval', 'crda approval', 'huda approval', 'plot layout', 'layout plan no', 'rera registration', 'tp scheme', 'development authority'],
        tier2: ['layout', 'plan', 'approval', 'survey', 'plot', 'boundaries', 'road', 'master', 'development', 'scheme', 'block', 'phase', 'sector', 'zone', 'authority']
      }
    ]
  },
  attendanceSettings: {
    fullDayHours: { type: Number, default: 7 },
    halfDayHours: { type: Number, default: 4 },
    maxDailyClockOuts: { type: Number, default: 3 }
  },
  valuerProfile: {
    name: { type: String, default: 'Approved Panel Valuer' },
    title: { type: String, default: 'Civil Engineering Consultant & Approved Panel Valuer' },
    address: { type: String, default: '' },
    licenseNo: { type: String, default: 'Indian Institution of Valuers' },
    organization: { type: String, default: 'Valuation Services' }
  }
}, { timestamps: true });

module.exports = mongoose.model('AppConfig', appConfigSchema);
