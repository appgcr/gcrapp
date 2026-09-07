const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// POST /api/upload
// Accepts base64 image/document string or data URI and saves locally
router.post('/', async (req, res) => {
  try {
    const { image, folder = 'sbi_valuation_cases' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided for upload.' });
    }

    // Determine if it's a data URI
    let base64Data = image;
    let extension = 'png';
    
    if (image.includes('data:')) {
      const parts = image.split(';');
      const mime = parts[0].split(':')[1];
      base64Data = parts[1].replace('base64,', '');
      
      // Determine extension based on mime type
      if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
      else if (mime.includes('png')) extension = 'png';
      else if (mime.includes('pdf')) extension = 'pdf';
      else if (mime.includes('msword') || mime.includes('doc')) extension = 'doc';
      else if (mime.includes('openxmlformats-officedocument.wordprocessingml')) extension = 'docx';
      else if (mime.includes('video/mp4')) extension = 'mp4';
      else extension = mime.split('/')[1] || 'bin';
    }

    // Ensure uploads folder exists
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const filename = `${folder}_${Date.now()}.${extension}`;
    const filepath = path.join(uploadsDir, filename);

    // Save file
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    const localUrl = `http://localhost:5001/uploads/${filename}`;
    console.log(`✅ Local Upload Success: ${localUrl}`);

    res.status(200).json({
      success: true,
      url: localUrl,
      public_id: filename,
      format: extension
    });
  } catch (err) {
    console.error("❌ Local Upload Error:", err);
    res.status(500).json({ error: err.message || 'Local upload failed.' });
  }
});

module.exports = router;
