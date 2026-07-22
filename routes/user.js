const express = require('express');
const router = express.Router();
const User = require('../models/User');

/* GET /api/user/:username */
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* POST /api/user — Create user */
router.post('/', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: 'username required' });

    const existing = await User.findOne({ username });
    if (existing) return res.json({ success: true, data: existing });

    const user = await User.create({ username, displayName: req.body.displayName || username, ...req.body });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* PUT /api/user/:username */
router.put('/:username', async (req, res) => {
  try {
    const allowed = ['displayName', 'email', 'timezone', 'themePreference',
      'planningPreference', 'accessibility', 'gamification', 'notifications'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findOneAndUpdate(
      { username: req.params.username }, updates,
      { new: true, runValidators: true, upsert: true }
    );
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
