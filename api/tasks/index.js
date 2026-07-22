const connectDB = require('../../lib/db');
const Task = require('../../models/Task');

/**
 * POST /api/tasks — Create a new task
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();
    const { username, day, date, title, time, priority, notes, order,
            category, estimatedMinutes, scheduledTime, status } = req.body;

    if (!username || !title) {
      return res.status(400).json({ success: false, message: 'username and title are required' });
    }

    if (!day && !date) {
      return res.status(400).json({ success: false, message: 'day or date is required' });
    }

    const task = await Task.create({
      username,
      day: day || null,
      date: date || '',
      title,
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
};
