const connectDB = require('../../lib/db');
const Task = require('../../models/Task');
const mongoose = require('mongoose');

/**
 * Handles multiple methods on /api/tasks/[param]:
 *   GET    → param = username → fetch all tasks for user
 *   PUT    → param = taskId  → update a task
 *   DELETE → param = taskId  → delete a task
 */
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { param } = req.query;

  try {
    await connectDB();

    // ─── GET /api/tasks/:username ───
    if (req.method === 'GET') {
      const tasks = await Task.find({ username: param }).sort({ day: 1, order: 1 });
      return res.json({ success: true, data: tasks });
    }

    // ─── PUT /api/tasks/:taskId ───
    if (req.method === 'PUT') {
      if (!mongoose.Types.ObjectId.isValid(param)) {
        return res.status(400).json({ success: false, message: 'Invalid task ID' });
      }

      const updates = {};
      const allowed = ['title', 'time', 'priority', 'notes', 'completed', 'order', 'day'];
      allowed.forEach(function (field) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const task = await Task.findByIdAndUpdate(param, updates, { new: true, runValidators: true });
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      return res.json({ success: true, data: task });
    }

    // ─── DELETE /api/tasks/:taskId ───
    if (req.method === 'DELETE') {
      if (!mongoose.Types.ObjectId.isValid(param)) {
        return res.status(400).json({ success: false, message: 'Invalid task ID' });
      }

      const task = await Task.findByIdAndDelete(param);
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      return res.json({ success: true, message: 'Task deleted' });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('API /tasks/[param] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
