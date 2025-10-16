const mongoose = require('mongoose');

const incidentReportSchema = new mongoose.Schema({
  incidentNumber: {
    type: String,
    required: [true, 'Incident number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  title: {
    type: String,
    required: [true, 'Incident title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  category: {
    type: String,
    enum: [
      'Hardware Failure', 'Software Issue', 'Network Outage', 'Security Breach',
      'Performance Issue', 'Data Loss', 'Service Disruption', 'User Error',
      'Third Party Issue', 'Maintenance', 'Power Outage', 'Other'
    ],
    required: [true, 'Category is required']
  },
  severity: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    required: [true, 'Severity is required']
  },
  priority: {
    type: String,
    enum: ['P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low'],
    required: [true, 'Priority is required']
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'],
    default: 'Open'
  },
  reportedBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reported by user is required']
    },
    contactInfo: {
      email: String,
      phone: String,
      department: String
    },
    reportedDate: {
      type: Date,
      required: [true, 'Reported date is required'],
      default: Date.now
    }
  },
  assignedTo: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    team: String,
    assignedDate: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  affectedSystems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NetworkDevice'
  }],
  affectedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  impact: {
    businessImpact: {
      type: String,
      enum: ['None', 'Low', 'Medium', 'High', 'Critical']
    },
    userImpact: {
      type: String,
      enum: ['None', 'Low', 'Medium', 'High', 'Critical']
    },
    financialImpact: Number,
    currency: {
      type: String,
      default: 'PKR',
      enum: ['PKR', 'USD', 'EUR']
    }
  },
  timeline: [{
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comments: String
  }],
  resolution: {
    description: String,
    rootCause: String,
    solution: String,
    preventiveMeasures: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedDate: Date,
    resolutionTime: Number // minutes
  },
  closure: {
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    closedDate: Date,
    closureReason: String,
    customerSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  sla: {
    targetResolutionTime: Number, // minutes
    actualResolutionTime: Number, // minutes
    breached: {
      type: Boolean,
      default: false
    }
  },
  attachments: [{
    type: {
      type: String,
      enum: ['Screenshot', 'Log File', 'Document', 'Other']
    },
    name: String,
    fileUrl: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
incidentReportSchema.index({ incidentNumber: 1 });
incidentReportSchema.index({ status: 1 });
incidentReportSchema.index({ severity: 1 });
incidentReportSchema.index({ priority: 1 });
incidentReportSchema.index({ category: 1 });
incidentReportSchema.index({ 'reportedBy.reportedDate': -1 });
incidentReportSchema.index({ 'assignedTo.user': 1 });
incidentReportSchema.index({ isActive: 1 });

// Virtual for incident age
incidentReportSchema.virtual('age').get(function() {
  const today = new Date();
  const reportedDate = new Date(this.reportedBy.reportedDate);
  const diffTime = Math.abs(today - reportedDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
});

// Virtual for SLA status
incidentReportSchema.virtual('slaStatus').get(function() {
  if (this.status === 'Resolved' || this.status === 'Closed') return 'Completed';
  if (!this.sla?.targetResolutionTime) return 'No SLA';
  
  const today = new Date();
  const reportedDate = new Date(this.reportedBy.reportedDate);
  const elapsedMinutes = (today - reportedDate) / (1000 * 60);
  
  if (elapsedMinutes > this.sla.targetResolutionTime) return 'Breached';
  if (elapsedMinutes > this.sla.targetResolutionTime * 0.8) return 'At Risk';
  return 'On Track';
});

// Pre-save middleware to auto-generate incident number and update timeline
incidentReportSchema.pre('save', async function(next) {
  // Auto-generate incident number if not provided
  if (!this.incidentNumber) {
    try {
      const count = await this.constructor.countDocuments();
      this.incidentNumber = `INC-${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating incident number:', error);
      this.incidentNumber = `INC-${Date.now().toString().slice(-6)}`;
    }
  }
  
  // Update timeline if status changed
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      updatedBy: this.updatedBy || this.createdBy,
      comments: `Status changed to ${this.status}`
    });
  }
  
  // Calculate resolution time
  if (this.resolution?.resolvedDate && this.reportedBy?.reportedDate) {
    const reportedDate = new Date(this.reportedBy.reportedDate);
    const resolvedDate = new Date(this.resolution.resolvedDate);
    this.resolution.resolutionTime = Math.ceil((resolvedDate - reportedDate) / (1000 * 60)); // minutes
    this.sla.actualResolutionTime = this.resolution.resolutionTime;
    
    // Check if SLA was breached
    if (this.sla.targetResolutionTime && this.resolution.resolutionTime > this.sla.targetResolutionTime) {
      this.sla.breached = true;
    }
  }
  
  next();
});

// Static methods
incidentReportSchema.statics.findOpenIncidents = function() {
  return this.find({
    status: { $in: ['Open', 'In Progress'] },
    isActive: true
  }).populate('reportedBy.user assignedTo.user').sort({ 'reportedBy.reportedDate': -1 });
};

incidentReportSchema.statics.findBySeverity = function(severity) {
  return this.find({
    severity: severity,
    isActive: true
  }).populate('reportedBy.user assignedTo.user').sort({ 'reportedBy.reportedDate': -1 });
};

incidentReportSchema.statics.findSLAAtRisk = function() {
  return this.find({
    status: { $in: ['Open', 'In Progress'] },
    'sla.targetResolutionTime': { $exists: true },
    isActive: true
  }).populate('reportedBy.user assignedTo.user');
};

incidentReportSchema.statics.getIncidentStatistics = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        'reportedBy.reportedDate': { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalIncidents: { $sum: 1 },
        openIncidents: {
          $sum: {
            $cond: [{ $in: ['$status', ['Open', 'In Progress']] }, 1, 0]
          }
        },
        resolvedIncidents: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
          }
        },
        closedIncidents: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0]
          }
        },
        criticalIncidents: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0]
          }
        },
        highIncidents: {
          $sum: {
            $cond: [{ $eq: ['$severity', 'High'] }, 1, 0]
          }
        },
        slaBreached: {
          $sum: {
            $cond: [{ $eq: ['$sla.breached', true] }, 1, 0]
          }
        },
        averageResolutionTime: { $avg: '$resolution.resolutionTime' }
      }
    }
  ]);
  
  const categoryStats = await this.aggregate([
    {
      $match: {
        'reportedBy.reportedDate': { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        averageResolutionTime: { $avg: '$resolution.resolutionTime' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  const severityStats = await this.aggregate([
    {
      $match: {
        'reportedBy.reportedDate': { $gte: startDate },
        isActive: true
      }
    },
    {
      $group: {
        _id: '$severity',
        count: { $sum: 1 },
        averageResolutionTime: { $avg: '$resolution.resolutionTime' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalIncidents: 0,
      openIncidents: 0,
      resolvedIncidents: 0,
      closedIncidents: 0,
      criticalIncidents: 0,
      highIncidents: 0,
      slaBreached: 0,
      averageResolutionTime: 0
    },
    byCategory: categoryStats,
    bySeverity: severityStats
  };
};

module.exports = mongoose.model('IncidentReport', incidentReportSchema);
