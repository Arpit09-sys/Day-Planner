const connectDB = require('../../../lib/db');
const Task = require('../../../models/Task');

/**
 * PUT /api/tasks/reset/:username — Reset all tasks' completed status
 */
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();
    const { username } = req.query;

    await Task.updateMany(
      { username: username },
      { $set: { completed: false } }
    );

    res.json({ success: true, message: 'All tasks reset' });
  } catch (err) {
    console.error('PUT /api/tasks/reset error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
