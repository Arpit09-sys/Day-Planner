const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DailyPlan = require('../models/DailyPlan');
const { requireCurrentUser } = require('../lib/auth');

/* POST /api/plans — Create or update */
router.post('/', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required' });
    }
    const plan = await DailyPlan.findOneAndUpdate(
      { username: req.user.username, date },
      { $set: { ...req.body, username: req.user.username } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/plans/:username?date=YYYY-MM-DD */
router.get('/:username', async (req, res) => {
  try {
    if (!requireCurrentUser(req, res, req.params.username)) return;
    const query = { username: req.params.username };
    if (req.query.date) query.date = req.query.date;
    const plans = await DailyPlan.find(query).sort({ date: -1 }).limit(30);
    res.json({ success: true, data: req.query.date ? plans[0] || null : plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* PUT /api/plans/:planId */
router.put('/:planId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.planId)) {
      return res.status(400).json({ success: false, message: 'Invalid plan id' });
    }
    const { username, _id, createdAt, updatedAt, ...updates } = req.body;
    const plan = await DailyPlan.findOneAndUpdate({ _id: req.params.planId, username: req.user.username }, updates, {
      new: true, runValidators: true
    });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
