const connectDB = require('../../lib/db');
const Momentum = require('../../models/Momentum');

/**
 * POST /api/momentum — Record a momentum event
 * GET  /api/momentum?username=X — Get momentum stats
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectDB();

    if (req.method === 'POST') {
      const { username, date, actionType, taskId, metadata } = req.body;

      if (!username || !date || !actionType) {
        return res.status(400).json({
          success: false,
          message: 'username, date, and actionType are required'
        });
      }

      // Prevent duplicate events for the same action on the same day
      const existing = await Momentum.findOne({ username, date, actionType });
      if (existing && ['plan_created', 'reflection_done'].includes(actionType)) {
        return res.json({ success: true, data: existing, duplicate: true });
      }

      const event = await Momentum.create({
        username, date, actionType,
        taskId: taskId || null,
        metadata: metadata || {}
      });

      return res.status(201).json({ success: true, data: event });
    }

    if (req.method === 'GET') {
      const { username, days } = req.query;
      if (!username) {
        return res.status(400).json({ success: false, message: 'username is required' });
      }

      const limit = parseInt(days, 10) || 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - limit);

      const events = await Momentum.find({
        username,
        createdAt: { $gte: cutoff }
      }).sort({ createdAt: -1 });

      // Calculate "days cared for"
      const uniqueDays = new Set(events.map(e => e.date));

      return res.json({
        success: true,
        data: {
          events,
          daysCaredFor: uniqueDays.size,
          totalActions: events.length
        }
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('API /momentum error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
