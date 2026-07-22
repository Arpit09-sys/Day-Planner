const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      index: true
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      default: null
    },
    plannedDuration: {
      type: Number,
      required: true,
      default: 25
    },
    completedDuration: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'abandoned'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

focusSessionSchema.index({ username: 1, createdAt: -1 });

module.exports = mongoose.model('FocusSession', focusSessionSchema);
