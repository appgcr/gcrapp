const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const ImageModule = require("docxtemplater-image-module-free");
const fs = require("fs");
const path = require("path");

// GET /api/cases
router.get('/', async (req, res) => {
  try {
    const cases = await ValuationCase.find().sort({ createdAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id
router.get('/:id', async (req, res) => {
  try {
    const caseItem = await ValuationCase.findOne({ id: req.params.id });
    if (!caseItem) return res.status(404).json({ error: 'Case not found' });
    res.json(caseItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cases
router.post('/', async (req, res) => {
  try {
    const today = new Date();
    const prefix = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, '0');
    
    const count = await ValuationCase.countDocuments({ id: new RegExp(`^${prefix}`) });
    const nextSeq = (count + 1).toString().padStart(2, '0');
    const newId = prefix + nextSeq;

    const caseData = { ...req.body, id: newId };
    
    const newCase = new ValuationCase(caseData);
    const saved = await newCase.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /api/cases ERROR:", err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/cases/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await ValuationCase.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cases/:id/extract
router.post('/:id/extract', async (req, res) => {
  try {
    // Simulate AI OCR extraction engine populating data from uploaded Telugu/English Registration Deed
    const updated = await ValuationCase.findOneAndUpdate(
      { id: req.params.id },
      {
        borrowerName: "K. Jaya Narasimhulu, S/o K. Suryanarayana",
        surveyNo: "740/20, 740/21",
        doorNo: "12-67, Peddachowtapalle, B.C. Colony",
        landArea: "3200 Sq. Ft. (Verified by OCR)",
        builtupArea: "4500 Sq. Ft. (Stilt+GF+FF+SF)",
        marketRate: "Rs 4,500 / Sq. Ft.",
        taxAssessmentNo: "1084920192",
        taxAmount: "Rs 14,500/- (Paid Receipt Verified)",
        planApprovalNo: "KMC/BLD/2025/8891",
        planApprovalDate: "12-04-2024",
        estimationValue: "Rs 1,50,00,000/-"
      },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id/report
router.get('/:id/report', async (req, res) => {
  try {
    const caseItem = await ValuationCase.findOne({ id: req.params.id });
    if (!caseItem) return res.status(404).json({ error: 'Case not found' });

    const templatePath = path.resolve(__dirname, '../template.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ error: 'Template not found' });
    }
    
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    const opts = {
      centered: false,
      getImage: function (tagValue, tagName) {
        if (!tagValue) return Buffer.from('');
        const base64Data = tagValue.replace(/^data:image\/\w+;base64,/, '');
        return Buffer.from(base64Data, 'base64');
      },
      getSize: function (img, tagValue, tagName) {
        return [500, 350]; // standard size for inserted images
      }
    };
    
    const imageModule = new ImageModule(opts);

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });

    const p = caseItem.propertyDetails || {};
    
    const data = {
      clientName: caseItem.clientName || 'Unknown Client',
      accountNo: '111 461 837 79',
      estimationValue: p.siteValue?.totalValue || 'Rs 2,02,50,000/-',
      surveyNo: '740/20, 740/21',
      doorNo: p.boundariesActual?.doorNo || '42/337-7-2-2',
      locality: caseItem.locationData || 'Bhagya Nagar Colony',
      wardNo: '42',
      marketRate: 'Rs 4,500 / Sq. Ft.',
      taxAssessmentNo: '1084920192',
      taxAmount: 'Rs 14,500/-',
      planApprovalNo: 'KMC/BLD/2025/8891',
      gpsCoordinates: caseItem.locationData || '14°28\'04.4"N 78°50\'13.2"E',
      siteImage1: '', siteImage2: '',
      doc1: '', doc2: '', doc3: '', doc4: '', doc5: ''
    };
    
    if (caseItem.sitePhotos && caseItem.sitePhotos.length > 0) {
      data.siteImage1 = caseItem.sitePhotos[0] || '';
      data.siteImage2 = caseItem.sitePhotos[1] || '';
    }

    const mockDocsDir = path.resolve(__dirname, '../../ValuationApp/public/mock_docs');
    const mockFiles = ['sale_deed.png', 'building_plan.png', 'property_tax.png', 'market_value.png', 'layout_plan.png'];
    const docKeys = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'];
    
    mockFiles.forEach((f, idx) => {
      const p = path.join(mockDocsDir, f);
      if (fs.existsSync(p)) {
        const b64 = fs.readFileSync(p).toString('base64');
        data[docKeys[idx]] = 'data:image/png;base64,' + b64;
      }
    });

    doc.render(data);

    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    
    res.setHeader('Content-Disposition', `attachment; filename="SBI_Valuation_Report_${caseItem.id}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buf);

  } catch (error) {
    console.error("Report Generation Error:", error);
    res.status(500).json({ error: error.message });
  }
});
// POST /api/cases/:id/track
router.post('/:id/track', async (req, res) => {
  try {
    const { lat, lng, status } = req.body;
    const updateData = {
      'currentLocation.lastUpdated': new Date()
    };
    
    if (lat !== undefined && lng !== undefined) {
      updateData['currentLocation.lat'] = lat;
      updateData['currentLocation.lng'] = lng;
    }
    
    if (status !== undefined) {
      updateData.trackingStatus = status;
    }

    const updated = await ValuationCase.findOneAndUpdate(
      { id: req.params.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
