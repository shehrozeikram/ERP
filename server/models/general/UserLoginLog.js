const mongoose = require('mongoose');

const userLoginLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  loginTime: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  logoutTime: {
    type: Date,
    default: null
  },
  sessionDuration: {
    type: Number, // Duration in milliseconds
    default: null
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'logged_out', 'expired'],
    default: 'active',
    index: true
  },
  logoutReason: {
    type: String,
    enum: ['manual', 'timeout', 'forced', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
userLoginLogSchema.index({ userId: 1, loginTime: -1 });
userLoginLogSchema.index({ status: 1, loginTime: -1 });
userLoginLogSchema.index({ ipAddress: 1 });
userLoginLogSchema.index({ createdAt: -1 });

// Method to calculate session duration
userLoginLogSchema.methods.calculateDuration = function() {
  if (this.logoutTime && this.loginTime) {
    this.sessionDuration = this.logoutTime - this.loginTime;
    return this.sessionDuration;
  }
  return null;
};

// Static method to find active sessions
userLoginLogSchema.statics.findActiveSessions = function() {
  return this.find({ status: 'active' })
    .populate('userId', 'firstName lastName email employeeId')
    .sort({ loginTime: -1 });
};

// Static method to find user login history
userLoginLogSchema.statics.findUserHistory = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ loginTime: -1 })
    .limit(limit);
};

module.exports = mongoose.model('UserLoginLog', userLoginLogSchema);

