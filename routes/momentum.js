const express = require('express');
const router = express.Router();
const Momentum = require('../models/Momentum');

/* POST /api/momentum — Record event */
router.post('/', async (req, res) => {
  try {
    const { username, date, actionType, taskId, metadata } = req.body;
    if (!username || !date || !actionType) {
      return res.status(400).json({ success: false, message: 'username, date, and actionType required' });
    }

    // Prevent duplicates for singular events
    const existing = await Momentum.findOne({ username, date, actionType });
    if (existing && ['plan_created', 'reflection_done'].includes(actionType)) {
      return res.json({ success: true, data: existing, duplicate: true });
    }

    const event = await Momentum.create({
      username, date, actionType,
      taskId: taskId || null,
      metadata: metadata || {}
    });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/momentum/:username */
router.get('/:username', async (req, res) => {
  try {
    const limit = parseInt(req.query.days, 10) || 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - limit);

    const events = await Momentum.find({
      username: req.params.username,
      createdAt: { $gte: cutoff }
    }).sort({ createdAt: -1 });

    const uniqueDays = new Set(events.map(e => e.date));

    res.json({
      success: true,
      data: { events, daysCaredFor: uniqueDays.size, totalActions: events.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
