const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

/* ─── POST /api/tasks ─── Create a new task ─── */
router.post('/', async (req, res) => {
  try {
    const { username, day, title, time, priority, notes, order } = req.body;

    if (!username || !title || !day) {
      return res.status(400).json({
        success: false,
        message: 'username, day, and title are required'
      });
    }

    const task = await Task.create({
      username,
      day,
      title,
      time: time || '',
      priority: priority || 'medium',
      notes: notes || '',
      completed: false,
      order: order || 0
    });

    res.status(201).json({ success: true, data: task });
  } catch (err) {
    console.error('POST /api/tasks error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── GET /api/tasks/:username ─── Fetch all tasks for a user ─── */
router.get('/:username', async (req, res) => {
  try {
    const tasks = await Task.find({ username: req.params.username }).sort({ day: 1, order: 1 });
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error('GET /api/tasks/:username error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── PUT /api/tasks/reset/:username ─── Reset completed for all tasks ─── */
/* (Defined BEFORE /:taskId to avoid route conflict) */
router.put('/reset/:username', async (req, res) => {
  try {
    await Task.updateMany(
      { username: req.params.username },
      { $set: { completed: false } }
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
    const updates = {};
    const allowed = ['title', 'time', 'priority', 'notes', 'completed', 'order', 'day'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const task = await Task.findByIdAndUpdate(req.params.taskId, updates, {
      new: true,
      runValidators: true
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (err) {
    console.error('PUT /api/tasks/:taskId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── DELETE /api/tasks/:taskId ─── Delete a task ─── */
router.delete('/:taskId', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('DELETE /api/tasks/:taskId error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
