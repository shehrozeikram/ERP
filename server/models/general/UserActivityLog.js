const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema({
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
  actionType: {
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'login', 'logout', 'view', 'export', 'approve', 'reject', 'other'],
    required: true,
    index: true
  },
  module: {
    type: String,
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true
  },
  requestMethod: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    required: true
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Store flexible data structure
    default: {}
  },
  description: {
    type: String,
    default: ''
  },
  resourceId: {
    type: String, // ID of the resource being acted upon
    default: null
  },
  resourceType: {
    type: String, // Type of resource (e.g., 'Employee', 'Invoice', 'Payment')
    default: null
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
userActivityLogSchema.index({ userId: 1, timestamp: -1 });
userActivityLogSchema.index({ module: 1, timestamp: -1 });
userActivityLogSchema.index({ actionType: 1, timestamp: -1 });
userActivityLogSchema.index({ ipAddress: 1, timestamp: -1 });
userActivityLogSchema.index({ createdAt: -1 });

// Static method to find recent activities
userActivityLogSchema.statics.findRecentActivities = function(limit = 100) {
  return this.find()
    .populate('userId', 'firstName lastName email employeeId')
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to find user activities
userActivityLogSchema.statics.findUserActivities = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to find activities by module
userActivityLogSchema.statics.findByModule = function(module, limit = 100) {
  return this.find({ module })
    .populate('userId', 'firstName lastName email employeeId')
    .sort({ timestamp: -1 })
    .limit(limit);
};

module.exports = mongoose.model('UserActivityLog', userActivityLogSchema);

