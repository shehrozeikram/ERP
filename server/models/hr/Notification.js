const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'system'],
    default: 'info'
  },
  category: {
    type: String,
    enum: ['attendance', 'payroll', 'leave', 'approval', 'system', 'other'],
    default: 'other'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  actionUrl: {
    type: String // URL to navigate to when notification is clicked
  },
  actionText: {
    type: String // Text for the action button
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed // Additional data specific to notification type
  },
  expiresAt: {
    type: Date // When the notification should expire
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1, category: 1 });
notificationSchema.index({ expiresAt: 1 });

// Auto-expire notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static methods for common queries
notificationSchema.statics.getForUser = function(userId, options = {}) {
  const { type, status, limit = 50, skip = 0 } = options;
  
  let query = { recipient: userId };
  
  if (type) {
    query.type = type;
  }
  
  if (status === 'unread') {
    query.isRead = false;
  } else if (status === 'read') {
    query.isRead = true;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('recipient', 'name email')
    .populate('createdBy', 'name email');
};

notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ 
    recipient: userId, 
    isRead: false 
  });
};

notificationSchema.statics.markAsRead = function(userId, notificationIds) {
  return this.updateMany(
    { 
      _id: { $in: notificationIds }, 
      recipient: userId 
    },
    { 
      $set: { 
        isRead: true, 
        readAt: new Date() 
      } 
    }
  );
};

module.exports = mongoose.model('Notification', notificationSchema);
