const connectDB = require('../../lib/db');
const FocusSession = require('../../models/FocusSession');

/**
 * POST /api/focus — Start a new focus session
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
    const { username, taskId, plannedDuration } = req.body;

    if (!username || !taskId) {
      return res.status(400).json({ success: false, message: 'username and taskId are required' });
    }

    const session = await FocusSession.create({
      username,
      taskId,
      startTime: new Date(),
      plannedDuration: plannedDuration || 25,
      status: 'active'
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    console.error('POST /api/focus error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
