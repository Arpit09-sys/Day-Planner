const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      index: true
    },
    /* Legacy field — kept for backward compatibility */
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      default: null
    },
    /* New date-based field (ISO: YYYY-MM-DD) */
    date: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    },
    category: {
      type: String,
      enum: ['work', 'study', 'health', 'personal', 'none'],
      default: 'none'
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    estimatedMinutes: {
      type: Number,
      default: 0
    },
    time: {
      type: String,
      default: ''
    },
    scheduledTime: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['planned', 'in_progress', 'complete', 'moved', 'skipped'],
      default: 'planned'
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: null
    },
    carriedForwardFrom: {
      type: String,
      default: ''
    },
    order: {
      type: Number,
      default: 0
    },
    subtasks: [{
      id: { type: String, required: true },
      title: { type: String, required: true, trim: true },
      completed: { type: Boolean, default: false }
    }],
    recurrence: {
      type: String,
      enum: ['none', 'daily', 'weekdays', 'weekly'],
      default: 'none'
    },
    recurrenceSourceId: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
taskSchema.index({ username: 1, day: 1 });
taskSchema.index({ username: 1, date: 1 });

module.exports = mongoose.model('Task', taskSchema);
