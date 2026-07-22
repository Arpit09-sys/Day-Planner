const express = require('express');
const router = express.Router();
const FocusSession = require('../models/FocusSession');

/* POST /api/focus — Start session */
router.post('/', async (req, res) => {
  try {
    const { username, taskId, plannedDuration } = req.body;
    if (!username || !taskId) {
      return res.status(400).json({ success: false, message: 'username and taskId required' });
    }
    const session = await FocusSession.create({
      username, taskId,
      startTime: new Date(),
      plannedDuration: plannedDuration || 25,
      status: 'active'
    });
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/focus/:username — Get sessions */
router.get('/:username', async (req, res) => {
  try {
    const sessions = await FocusSession.find({ username: req.params.username })
      .sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* PUT /api/focus/:sessionId — Update/end session */
router.put('/:sessionId', async (req, res) => {
  try {
    const allowed = ['endTime', 'completedDuration', 'status'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const session = await FocusSession.findByIdAndUpdate(req.params.sessionId, updates, {
      new: true, runValidators: true
    });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
