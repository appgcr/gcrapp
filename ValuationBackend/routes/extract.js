const express = require('express');
const router = express.Router();
const Tesseract = require('tesseract.js');
const ValuationCase = require('../models/ValuationCase');

// POST /api/extract
// Accepts a base64 image and expectedDeedNo in req.body
router.post('/', async (req, res) => {
  try {
    const { image, expectedDeedNo } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided for OCR.' });
    }

    // 1. DUPLICATE DB CHECK
    if (expectedDeedNo) {
      // Find if this deed number was already used in a case
      // e.g. case.propertyDetails.deedNo
      const existingCase = await ValuationCase.findOne({
        "propertyDetails.deedNo": expectedDeedNo
      });

      if (existingCase) {
        const staffName = existingCase.assignedEngineerName || 'a staff member';
        const date = new Date(existingCase.createdAt).toLocaleDateString();
        return res.status(409).json({
          error: `🚨 FRAUD ALERT: This Document Number (${expectedDeedNo}) was already processed by ${staffName} on ${date}. Upload rejected.`
        });
      }
    }

    // Run Tesseract OCR on the image
    const result = await Tesseract.recognize(
      image,
      'eng',
      { logger: m => console.log(m) } // Optional: logs progress in backend terminal
    );

    const text = result.data.text;
    const confidence = result.data.confidence;

    // VERY IMPORTANT: Quality Check (as requested by user)
    // If confidence is very low OR extracted text is extremely short, it's likely a blurry or blank photo.
    if (confidence < 40 || text.trim().length < 20) {
      return res.status(422).json({ 
        error: 'Image quality is too low. Please upload a clear, flat, and well-lit scan of the document.',
        confidence: confidence
      });
    }

    // 2. DOCUMENT NUMBER VERIFICATION (IDEA #1)
    if (expectedDeedNo) {
      // Clean up the text and expected number to ignore spaces/slashes
      const cleanText = text.replace(/[\s\/-]/g, '').toLowerCase();
      const cleanExpected = expectedDeedNo.replace(/[\s\/-]/g, '').toLowerCase();

      if (!cleanText.includes(cleanExpected)) {
        return res.status(422).json({
          error: `🚨 SECURITY ALERT: The Document Number [${expectedDeedNo}] was not found in the uploaded image. This document is rejected as a potential fake.`
        });
      }
    }

    // Basic Regex Parsing
    // In a production app, you would have very complex Regex. Here we do simple matching for demonstration.
    
    // Find Survey Number (e.g., "Survey No: 123/A" or "Sy.No. 45")
    const surveyNoMatch = text.match(/(?:Survey\s*No|Sy\.?No\.?|S\.?No\.?)\s*[:.-]?\s*([0-9A-Za-z/,\s]+)/i);
    const surveyNo = surveyNoMatch ? surveyNoMatch[1].trim() : "To be verified";

    // Find Area / Extent (e.g., "Extent: 300 Sq.Yards" or "Area: 1500 Sq.Ft.")
    const areaMatch = text.match(/(?:Extent|Area|Measuring)\s*[:.-]?\s*([0-9.,]+\s*(?:Sq\.?\s*Yards?|Sq\.?\s*Meters?|Sq\.?\s*Ft\.?|Acres?|Cents?))/i);
    const area = areaMatch ? areaMatch[1].trim() : "To be verified";

    // Find Door No / H.No
    const doorNoMatch = text.match(/(?:Door\s*No|D\.?No\.?|House\s*No|H\.?No\.?)\s*[:.-]?\s*([0-9A-Za-z/-]+)/i);
    const doorNo = doorNoMatch ? doorNoMatch[1].trim() : "To be verified";

    // Mock an Owner Name extraction (real NLP would be needed for a perfect match, but we can look for "Mr.", "Mrs.", "Sri")
    const nameMatch = text.match(/(?:Mr\.|Mrs\.|Sri|Smt\.)\s+([A-Za-z\s]+)/i);
    const ownerName = nameMatch ? nameMatch[0].trim() : "To be verified";

    res.json({
      success: true,
      data: {
        rawText: text, // Optional: return raw text if the frontend wants it
        confidence: confidence,
        extracted: {
          surveyNo: surveyNo,
          area: area,
          doorNo: doorNo,
          ownerName: ownerName
        }
      }
    });

  } catch (err) {
    console.error("OCR Extraction Error:", err);
    res.status(500).json({ error: 'Failed to process document. Ensure it is a valid image.' });
  }
});

module.exports = router;
