const express = require('express');
const router = express.Router();
const User = require('../models/User');
const webpush = require('web-push');
const nodemailer = require('nodemailer');

// Setup Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:test@test.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Setup Nodemailer
let transporter;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// POST /api/notifications/subscribe - Save push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { username, subscription } = req.body;
    if (!username || !subscription) return res.status(400).json({ success: false, message: 'Missing data' });

    await User.findOneAndUpdate(
      { username },
      { 'notifications.pushSubscription': subscription, 'notifications.browserPush': true },
      { new: true, upsert: true }
    );
    
    res.status(200).json({ success: true, message: 'Subscribed to web push' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications/test - Trigger a test notification
router.post('/test', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false });

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let pushSent = false;
    let emailSent = false;

    // Test Web Push
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
        console.error('Push error:', err);
        if (err.statusCode === 410) { // Unsubscribed
           await User.updateOne({ username }, { $unset: { 'notifications.pushSubscription': 1 }});
        }
      }
    }

    // Test Email
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

    res.status(200).json({ success: true, pushSent, emailSent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
