const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { requireCurrentUser } = require('../lib/auth');

/* ─── POST /api/tasks ─── Create a new task ─── */
router.post('/', async (req, res) => {
  try {
    const { day, date, title, time, priority, notes, order,
            category, estimatedMinutes, scheduledTime, status } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'A task title is required' });
    }
    if (!day && !date) {
      return res.status(400).json({ success: false, message: 'day or date is required' });
    }

    const task = await Task.create({
      username: req.user.username, title: String(title).trim(),
      day: day || null,
      date: date || '',
      time: time || '',
      priority: priority || 'medium',
      notes: notes || '',
      category: category || 'none',
      estimatedMinutes: estimatedMinutes || 0,
      scheduledTime: scheduledTime || '',
      status: status || 'planned',
      completed: false,
      order: order || 0
    });

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    console.error('POST /api/tasks error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── GET /api/tasks/:username ─── Fetch tasks ─── */
router.get('/:username', async (req, res) => {
  try {
    if (!requireCurrentUser(req, res, req.params.username)) return;
    const query = { username: req.params.username };
    if (req.query.date) query.date = req.query.date;
    const tasks = await Task.find(query).sort({ date: 1, day: 1, order: 1 });
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error('GET /api/tasks/:username error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── PUT /api/tasks/reset/:username ─── Reset all ─── */
router.put('/reset/:username', async (req, res) => {
  try {
    if (!requireCurrentUser(req, res, req.params.username)) return;
    await Task.updateMany(
      { username: req.params.username },
      { $set: { completed: false, completedAt: null, status: 'planned' } }
    );
    res.json({ success: true, message: 'All tasks reset' });
  } catch (err) {
    console.error('PUT /api/tasks/reset error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── PUT /api/tasks/:taskId ─── Update a task ─── */
router.put('/:taskId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.taskId)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }
    const updates = {};
    const allowed = [
      'title', 'time', 'priority', 'notes', 'completed', 'order', 'day',
      'date', 'category', 'estimatedMinutes', 'scheduledTime', 'status',
      'completedAt', 'carriedForwardFrom'
    ];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Auto-set completedAt
    if (req.body.completed === true && !req.body.completedAt) {
      updates.completedAt = new Date();
      updates.status = 'complete';
    }
    if (req.body.completed === false) {
      updates.completedAt = null;
      if (!req.body.status) updates.status = 'planned';
    }

    const task = await Task.findOneAndUpdate({ _id: req.params.taskId, username: req.user.username }, updates, {
      new: true, runValidators: true
    });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    res.json({ success: true, data: task });
  } catch (err) {
    console.error('PUT /api/tasks/:taskId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── DELETE /api/tasks/:taskId ─── */
router.delete('/:taskId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.taskId)) {
      return res.status(400).json({ success: false, message: 'Invalid task id' });
    }
    const task = await Task.findOneAndDelete({ _id: req.params.taskId, username: req.user.username });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('DELETE /api/tasks/:taskId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
