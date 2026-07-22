const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const DailyPlan = require('../models/DailyPlan');
const FocusSession = require('../models/FocusSession');
const Momentum = require('../models/Momentum');

// GET /api/privacy/export/:username
router.get('/export/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const [user, tasks, plans, focus, momentum] = await Promise.all([
      User.findOne({ username }),
      Task.find({ username }),
      DailyPlan.find({ username }),
      FocusSession.find({ username }),
      Momentum.find({ username })
    ]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const exportData = {
      exportDate: new Date().toISOString(),
      user,
      tasks,
      plans,
      focus,
      momentum
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dayplanner_export_${username}.json"`);
    res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/privacy/delete/:username
router.delete('/delete/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await Promise.all([
      User.deleteOne({ username }),
      Task.deleteMany({ username }),
      DailyPlan.deleteMany({ username }),
      FocusSession.deleteMany({ username }),
      Momentum.deleteMany({ username })
    ]);

    res.status(200).json({ success: true, message: 'All user data has been permanently deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
