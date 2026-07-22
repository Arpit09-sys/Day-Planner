const express = require('express');
const router = express.Router();
const DailyPlan = require('../models/DailyPlan');

/* POST /api/plans — Create or update */
router.post('/', async (req, res) => {
  try {
    const { username, date } = req.body;
    if (!username || !date) {
      return res.status(400).json({ success: false, message: 'username and date required' });
    }
    const plan = await DailyPlan.findOneAndUpdate(
      { username, date },
      { $set: req.body },
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
    const plan = await DailyPlan.findByIdAndUpdate(req.params.planId, req.body, {
      new: true, runValidators: true
    });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
