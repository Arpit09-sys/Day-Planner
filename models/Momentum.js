const mongoose = require('mongoose');

const momentumSchema = new mongoose.Schema(
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
    actionType: {
      type: String,
      enum: [
        'plan_created',
        'task_completed',
        'focus_completed',
        'reflection_done',
        'thoughtful_reschedule',
        'welcome_back'
      ],
      required: true
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate momentum events
momentumSchema.index({ username: 1, date: 1, actionType: 1 });
// For querying recent momentum
momentumSchema.index({ username: 1, createdAt: -1 });

module.exports = mongoose.model('Momentum', momentumSchema);
