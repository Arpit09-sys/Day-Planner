const connectDB = require('../../lib/db');
const User = require('../../models/User');
const Task = require('../../models/Task');
const DailyPlan = require('../../models/DailyPlan');
const FocusSession = require('../../models/FocusSession');
const Momentum = require('../../models/Momentum');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();
    const { username } = req.query;
    
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });
    
    const [user, tasks, plans, focus, momentum] = await Promise.all([
      User.findOne({ username }),
      Task.find({ username }),
      DailyPlan.find({ username }),
      FocusSession.find({ username }),
      Momentum.find({ username })
    ]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const exportData = {
      exportDate: new Date().toISOString(),
      user,
      tasks,
      plans,
      focus,
      momentum
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="dayplanner_export_${username}.json"`);
    return res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    console.error('API /privacy/export error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
