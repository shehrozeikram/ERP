const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema({
  // Basic Information
  action: {
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'login', 'logout', 'approve', 'reject', 'export', 'import'],
    index: true
  },
  module: {
    type: String,
    required: true,
    enum: ['hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'audit', 'auth', 'general'],
    index: true
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    index: true
  },
  userRole: {
    type: String,
    required: true,
    index: true
  },
  userDepartment: {
    type: String,
    index: true
  },
  
  // Entity Information
  entityType: {
    type: String,
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  entityName: {
    type: String,
    trim: true
  },
  
  // Action Details
  description: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Change Tracking
  oldValues: {
    type: mongoose.Schema.Types.Mixed
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed
  },
  changedFields: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  
  // Request Information
  ipAddress: {
    type: String,
    index: true
  },
  userAgent: String,
  requestMethod: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  requestUrl: String,
  requestBody: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Session Information
  sessionId: String,
  
  // Risk Assessment
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },
  
  // Status and Flags
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success',
    index: true
  },
  isSuspicious: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Additional Context
  tags: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    enum: ['data_access', 'data_modification', 'system_access', 'configuration_change', 'security_event', 'business_process'],
    default: 'data_modification',
    index: true
  },
  
  // Related Records
  relatedEntities: [{
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    relationship: String
  }],
  
  // Audit Context
  auditContext: {
    auditId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audit'
    },
    findingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuditFinding'
    },
    correctiveActionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CorrectiveAction'
    }
  },
  
  // Metadata
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We're using custom timestamp field
});

// Compound indexes for better performance
auditTrailSchema.index({ userId: 1, timestamp: -1 });
auditTrailSchema.index({ module: 1, action: 1, timestamp: -1 });
auditTrailSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditTrailSchema.index({ timestamp: -1 });
auditTrailSchema.index({ riskLevel: 1, timestamp: -1 });
auditTrailSchema.index({ isSuspicious: 1, timestamp: -1 });

// Text index for search functionality
auditTrailSchema.index({
  description: 'text',
  entityName: 'text',
  userEmail: 'text'
});

// Static method to log an action
auditTrailSchema.statics.logAction = async function(actionData) {
  const {
    action,
    module,
    userId,
    userEmail,
    userRole,
    userDepartment,
    entityType,
    entityId,
    entityName,
    description,
    details,
    oldValues,
    newValues,
    changedFields,
    ipAddress,
    userAgent,
    requestMethod,
    requestUrl,
    requestBody,
    sessionId,
    riskLevel,
    status,
    isSuspicious,
    tags,
    category,
    relatedEntities,
    auditContext
  } = actionData;

  // Validate required fields before proceeding
  if (!userId) {
    console.error('AuditTrail.logAction: userId is required but was not provided', {
      action,
      module,
      userEmail,
      hasUserId: !!userId
    });
    return null; // Return null instead of throwing to prevent breaking the request
  }

  if (!userEmail) {
    console.error('AuditTrail.logAction: userEmail is required but was not provided', {
      action,
      module,
      userId,
      hasUserEmail: !!userEmail
    });
    return null;
  }

  // Determine risk level based on action and entity type
  let calculatedRiskLevel = riskLevel || 'low';
  if (!calculatedRiskLevel) {
    if (action === 'delete' || action === 'approve' || action === 'reject') {
      calculatedRiskLevel = 'medium';
    } else if (action === 'create' && (module === 'finance' || module === 'hr')) {
      calculatedRiskLevel = 'medium';
    } else if (action === 'update' && entityType === 'User') {
      calculatedRiskLevel = 'high';
    }
  }

  // Detect suspicious activities
  let suspicious = isSuspicious || false;
  if (!suspicious) {
    // Check for unusual patterns
    const recentActions = await this.find({
      userId,
      timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }).countDocuments();

    if (recentActions > 50) {
      suspicious = true;
    }

    // Check for bulk operations
    if (action === 'delete' && changedFields && changedFields.length > 10) {
      suspicious = true;
    }

    // Check for sensitive data access
    if (action === 'read' && (entityType === 'Payroll' || entityType === 'Employee' || entityType === 'FinancialTransaction')) {
      calculatedRiskLevel = 'medium';
    }
  }

  const auditEntry = new this({
    action,
    module,
    userId,
    userEmail,
    userRole,
    userDepartment,
    entityType,
    entityId,
    entityName,
    description,
    details,
    oldValues,
    newValues,
    changedFields,
    ipAddress,
    userAgent,
    requestMethod,
    requestUrl,
    requestBody,
    sessionId,
    riskLevel: calculatedRiskLevel,
    status,
    isSuspicious: suspicious,
    tags,
    category,
    relatedEntities,
    auditContext,
    timestamp: new Date()
  });

  return await auditEntry.save();
};

// Static method to get audit statistics
auditTrailSchema.statics.getStatistics = async function(filters = {}) {
  const pipeline = [
    { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, ...filters } }, // Last 30 days
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        createActions: {
          $sum: { $cond: [{ $eq: ['$action', 'create'] }, 1, 0] }
        },
        updateActions: {
          $sum: { $cond: [{ $eq: ['$action', 'update'] }, 1, 0] }
        },
        deleteActions: {
          $sum: { $cond: [{ $eq: ['$action', 'delete'] }, 1, 0] }
        },
        readActions: {
          $sum: { $cond: [{ $eq: ['$action', 'read'] }, 1, 0] }
        },
        loginActions: {
          $sum: { $cond: [{ $eq: ['$action', 'login'] }, 1, 0] }
        },
        highRiskActions: {
          $sum: { $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0] }
        },
        criticalRiskActions: {
          $sum: { $cond: [{ $eq: ['$riskLevel', 'critical'] }, 1, 0] }
        },
        suspiciousActions: {
          $sum: { $cond: [{ $eq: ['$isSuspicious', true] }, 1, 0] }
        },
        failedActions: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalActions: 0,
    createActions: 0,
    updateActions: 0,
    deleteActions: 0,
    readActions: 0,
    loginActions: 0,
    highRiskActions: 0,
    criticalRiskActions: 0,
    suspiciousActions: 0,
    failedActions: 0
  };
};

// Static method to get user activity summary
auditTrailSchema.statics.getUserActivitySummary = async function(userId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: {
          module: '$module',
          action: '$action'
        },
        count: { $sum: 1 },
        lastActivity: { $max: '$timestamp' }
      }
    },
    {
      $group: {
        _id: '$_id.module',
        actions: {
          $push: {
            action: '$_id.action',
            count: '$count',
            lastActivity: '$lastActivity'
          }
        },
        totalActions: { $sum: '$count' }
      }
    },
    { $sort: { totalActions: -1 } }
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to detect anomalies
auditTrailSchema.statics.detectAnomalies = async function(hours = 24) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  // Find users with unusually high activity
  const highActivityUsers = await this.aggregate([
    { $match: { timestamp: { $gte: startTime } } },
    {
      $group: {
        _id: '$userId',
        userEmail: { $first: '$userEmail' },
        actionCount: { $sum: 1 },
        uniqueModules: { $addToSet: '$module' },
        uniqueEntities: { $addToSet: '$entityType' }
      }
    },
    { $match: { actionCount: { $gte: 100 } } },
    { $sort: { actionCount: -1 } }
  ]);

  // Find suspicious patterns
  const suspiciousPatterns = await this.aggregate([
    { $match: { timestamp: { $gte: startTime }, isSuspicious: true } },
    {
      $group: {
        _id: '$userId',
        userEmail: { $first: '$userEmail' },
        suspiciousActions: { $sum: 1 },
        actions: { $push: { action: '$action', module: '$module', entityType: '$entityType' } }
      }
    },
    { $match: { suspiciousActions: { $gte: 5 } } }
  ]);

  return {
    highActivityUsers,
    suspiciousPatterns
  };
};

module.exports = mongoose.model('AuditTrail', auditTrailSchema);
