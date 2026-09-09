const express = require('express');
const router = express.Router();
const AppConfig = require('../models/AppConfig');
const ValuationCase = require('../models/ValuationCase');

// Helper: Get or initialize global config
async function getOrCreateConfig() {
  let config = await AppConfig.findOne({ key: 'global' });
  if (!config) {
    config = new AppConfig({ key: 'global' });
    await config.save();
  }

  // Dynamically merge any banks and districts from real cases in MongoDB
  try {
    const caseBanks = await ValuationCase.distinct('bankName');
    const caseDistricts = await ValuationCase.distinct('bankDistrict');
    
    let updated = false;
    caseBanks.filter(Boolean).forEach(b => {
      if (!config.banks.some(existing => existing.toLowerCase() === b.trim().toLowerCase())) {
        config.banks.push(b.trim());
        updated = true;
      }
    });

    caseDistricts.filter(Boolean).forEach(d => {
      if (!config.districts.some(existing => existing.toLowerCase() === d.trim().toLowerCase())) {
        config.districts.push(d.trim());
        updated = true;
      }
    });

    if (updated) {
      await config.save();
    }
  } catch (e) {
    console.warn('Dynamic case config merge notice:', e.message);
  }

  return config;
}

// GET /api/config
router.get('/', async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/config
router.put('/', async (req, res) => {
  try {
    const updated = await AppConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/config/banks
router.post('/banks', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bank name is required' });
    }

    const trimmed = name.trim();
    const config = await getOrCreateConfig();

    if (!config.banks.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      config.banks.push(trimmed);
      await config.save();
    }

    res.json({ success: true, banks: config.banks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/config/districts
router.post('/districts', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'District name is required' });
    }

    const trimmed = name.trim();
    const config = await getOrCreateConfig();

    if (!config.districts.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      config.districts.push(trimmed);
      await config.save();
    }

    res.json({ success: true, districts: config.districts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
