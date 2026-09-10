const mongoose = require('mongoose');

const userPushTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web', 'unknown'],
    default: 'unknown'
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userPushTokenSchema.index({ user: 1, token: 1 });

module.exports = mongoose.model('UserPushToken', userPushTokenSchema);
