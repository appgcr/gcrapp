const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// GET /api/notifications/:user
// :user can be 'ADMIN' or the employee ID
router.get('/:user', async (req, res) => {
  try {
    const notifications = await Notification.find({ targetUser: req.params.user })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications
router.post('/', async (req, res) => {
  try {
    const newNotif = new Notification(req.body);
    const saved = await newNotif.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
