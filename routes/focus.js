const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const Task = require('../models/Task');
const { requireCurrentUser } = require('../lib/auth');

/* POST /api/focus — Start session */
router.post('/', async (req, res) => {
  try {
    const { taskId, plannedDuration } = req.body;
    if (!taskId || !mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({ success: false, message: 'A valid taskId is required' });
    }
    const task = await Task.exists({ _id: taskId, username: req.user.username });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    const session = await FocusSession.create({
      username: req.user.username, taskId,
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
    if (!requireCurrentUser(req, res, req.params.username)) return;
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
    if (!mongoose.isValidObjectId(req.params.sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid focus session id' });
    }
    const allowed = ['endTime', 'completedDuration', 'status'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const session = await FocusSession.findOneAndUpdate({ _id: req.params.sessionId, username: req.user.username }, updates, {
      new: true, runValidators: true
    });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
