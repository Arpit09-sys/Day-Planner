const connectDB = require('../../lib/db');
const Task = require('../../models/Task');

/**
 * POST /api/tasks — Create a new task
 */
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();
    const { username, day, title, time, priority, notes, order } = req.body;

    if (!username || !title || !day) {
      return res.status(400).json({ success: false, message: 'username, day, and title are required' });
    }

    const task = await Task.create({
      username, day, title,
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
};
