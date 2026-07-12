const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      index: true
    },
    day: {
      type: String,
      required: [true, 'Day is required'],
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true
    },
    time: {
      type: String,
      default: ''
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    notes: {
      type: String,
      default: ''
    },
    completed: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
taskSchema.index({ username: 1, day: 1 });

module.exports = mongoose.model('Task', taskSchema);
