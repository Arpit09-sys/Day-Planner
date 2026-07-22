const connectDB = require('../../lib/db');
const FocusSession = require('../../models/FocusSession');
const mongoose = require('mongoose');

/**
 * /api/focus/[param]
 *   GET → param = username → get recent sessions
 *   PUT → param = sessionId → update/end session
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { param } = req.query;

  try {
    await connectDB();

    if (req.method === 'GET') {
      const sessions = await FocusSession.find({ username: param })
        .sort({ createdAt: -1 })
        .limit(50);
      return res.json({ success: true, data: sessions });
    }

    if (req.method === 'PUT') {
      if (!mongoose.Types.ObjectId.isValid(param)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const allowed = ['endTime', 'completedDuration', 'status'];
      const updates = {};
      allowed.forEach(field => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const session = await FocusSession.findByIdAndUpdate(param, updates, {
        new: true,
        runValidators: true
      });

      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }

      return res.json({ success: true, data: session });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('API /focus/[param] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
