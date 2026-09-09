const express = require('express');
const router = express.Router();
const ValuationCase = require('../models/ValuationCase');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');

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
    console.error('POST /api/cases ERROR:', err);
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
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/cases/:id/report  — generates .docx from scratch (no template file needed)
router.get('/:id/report', async (req, res) => {
  try {
    const caseItem = await ValuationCase.findOne({ id: req.params.id });
    if (!caseItem) return res.status(404).json({ error: 'Case not found' });

    // Fetch dynamic system config and assigned engineer details
    const config = await AppConfig.findOne({ key: 'global' });
    let engineer = null;
    if (caseItem.assignedEngineerId) {
      engineer = await User.findById(caseItem.assignedEngineerId);
    }
    if (!engineer && caseItem.assignedEngineerName) {
      engineer = await User.findOne({ username: caseItem.assignedEngineerName });
    }

    const {
      Document, Packer, Paragraph, Table, TableRow, TableCell,
      TextRun, WidthType, AlignmentType, BorderStyle,
      ImageRun, ShadingType, VerticalAlign
    } = require('docx');

    const p = caseItem.propertyDetails || {};

    // ── helpers ──────────────────────────────────────────────────────────
    const val = (v) => (v != null && v !== '' ? String(v) : 'N/A');

    const bold = (text, size = 20, color = '000000') =>
      new TextRun({ text, bold: true, size, color, font: 'Times New Roman' });

    const normal = (text, size = 20, color = '000000') =>
      new TextRun({ text, size, color, font: 'Times New Roman' });

    const para = (children, alignment = AlignmentType.LEFT, spacingAfter = 100) =>
      new Paragraph({
        children: Array.isArray(children) ? children : [children],
        alignment,
        spacing: { after: spacingAfter }
      });

    const heading = (text) =>
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 24, color: '003087', font: 'Times New Roman' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '003087' } }
      });

    const cellShaded = (text, isHeader = false) =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({
            text: val(text),
            bold: isHeader,
            size: 18,
            font: 'Times New Roman',
            color: isHeader ? 'FFFFFF' : '1a1a1a'
          })],
          alignment: AlignmentType.CENTER
        })],
        shading: isHeader
          ? { fill: '003087', type: ShadingType.CLEAR, color: '003087' }
          : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 100, right: 100 }
      });

    const cellPlain = (text, widthPct, isBold = false, bg = 'FFFFFF') =>
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: val(text), bold: isBold, size: 18, font: 'Times New Roman' })],
          alignment: AlignmentType.LEFT
        })],
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        shading: bg !== 'FFFFFF' ? { fill: bg, type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER
      });

    const twoColRow = (label, value, labelBg = 'EEF2FF') =>
      new TableRow({
        children: [
          cellPlain(label, 35, true, labelBg),
          cellPlain(value, 65, false, 'FFFFFF')
        ]
      });

    // ── totals ────────────────────────────────────────────────────────────
    const additions = p.additionsWork || [];
    const additionsTotal = additions.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const floors = p.siteValue?.floors || [];
    const buildingValue = floors.reduce((sum, f) => sum + (parseFloat(f.value) || 0), 0);
    const plinthArea = p.siteValue?.plinthArea || 'N/A';
    const grandTotal = buildingValue + additionsTotal;

    // ── site photo buffers ────────────────────────────────────────────────
    const photoBuffers = [];
    for (const photo of (caseItem.sitePhotos || []).slice(0, 4)) {
      if (photo && photo.startsWith('data:image')) {
        try {
          const b64 = photo.replace(/^data:image\/\w+;base64,/, '');
          photoBuffers.push(Buffer.from(b64, 'base64'));
        } catch (_) { /* skip */ }
      }
    }

    // ── document children ─────────────────────────────────────────────────
    const children = [];

    // Header
    const bankHeader = (caseItem.bankName || 'BANK VALUATION REPORT').toUpperCase();
    const branchSubheader = [
      caseItem.bankBranch ? `${caseItem.bankBranch} Branch` : '',
      caseItem.bankDistrict ? `${caseItem.bankDistrict} Dist.` : '',
      config?.valuerProfile?.state || ''
    ].filter(Boolean).join(', ');

    children.push(para([bold(bankHeader, 28, '003087')], AlignmentType.CENTER, 0));
    if (branchSubheader) {
      children.push(para([normal(branchSubheader, 20, '003087')], AlignmentType.CENTER, 0));
    }
    children.push(para([bold('VALUATION REPORT OF IMMOVABLE PROPERTY', 22, '1a1a1a')], AlignmentType.CENTER, 200));
    children.push(new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '003087' } },
      spacing: { after: 160 }
    }));

    // 1. Reference Details
    children.push(heading('1. REFERENCE DETAILS'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Case / Account No.', val(caseItem.id)),
        twoColRow('Date of Valuation', new Date(caseItem.createdAt).toLocaleDateString('en-IN')),
        twoColRow('Bank Name', val(caseItem.bankName)),
        twoColRow('Bank Branch', val(caseItem.bankBranch)),
        twoColRow('Bank District', val(caseItem.bankDistrict)),
        twoColRow('Inspection Date', val(caseItem.inspectionDate)),
        twoColRow('Inspection Time', val(caseItem.inspectionTime))
      ]
    }));

    // 2. Client Details
    children.push(heading('2. CLIENT DETAILS'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Client Name', val(caseItem.clientName)),
        twoColRow("Father's / Husband's Name", val(caseItem.clientFatherName)),
        twoColRow('Contact Phone', val(caseItem.clientPhone)),
        twoColRow('Property Address', val(caseItem.address || caseItem.locationData)),
        twoColRow('Additional Notes', val(caseItem.note))
      ]
    }));

    // 3. Property Details
    children.push(heading('3. PROPERTY DETAILS'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Property Type', val(p.propertyType)),
        twoColRow('Survey No.', val(p.surveyNo)),
        twoColRow('Plot No.', val(p.plotNo)),
        twoColRow('Khatha No.', val(p.khathaNo)),
        twoColRow('Tax Assessment No.', val(p.assessmentNo)),
        twoColRow('Door No.', val(p.doorNo)),
        twoColRow('Net Extent', val(p.netExtent)),
        twoColRow('Deed No.', val(p.deedNo)),
        twoColRow('Deed Year', val(p.deedYear)),
        twoColRow('Approval Plan No.', val(p.approvalPlanNo)),
        twoColRow('Approval Plan Date', val(p.approvalPlanDate)),
        twoColRow('Building Age', val(p.buildingAge)),
        twoColRow('Structure Type', val(p.structureType)),
        twoColRow('Flooring Type', val(p.flooringType)),
        twoColRow('Road Width', val(p.roadWidth)),
        twoColRow('Road Type', val(p.roadType)),
        twoColRow('Plot Type', val(p.plotType)),
        twoColRow('Builder Name', val(p.builderName)),
        twoColRow('Flat No.', val(p.flatNo)),
        twoColRow('Floor No.', val(p.floorNo))
      ]
    }));

    // 4. Boundaries
    if (p.boundariesDoc || p.boundariesActual) {
      const bd = p.boundariesDoc || {};
      const ba = p.boundariesActual || {};
      children.push(heading('4. BOUNDARIES'));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cellShaded('Direction', true), cellShaded('As Per Document', true), cellShaded('Actual', true)] }),
          new TableRow({ children: [cellShaded('North'), cellPlain(bd.north, 40), cellPlain(ba.north, 40)] }),
          new TableRow({ children: [cellShaded('South'), cellPlain(bd.south, 40), cellPlain(ba.south, 40)] }),
          new TableRow({ children: [cellShaded('East'), cellPlain(bd.east, 40), cellPlain(ba.east, 40)] }),
          new TableRow({ children: [cellShaded('West'), cellPlain(bd.west, 40), cellPlain(ba.west, 40)] })
        ]
      }));
    }

    // 5. Building Valuation
    if (floors.length > 0) {
      children.push(heading('5. BUILDING VALUATION (FLOOR-WISE)'));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cellShaded('Floor', true), cellShaded('Built-up Area (sq.ft)', true), cellShaded('Value (Rs.)', true)] }),
          ...floors.map(f => new TableRow({
            children: [
              cellPlain(f.label || f.id, 30),
              cellPlain(plinthArea, 35),
              cellPlain(f.value ? `Rs. ${Number(f.value).toLocaleString('en-IN')}` : 'N/A', 35)
            ]
          })),
          new TableRow({
            children: [
              cellPlain('TOTAL', 30, true, 'EEF2FF'),
              cellPlain('', 35, false, 'EEF2FF'),
              cellPlain(`Rs. ${buildingValue.toLocaleString('en-IN')}`, 35, true, 'EEF2FF')
            ]
          })
        ]
      }));
    }

    // 6. Additions & Extra Works
    if (additions.length > 0) {
      children.push(heading('6. ADDITIONS & EXTRA WORKS'));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              cellShaded('#', true), cellShaded('Description', true), cellShaded('Qty', true),
              cellShaded('Rate (Rs.)', true), cellShaded('Amount (Rs.)', true)
            ]
          }),
          ...additions.map((a, i) => new TableRow({
            children: [
              cellPlain(String(i + 1), 8),
              cellPlain(a.description, 40),
              cellPlain(a.quantity, 12),
              cellPlain(a.rate ? `Rs. ${Number(a.rate).toLocaleString('en-IN')}` : 'N/A', 20),
              cellPlain(a.amount ? `Rs. ${Number(a.amount).toLocaleString('en-IN')}` : 'N/A', 20)
            ]
          })),
          new TableRow({
            children: [
              cellPlain('', 8, false, 'EEF2FF'),
              cellPlain('TOTAL', 40, true, 'EEF2FF'),
              cellPlain('', 12, false, 'EEF2FF'),
              cellPlain('', 20, false, 'EEF2FF'),
              cellPlain(`Rs. ${additionsTotal.toLocaleString('en-IN')}`, 20, true, 'EEF2FF')
            ]
          })
        ]
      }));
    }

    // 7. Valuation Summary
    children.push(heading('7. VALUATION SUMMARY'));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        twoColRow('Building Value', `Rs. ${buildingValue.toLocaleString('en-IN')}`),
        twoColRow('Additions / Extra Works', `Rs. ${additionsTotal.toLocaleString('en-IN')}`),
        new TableRow({
          children: [
            cellPlain('TOTAL ESTIMATED VALUE', 35, true, 'D4EDDA'),
            cellPlain(`Rs. ${grandTotal.toLocaleString('en-IN')}`, 65, true, 'D4EDDA')
          ]
        })
      ]
    }));

    // 8. Site Photographs
    if (photoBuffers.length > 0) {
      children.push(heading('8. SITE PHOTOGRAPHS'));
      for (const buf of photoBuffers) {
        try {
          children.push(new Paragraph({
            children: [new ImageRun({ data: buf, transformation: { width: 400, height: 280 }, type: 'jpg' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 }
          }));
        } catch (_) { /* skip bad images */ }
      }
    }

    // 9. Valuer's Declaration
    const bankNorms = caseItem.bankName ? `${caseItem.bankName} panel norms` : 'bank panel norms';
    const valuerOrg = config?.valuerProfile?.organization || 'the Indian Institution of Valuers';
    const engineerName = caseItem.assignedEngineerName || engineer?.name || engineer?.username || config?.valuerProfile?.name || 'Authorized Valuer';
    const engineerLicense = engineer?.licenseNo || config?.valuerProfile?.licenseNo || 'Approved Bank Valuer';
    const reportPlace = [caseItem.bankDistrict, config?.valuerProfile?.state].filter(Boolean).join(', ') || config?.valuerProfile?.district || 'Registered Office';

    children.push(heading("9. VALUER'S DECLARATION"));
    children.push(para(
      [normal(`I hereby certify that I have inspected the above property and that the valuation has been made to the best of my knowledge and belief, in accordance with the guidelines laid down by ${valuerOrg} and ${bankNorms}.`)],
      AlignmentType.JUSTIFY, 240
    ));
    children.push(new Paragraph({ children: [], spacing: { after: 400 } }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                para([bold('Signature:', 18)]),
                para([normal('_________________________', 20)], AlignmentType.LEFT, 0),
                para([bold('Name:', 18)]),
                para([normal(val(engineerName), 18)], AlignmentType.LEFT, 0),
                para([bold('License No.:', 18)]),
                para([normal(val(engineerLicense), 18)], AlignmentType.LEFT, 0)
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
              }
            }),
            new TableCell({
              children: [
                para([bold('Date:', 18)]),
                para([normal(new Date().toLocaleDateString('en-IN'), 18)], AlignmentType.LEFT, 0),
                para([bold('Place:', 18)]),
                para([normal(val(reportPlace), 18)], AlignmentType.LEFT, 0)
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
              }
            })
          ]
        })
      ]
    }));

    // ── pack & send ───────────────────────────────────────────────────────
    const doc = new Document({
      sections: [{
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } }
        },
        children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const safeBankName = (caseItem.bankName || 'Valuation').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeBankName}_Valuation_Report_${caseItem.id}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);

  } catch (error) {
    console.error('Report Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/cases/:id/track
router.post('/:id/track', async (req, res) => {
  try {
    const { lat, lng, status } = req.body;
    const updateData = { 'currentLocation.lastUpdated': new Date() };

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
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
