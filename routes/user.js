const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {
  hashSyncCode,
  isValidSyncCode,
  isValidUsername,
  normalizeUsername,
  requireAuth,
  signToken,
  verifySyncCode
} = require('../lib/auth');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || '',
    timezone: user.timezone || 'UTC',
    themePreference: user.themePreference || 'system',
    planningPreference: user.planningPreference || 'minimal',
    accessibility: user.accessibility || {},
    gamification: user.gamification || {},
    notifications: {
      morningReminder: Boolean(user.notifications?.morningReminder),
      focusReminder: Boolean(user.notifications?.focusReminder),
      eveningReminder: Boolean(user.notifications?.eveningReminder),
      preferredMorningTime: user.notifications?.preferredMorningTime || '08:00',
      preferredEveningTime: user.notifications?.preferredEveningTime || '21:00',
      quietHoursStart: user.notifications?.quietHoursStart || '22:00',
      quietHoursEnd: user.notifications?.quietHoursEnd || '07:00',
      maxDailyReminders: user.notifications?.maxDailyReminders || 3,
      browserPush: Boolean(user.notifications?.browserPush),
      emailReminders: Boolean(user.notifications?.emailReminders),
      emailReminderTime: user.notifications?.emailReminderTime || '08:30',
      pauseAll: Boolean(user.notifications?.pauseAll)
    }
  };
}

function validateAccountInput(username, syncCode) {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    return { error: 'Choose a username with 3–30 lowercase letters, numbers, hyphens, or underscores.' };
  }
  if (!isValidSyncCode(syncCode)) {
    return { error: 'Your sync code must be at least 6 characters long.' };
  }
  return { username: normalized };
}

/* POST /api/user/register — create or secure a sync account */
router.post('/register', async (req, res) => {
  try {
    const input = validateAccountInput(req.body.username, req.body.syncCode);
    if (input.error) return res.status(400).json({ success: false, message: input.error });

    // Existing versions stored names in arbitrary case. Match one of those
    // legacy accounts before creating a canonical lower-case username.
    const existing = await User.findOne({
      username: { $regex: `^${escapeRegex(input.username)}$`, $options: 'i' }
    }).select('+syncSecretHash');

    if (existing?.syncSecretHash) {
      return res.status(409).json({
        success: false,
        message: 'That username is already in use. Sign in with its sync code instead.'
      });
    }

    const user = existing || new User({ username: input.username });
    user.syncSecretHash = hashSyncCode(req.body.syncCode.trim());
    user.displayName = String(req.body.displayName || user.displayName || input.username).trim().slice(0, 60);
    user.timezone = String(req.body.timezone || user.timezone || 'UTC').trim();

    if (req.body.email !== undefined && String(req.body.email).trim()) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      user.email = email;
    }

    await user.save();
    const token = signToken(user.username);
    return res.status(existing ? 200 : 201).json({
      success: true,
      data: publicUser(user),
      token,
      claimedLegacyAccount: Boolean(existing)
    });
  } catch (error) {
    if (error.code === 'AUTH_SECRET_MISSING') {
      return res.status(503).json({ success: false, message: 'Secure sync is not configured on this deployment.' });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'That username is already in use.' });
    }
    console.error('POST /api/user/register error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to create your account.' });
  }
});

/* POST /api/user/login — connect another device */
router.post('/login', async (req, res) => {
  try {
    const input = validateAccountInput(req.body.username, req.body.syncCode);
    if (input.error) return res.status(400).json({ success: false, message: input.error });

    const user = await User.findOne({
      username: { $regex: `^${escapeRegex(input.username)}$`, $options: 'i' }
    }).select('+syncSecretHash');

    if (!user || !verifySyncCode(req.body.syncCode.trim(), user.syncSecretHash)) {
      return res.status(401).json({ success: false, message: 'Incorrect username or sync code.' });
    }

    return res.json({ success: true, data: publicUser(user), token: signToken(user.username) });
  } catch (error) {
    if (error.code === 'AUTH_SECRET_MISSING') {
      return res.status(503).json({ success: false, message: 'Secure sync is not configured on this deployment.' });
    }
    console.error('POST /api/user/login error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to sign in right now.' });
  }
});

router.use(requireAuth);

/* GET /api/user/me */
router.get('/me', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    return res.json({ success: true, data: publicUser(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load account settings.' });
  }
});

/* PUT /api/user/me — update safe account preferences */
router.put('/me', async (req, res) => {
  try {
    const allowed = ['displayName', 'timezone', 'themePreference', 'planningPreference', 'accessibility', 'gamification'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.email !== undefined) {
      const email = String(req.body.email || '').trim().toLowerCase();
      if (email && !EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      updates.email = email;
    }

    if (req.body.notifications !== undefined) {
      const notifications = req.body.notifications || {};
      if (notifications.emailReminderTime !== undefined && !TIME_PATTERN.test(notifications.emailReminderTime)) {
        return res.status(400).json({ success: false, message: 'Use a valid reminder time.' });
      }
      const allowedNotifications = [
        'morningReminder', 'focusReminder', 'eveningReminder', 'preferredMorningTime',
        'preferredEveningTime', 'quietHoursStart', 'quietHoursEnd', 'maxDailyReminders',
        'browserPush', 'emailReminders', 'emailReminderTime', 'pauseAll'
      ];
      allowedNotifications.forEach((field) => {
        if (notifications[field] !== undefined) {
          updates[`notifications.${field}`] = notifications[field];
        }
      });
    }

    const user = await User.findOneAndUpdate(
      { username: req.user.username },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    return res.json({ success: true, data: publicUser(user) });
  } catch (error) {
    console.error('PUT /api/user/me error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save account settings.' });
  }
});

module.exports = router;
