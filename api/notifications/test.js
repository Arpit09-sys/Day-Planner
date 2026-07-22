const connectDB = require('../../lib/db');
const User = require('../../models/User');
const webpush = require('web-push');
const nodemailer = require('nodemailer');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:test@test.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

let transporter;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

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
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, message: 'username required' });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let pushSent = false;
    let emailSent = false;

    if (user.notifications.pushSubscription && user.notifications.browserPush && process.env.VAPID_PUBLIC_KEY) {
      const payload = JSON.stringify({
        title: 'Day Planner Check-in',
        body: 'This is a test notification. Ready to focus?',
        icon: '/icon-192.png'
      });
      try {
        await webpush.sendNotification(user.notifications.pushSubscription, payload);
        pushSent = true;
      } catch (err) {
        if (err.statusCode === 410) {
           await User.updateOne({ username }, { $unset: { 'notifications.pushSubscription': 1 }});
        }
      }
    }

    if (user.email && user.notifications.emailReminders && transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'Day Planner',
          to: user.email,
          subject: 'Day Planner Check-in',
          text: 'This is a test email reminder. A calm plan is enough for today.',
          html: '<p>This is a test email reminder. A calm plan is enough for today.</p>'
        });
        emailSent = true;
      } catch (err) {
        console.error('Email error:', err);
      }
    }

    return res.status(200).json({ success: true, pushSent, emailSent });
  } catch (err) {
    console.error('API /notifications/test error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
