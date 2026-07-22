const connectDB = require('../../lib/db');
const User = require('../../models/User');
const Task = require('../../models/Task');
const DailyPlan = require('../../models/DailyPlan');
const FocusSession = require('../../models/FocusSession');
const Momentum = require('../../models/Momentum');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await connectDB();
    const { username } = req.query;
    
    if (!username) return res.status(400).json({ success: false, message: 'Username required' });
    
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await Promise.all([
      User.deleteOne({ username }),
      Task.deleteMany({ username }),
      DailyPlan.deleteMany({ username }),
      FocusSession.deleteMany({ username }),
      Momentum.deleteMany({ username })
    ]);

    return res.status(200).json({ success: true, message: 'All user data has been permanently deleted' });
  } catch (err) {
    console.error('API /privacy/delete error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
