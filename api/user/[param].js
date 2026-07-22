const connectDB = require('../../lib/db');
const User = require('../../models/User');

/**
 * /api/user/[param]
 *   GET  → param = username → fetch user prefs
 *   PUT  → param = username → update user prefs
 *   POST → param = username → create user
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { param } = req.query;

  try {
    await connectDB();

    if (req.method === 'GET') {
      const user = await User.findOne({ username: param });
      if (!user) {
        return res.json({ success: true, data: null });
      }
      return res.json({ success: true, data: user });
    }

    if (req.method === 'POST') {
      const existing = await User.findOne({ username: param });
      if (existing) {
        return res.json({ success: true, data: existing });
      }

      const user = await User.create({
        username: param,
        displayName: req.body.displayName || param,
        timezone: req.body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        ...req.body
      });
      return res.status(201).json({ success: true, data: user });
    }

    if (req.method === 'PUT') {
      const allowed = [
        'displayName', 'email', 'timezone', 'themePreference',
        'planningPreference', 'accessibility', 'gamification', 'notifications'
      ];
      const updates = {};
      allowed.forEach(field => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      const user = await User.findOneAndUpdate(
        { username: param },
        updates,
        { new: true, runValidators: true, upsert: true }
      );
      return res.json({ success: true, data: user });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('API /user/[param] error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
