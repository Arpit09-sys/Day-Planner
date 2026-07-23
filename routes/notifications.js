const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const webpush = require('web-push');
const nodemailer = require('nodemailer');
const { requireAuth } = require('../lib/auth');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT) === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function parseTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function localDateTime(timezone, date = new Date()) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
  } catch (_) {
    return localDateTime('UTC', date);
  }

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function reminderIsDue(user, now) {
  const scheduled = parseTime(user.notifications?.emailReminderTime);
  if (!scheduled) return null;
  const local = localDateTime(user.timezone, now);
  const currentMinutes = local.hour * 60 + local.minute;
  const scheduledMinutes = scheduled.hour * 60 + scheduled.minute;
  // The cron can run every five minutes, so use a short window to avoid
  // skipped messages if a scheduled invocation runs a little late.
  if (currentMinutes < scheduledMinutes || currentMinutes - scheduledMinutes >= 10) return null;
  return { ...local, key: `${local.date}:${String(scheduled.hour).padStart(2, '0')}:${String(scheduled.minute).padStart(2, '0')}` };
}

async function sendDailyReminder(user, localDate) {
  const transporter = getTransporter();
  if (!transporter) {
    const error = new Error('SMTP is not configured.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const tasks = await Task.find({
    username: user.username,
    date: localDate,
    completed: { $ne: true }
  }).sort({ time: 1, order: 1 }).limit(3);

  const greeting = user.displayName || user.username;
  const taskCopy = tasks.length
    ? `${tasks.length} open task${tasks.length === 1 ? '' : 's'} for today`
    : 'a clean slate for today';
  const taskList = tasks.length
    ? `<ul>${tasks.map((task) => `<li>${escapeHtml(task.title)}</li>`).join('')}</ul>`
    : '<p>Choose one small, meaningful next step.</p>';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: `Day Planner · ${taskCopy}`,
    text: `Hi ${greeting},\n\nYou have ${taskCopy}. A calm plan is enough for today.\n\nOpen Day Planner when you are ready.`,
    html: `<div style="font-family:Arial,sans-serif;color:#202337;line-height:1.6;max-width:520px;margin:auto;padding:24px"><p>Hi ${escapeHtml(greeting)},</p><h2 style="margin:0;color:#6251d9">A calm plan is enough for today.</h2><p>You have ${escapeHtml(taskCopy)}.</p>${taskList}<p style="color:#646b7d">Open Day Planner when you are ready.</p></div>`
  });
}

function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  const header = req.get('authorization') || '';
  if (!expected) {
    return res.status(503).json({ success: false, message: 'Reminder scheduler is not configured.' });
  }
  if (header !== `Bearer ${expected}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized scheduler request.' });
  }
  return next();
}

/* Called by Vercel Cron (GET) or a compatible scheduler (POST). */
async function runReminderCron(req, res) {
  const now = new Date();
  try {
    if (!getTransporter()) {
      return res.status(503).json({ success: false, message: 'SMTP is not configured.' });
    }

    const users = await User.find({
      email: { $ne: '' },
      'notifications.emailReminders': true,
      'notifications.pauseAll': { $ne: true }
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      const due = reminderIsDue(user, now);
      if (!due || user.notifications?.lastEmailReminderKey === due.key) {
        skipped += 1;
        continue;
      }

      // Claim this reminder before sending it. This prevents duplicate emails
      // if two scheduler invocations overlap.
      const claim = await User.updateOne(
        {
          _id: user._id,
          'notifications.lastEmailReminderKey': { $ne: due.key }
        },
        {
          $set: {
            'notifications.lastEmailReminderKey': due.key,
            'notifications.lastEmailReminderAt': now
          }
        }
      );
      if (!claim.modifiedCount) {
        skipped += 1;
        continue;
      }

      try {
        await sendDailyReminder(user, due.date);
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`Email reminder failed for ${user.username}:`, error.message);
        // Allow a later scheduler pass to retry a failed delivery.
        await User.updateOne(
          { _id: user._id, 'notifications.lastEmailReminderKey': due.key },
          { $set: { 'notifications.lastEmailReminderKey': '', 'notifications.lastEmailReminderAt': null } }
        );
      }
    }

    return res.json({ success: true, sent, skipped, failed });
  } catch (error) {
    console.error('POST /api/notifications/cron/reminders error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to run email reminders.' });
  }
}

router.get('/cron/reminders', requireCronSecret, runReminderCron);
router.post('/cron/reminders', requireCronSecret, runReminderCron);

router.use(requireAuth);

/* GET /api/notifications/config — public key needed by the signed-in client */
router.get('/config', (req, res) => {
  return res.json({
    success: true,
    data: { vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '' }
  });
});

/* POST /api/notifications/subscribe — save push subscription */
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || typeof subscription !== 'object') {
      return res.status(400).json({ success: false, message: 'A valid push subscription is required.' });
    }

    await User.findOneAndUpdate(
      { username: req.user.username },
      { $set: { 'notifications.pushSubscription': subscription, 'notifications.browserPush': true } },
      { new: true }
    );

    return res.status(200).json({ success: true, message: 'Browser notifications enabled.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to save browser notifications.' });
  }
});

/* POST /api/notifications/test — send a manual test only to the signed-in user */
router.post('/test', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    let pushSent = false;
    let emailSent = false;
    const notices = [];

    if (user.notifications?.pushSubscription && user.notifications?.browserPush && process.env.VAPID_PUBLIC_KEY) {
      try {
        await webpush.sendNotification(user.notifications.pushSubscription, JSON.stringify({
          title: 'Day Planner check-in',
          body: 'A calm plan is enough for today.',
          icon: '/icon.svg'
        }));
        pushSent = true;
      } catch (error) {
        console.error('Push error:', error.message);
        if (error.statusCode === 404 || error.statusCode === 410) {
          await User.updateOne({ username: req.user.username }, { $unset: { 'notifications.pushSubscription': 1 } });
        }
        notices.push('Browser push could not be delivered.');
      }
    }

    if (user.email && user.notifications?.emailReminders) {
      try {
        await sendDailyReminder(user, localDateTime(user.timezone).date);
        emailSent = true;
      } catch (error) {
        console.error('Email error:', error.message);
        notices.push(error.code === 'SMTP_NOT_CONFIGURED'
          ? 'Email delivery is not configured on the server yet.'
          : 'Email could not be delivered.');
      }
    }

    if (!pushSent && !emailSent && notices.length === 0) {
      notices.push('Enable a notification method first.');
    }

    return res.status(200).json({ success: pushSent || emailSent, pushSent, emailSent, message: notices.join(' ') });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to send a test notification.' });
  }
});

module.exports = router;
