const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const notificationSchema = new mongoose.Schema({
  // Notification Type
  type: {
    type: String,
    required: true,
    enum: [
      'candidate_hired',
      'employee_status_change',
      'attendance_update',
      'payroll_generated',
      'loan_approved',
      'leave_request',
      'performance_review',
      'training_assigned',
      'system_alert',
      'other'
    ]
  },
  
  // Title and Description
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  
  // Priority Level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Status
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread'
  },
  
  // Recipients
  recipients: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    readAt: Date,
    archivedAt: Date
  }],
  
  // Related Entities
  relatedEntity: {
    type: String,
    enum: ['candidate', 'employee', 'attendance', 'payroll', 'loan', 'leave', 'performance', 'training', 'system'],
    required: true
  },
  
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedEntityRef'
  },
  
  relatedEntityRef: {
    type: String,
    enum: ['Candidate', 'Employee', 'Attendance', 'Payroll', 'Loan', 'Leave', 'Performance', 'Training'],
    required: function() {
      return this.relatedEntityId != null;
    }
  },
  
  // Action Required
  actionRequired: {
    type: Boolean,
    default: false
  },
  
  actionType: {
    type: String,
    enum: ['approve', 'review', 'complete', 'acknowledge', 'none'],
    default: 'none'
  },
  
  actionUrl: String, // URL to navigate to for action
  
  // Expiry
  expiresAt: Date,
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better performance
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ 'recipients.user': 1, status: 1 });
notificationSchema.index({ relatedEntity: 1, relatedEntityId: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });

// Virtual for unread count per user
notificationSchema.virtual('unreadCount').get(function() {
  return this.recipients.filter(r => !r.readAt).length;
});

// Virtual for is expired
notificationSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Static method to get notifications for a user
notificationSchema.statics.getForUser = function(userId, options = {}) {
  const {
    status = 'unread',
    type,
    limit = 50,
    skip = 0,
    sort = { createdAt: -1 }
  } = options;
  
  const query = {
    'recipients.user': userId,
    status: status
  };
  
  if (type) query.type = type;
  
  return this.find(query)
    .populate('recipients.user', 'firstName lastName email profileImage')
    .populate('createdBy', 'firstName lastName email profileImage')
    .populate('relatedEntityId')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    'recipients.user': userId,
    status: 'unread'
  });
};

// Static method to mark as read
notificationSchema.statics.markAsRead = function(notificationId, userId) {
  return this.updateOne(
    { 
      _id: notificationId,
      'recipients.user': userId 
    },
    { 
      $set: { 
        'recipients.$.readAt': new Date(),
        status: 'read'
      },
      $push: {
        readBy: {
          user: userId,
          readAt: new Date()
        }
      }
    }
  );
};

// Static method to mark as archived
notificationSchema.statics.markAsArchived = function(notificationId, userId) {
  return this.updateOne(
    { 
      _id: notificationId,
      'recipients.user': userId 
    },
    { 
      $set: { 
        'recipients.$.archivedAt': new Date(),
        status: 'archived'
      },
      $push: {
        archivedBy: {
          user: userId,
          archivedAt: new Date()
        }
      }
    }
  );
};

// Add pagination plugin
notificationSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Notification', notificationSchema);
