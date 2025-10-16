const mongoose = require('mongoose');

const deviceLogSchema = new mongoose.Schema({
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NetworkDevice',
    required: [true, 'Device is required']
  },
  logType: {
    type: String,
    enum: ['Status Change', 'Performance', 'Error', 'Maintenance', 'Configuration', 'Security', 'Network'],
    required: [true, 'Log type is required']
  },
  severity: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low', 'Info'],
    default: 'Info'
  },
  title: {
    type: String,
    required: [true, 'Log title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  timestamp: {
    type: Date,
    required: [true, 'Timestamp is required'],
    default: Date.now
  },
  source: {
    type: String,
    enum: ['System', 'Manual', 'SNMP', 'API', 'Monitoring Tool', 'User Action'],
    default: 'System'
  },
  metrics: {
    cpuUsage: Number,
    memoryUsage: Number,
    diskUsage: Number,
    networkIn: Number,
    networkOut: Number,
    temperature: Number,
    uptime: Number,
    responseTime: Number,
    bandwidth: Number
  },
  status: {
    previous: String,
    current: String
  },
  configuration: {
    changed: [String],
    previousValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed
  },
  errorDetails: {
    errorCode: String,
    errorMessage: String,
    stackTrace: String,
    component: String
  },
  networkInfo: {
    sourceIP: String,
    destinationIP: String,
    port: Number,
    protocol: String,
    packetSize: Number
  },
  securityInfo: {
    threatType: String,
    sourceIP: String,
    blocked: Boolean,
    actionTaken: String
  },
  resolved: {
    isResolved: {
      type: Boolean,
      default: false
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolution: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
deviceLogSchema.index({ device: 1 });
deviceLogSchema.index({ logType: 1 });
deviceLogSchema.index({ severity: 1 });
deviceLogSchema.index({ timestamp: -1 });
deviceLogSchema.index({ 'resolved.isResolved': 1 });
deviceLogSchema.index({ isActive: 1 });

// Compound indexes for common queries
deviceLogSchema.index({ device: 1, timestamp: -1 });
deviceLogSchema.index({ severity: 1, timestamp: -1 });
deviceLogSchema.index({ logType: 1, timestamp: -1 });

// Virtual for resolution time
deviceLogSchema.virtual('resolutionTime').get(function() {
  if (!this.resolved?.isResolved || !this.resolved?.resolvedAt) return null;
  
  const diffTime = this.resolved.resolvedAt - this.timestamp;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
});

// Static methods
deviceLogSchema.statics.findByDevice = function(deviceId, limit = 100) {
  return this.find({ 
    device: deviceId,
    isActive: true 
  }).sort({ timestamp: -1 }).limit(limit);
};

deviceLogSchema.statics.findCriticalLogs = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    severity: 'Critical',
    timestamp: { $gte: startDate },
    isActive: true
  }).populate('device').sort({ timestamp: -1 });
};

deviceLogSchema.statics.findUnresolvedLogs = function() {
  return this.find({
    'resolved.isResolved': false,
    severity: { $in: ['Critical', 'High'] },
    isActive: true
  }).populate('device').sort({ timestamp: -1 });
};

deviceLogSchema.statics.findBySeverity = function(severity, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    severity: severity,
    timestamp: { $gte: startDate },
    isActive: true
  }).populate('device').sort({ timestamp: -1 });
};

deviceLogSchema.statics.getLogStatistics = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        criticalLogs: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0]
          }
        },
        highLogs: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'High'] }, 1, 0]
          }
        },
        mediumLogs: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'Medium'] }, 1, 0]
          }
        },
        lowLogs: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'Low'] }, 1, 0]
          }
        },
        infoLogs: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'Info'] }, 1, 0]
          }
        },
        resolvedLogs: {
          $sum: {
            $cond: [{ $eq: ['$resolved.isResolved', true] }, 1, 0]
          }
        },
        unresolvedLogs: {
          $sum: {
            $cond: [{ $eq: ['$resolved.isResolved', false] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  const typeStats = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: '$logType',
        count: { $sum: 1 },
        criticalCount: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0]
          }
        },
        highCount: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'High'] }, 1, 0]
          }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  const deviceStats = await this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: '$device',
        logCount: { $sum: 1 },
        criticalCount: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'networkdevices',
        localField: '_id',
        foreignField: '_id',
        as: 'device'
      }
    },
    {
      $unwind: '$device'
    },
    {
      $project: {
        deviceName: '$device.deviceName',
        deviceType: '$device.deviceType',
        logCount: 1,
        criticalCount: 1
      }
    },
    { $sort: { logCount: -1 } },
    { $limit: 10 }
  ]);
  
  return {
    overview: stats[0] || {
      totalLogs: 0,
      criticalLogs: 0,
      highLogs: 0,
      mediumLogs: 0,
      lowLogs: 0,
      infoLogs: 0,
      resolvedLogs: 0,
      unresolvedLogs: 0
    },
    byType: typeStats,
    topDevices: deviceStats
  };
};

module.exports = mongoose.model('DeviceLog', deviceLogSchema);
