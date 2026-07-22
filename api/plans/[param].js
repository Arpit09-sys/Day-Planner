const connectDB = require('../../lib/db');
const DailyPlan = require('../../models/DailyPlan');

/**
 * /api/plans/[param]
 *   GET → param = username, query.date = YYYY-MM-DD → get plan
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
      const { date } = req.query;
      if (date) {
        const plan = await DailyPlan.findOne({ username: param, date });
        return res.json({ success: true, data: plan });
      }
      // Return recent plans (last 30 days)
      const plans = await DailyPlan.find({ username: param })
        .sort({ date: -1 })
        .limit(30);
      return res.json({ success: true, data: plans });
    }

    if (req.method === 'PUT') {
      const { date } = req.body;
      if (!date) {
        return res.status(400).json({ success: false, message: 'date is required' });
      }

      const allowed = [
        'energyLevel', 'topPriorities', 'dailyIntention', 'context',
        'reflection', 'completionSummary', 'rolloverDecisions'
      ];
      const updates = {};
      allowed.forEach(field => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const plan = await DailyPlan.findOneAndUpdate(
        { username: param, date },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!plan) {
        return res.status(404).json({ success: false, message: 'Plan not found' });
      }

      return res.json({ success: true, data: plan });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('API /plans/[param] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
