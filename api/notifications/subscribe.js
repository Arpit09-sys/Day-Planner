const connectDB = require('../../lib/db');
const User = require('../../models/User');

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
    const { username, subscription } = req.body;
    
    if (!username || !subscription) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }

    await User.findOneAndUpdate(
      { username },
      { 'notifications.pushSubscription': subscription, 'notifications.browserPush': true },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, message: 'Subscribed to web push' });
  } catch (err) {
    console.error('API /notifications/subscribe error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
