const express = require('express');
const router = express.Router();
const { Readable } = require('stream');
const fileStore = require('../services/fileStore');
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

    // 2. Without Cloudinary: keep the file in the database's file storage. (The server's own disk
    //    is wiped on every deploy/restart on Render, which left chat photos and selfies broken.)
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(image));
    const mime = (m && m[1]) || 'image/png';
    const buffer = Buffer.from(m ? m[3] : String(image), 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'The file is empty.' });
    const ext = (mime.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 8);
    const saved = await fileStore.saveStream(Readable.from(buffer), {
      filename: `${String(folder).replace(/[^a-z0-9_-]/gi, '')}_${Date.now()}.${ext}`,
      contentType: mime,
      uploadedBy: req.user && req.user.id,
    });
    // Full https link (behind Render's proxy the request itself looks like plain http)
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = req.get('host') || `localhost:${config.PORT || 5001}`;
    res.status(200).json({
      success: true,
      url: `${proto}://${host}${saved.url}`,
      public_id: saved.id,
      format: ext,
      provider: 'database'
    });
  } catch (err) {
    console.error("❌ Upload Error:", err);
    res.status(500).json({ error: err.message || 'File upload failed.' });
  }
});


module.exports = router;
