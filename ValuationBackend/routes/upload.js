const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { config } = require('../config/env');
const { cloudinary } = require('../config/services');
const { authenticateToken } = require('../middleware/auth');

// POST /api/upload
// Accepts base64 image/document string or data URI and saves via Cloudinary or local storage
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { image, folder = 'sbi_valuation_cases' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided for upload.' });
    }

    // 1. If Cloudinary is configured and active, upload to Cloudinary CDN
    if (config.STORAGE_PROVIDER === 'cloudinary' && cloudinary) {
      try {
        const uploadResult = await cloudinary.uploader.upload(image, {
          folder: folder,
          resource_type: 'auto',
        });
        return res.status(200).json({
          success: true,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          format: uploadResult.format,
          provider: 'cloudinary'
        });
      } catch (cloudErr) {
        console.warn('⚠️ Cloudinary upload failed, falling back to local storage:', cloudErr.message);
      }
    }

    // 2. Local Storage Provider (Default / Air-gapped / Fallback)
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
    const uploadsDir = path.resolve(config.LOCAL_UPLOAD_DIRECTORY || path.join(__dirname, '..', 'uploads'));
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const filename = `${folder}_${Date.now()}.${extension}`;
    const filepath = path.join(uploadsDir, filename);

    // Save file locally
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    const host = req.get('host') || `localhost:${config.PORT || 5001}`;
    const protocol = req.protocol || 'http';
    const localUrl = `${protocol}://${host}/uploads/${filename}`;

    res.status(200).json({
      success: true,
      url: localUrl,
      public_id: filename,
      format: extension,
      provider: 'local'
    });
  } catch (err) {
    console.error("❌ Upload Error:", err);
    res.status(500).json({ error: err.message || 'File upload failed.' });
  }
});


module.exports = router;
