const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      unique: true,
      index: true
    },
    // A one-way hash of the account's sync code. It is intentionally excluded
    // from normal queries and API responses.
    syncSecretHash: {
      type: String,
      default: '',
      select: false
    },
    displayName: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate: {
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'Please enter a valid email address.'
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    themePreference: {
      type: String,
      enum: ['light', 'dark', 'system', 'auto'],
      default: 'system'
    },
    planningPreference: {
      type: String,
      enum: ['minimal', 'structured', 'detailed'],
      default: 'minimal'
    },
    accessibility: {
      reducedMotion: { type: Boolean, default: false },
      soundOff: { type: Boolean, default: true },
      quietMode: { type: Boolean, default: false }
    },
    gamification: {
      enabled: { type: Boolean, default: true },
      visualCompanion: { type: Boolean, default: true }
    },
    notifications: {
      morningReminder: { type: Boolean, default: false },
      focusReminder: { type: Boolean, default: false },
      eveningReminder: { type: Boolean, default: false },
      preferredMorningTime: { type: String, default: '08:00' },
      preferredEveningTime: { type: String, default: '21:00' },
      quietHoursStart: { type: String, default: '22:00' },
      quietHoursEnd: { type: String, default: '07:00' },
      maxDailyReminders: { type: Number, default: 3 },
      browserPush: { type: Boolean, default: false },
      emailReminders: { type: Boolean, default: false },
      emailReminderTime: { type: String, default: '08:30' },
      lastEmailReminderKey: { type: String, default: '' },
      lastEmailReminderAt: { type: Date, default: null },
      pauseAll: { type: Boolean, default: false },
      pushSubscription: { type: mongoose.Schema.Types.Mixed }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);
