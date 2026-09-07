const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { username, password, name, role, phone, licenseNo, branch } = req.body;
    
    const existing = await User.findOne({ username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const count = await User.countDocuments();
    const newUser = new User({
      id: `ENG-${String(count + 1).padStart(3, '0')}`,
      username: username.trim(),
      password,
      name,
      role: role || 'ENGINEER',
      phone: phone || '9440164412',
      licenseNo: licenseNo || 'Indian Institution of Valuers F – ',
      branch: branch || '1. State Bank of India (SBI) - RACPC Branch, Kadapa'
    });

    const saved = await newUser.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:username
router.delete('/:username', async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete({ username: req.params.username });
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:username
router.put('/:username', async (req, res) => {
  try {
    const updated = await User.findOneAndUpdate(
      { username: req.params.username },
      { $set: req.body },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
