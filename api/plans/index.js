const connectDB = require('../../lib/db');
const DailyPlan = require('../../models/DailyPlan');

/**
 * POST /api/plans — Create or update a daily plan
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
    const { username, date } = req.body;

    if (!username || !date) {
      return res.status(400).json({ success: false, message: 'username and date are required' });
    }

    const plan = await DailyPlan.findOneAndUpdate(
      { username, date },
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, data: plan });
  } catch (err) {
    console.error('POST /api/plans error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
