const mongoose = require('mongoose');

const dailyPlanSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      index: true
    },
    date: {
      type: String,
      required: [true, 'Date is required']
    },
    energyLevel: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    },
    topPriorities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    }],
    dailyIntention: {
      type: String,
      default: '',
      trim: true
    },
    context: {
      type: String,
      enum: ['work', 'study', 'health', 'personal', 'reset'],
      default: 'personal'
    },
    reflection: {
      wentWell: { type: String, default: '' },
      canWait: { type: String, default: '' },
      tomorrowFirstStep: { type: String, default: '' },
      completed: { type: Boolean, default: false }
    },
    completionSummary: {
      totalTasks: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 },
      movedTasks: { type: Number, default: 0 },
      skippedTasks: { type: Number, default: 0 }
    },
    rolloverDecisions: [{
      taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
      action: { type: String, enum: ['moved', 'skipped', 'kept'] },
      movedTo: { type: String }
    }]
  },
  {
    timestamps: true
  }
);

// Unique index: one plan per user per day
dailyPlanSchema.index({ username: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyPlan', dailyPlanSchema);
