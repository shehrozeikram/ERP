const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Campaign name is required'],
    trim: true,
    maxlength: [200, 'Campaign name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    required: [true, 'Campaign type is required'],
    enum: {
      values: ['Email', 'Social Media', 'Direct Mail', 'Telemarketing', 'Event', 'Webinar', 'Content Marketing', 'Paid Advertising', 'Referral Program', 'Other'],
      message: 'Please select a valid campaign type'
    }
  },
  status: {
    type: String,
    required: [true, 'Campaign status is required'],
    enum: {
      values: ['Draft', 'Active', 'Paused', 'Completed', 'Cancelled'],
      message: 'Please select a valid campaign status'
    },
    default: 'Draft'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative'],
    default: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'PKR']
  },
  targetAudience: {
    type: String,
    trim: true,
    maxlength: [500, 'Target audience description cannot exceed 500 characters']
  },
  goals: {
    type: String,
    trim: true,
    maxlength: [500, 'Goals description cannot exceed 500 characters']
  },
  expectedRevenue: {
    type: Number,
    min: [0, 'Expected revenue cannot be negative'],
    default: 0
  },
  actualRevenue: {
    type: Number,
    min: [0, 'Actual revenue cannot be negative'],
    default: 0
  },
  costPerLead: {
    type: Number,
    min: [0, 'Cost per lead cannot be negative'],
    default: 0
  },
  conversionRate: {
    type: Number,
    min: [0, 'Conversion rate cannot be negative'],
    max: [100, 'Conversion rate cannot exceed 100%'],
    default: 0
  },
  totalLeads: {
    type: Number,
    min: [0, 'Total leads cannot be negative'],
    default: 0
  },
  qualifiedLeads: {
    type: Number,
    min: [0, 'Qualified leads cannot be negative'],
    default: 0
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Campaign must be assigned to someone']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  tags: [{
    type: String,
    trim: true
  }],
  channels: [{
    type: String,
    enum: ['Email', 'Social Media', 'Website', 'Phone', 'Direct Mail', 'Events', 'Webinars', 'Content', 'Advertising']
  }],
  metrics: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    opens: { type: Number, default: 0 },
    responses: { type: Number, default: 0 },
    meetings: { type: Number, default: 0 },
    opportunities: { type: Number, default: 0 },
    deals: { type: Number, default: 0 }
  },
  notes: [{
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Note content cannot exceed 1000 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for campaign duration
campaignSchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Virtual for campaign progress
campaignSchema.virtual('progress').get(function() {
  if (this.startDate && this.endDate) {
    const now = new Date();
    const totalDuration = this.endDate - this.startDate;
    const elapsed = now - this.startDate;
    
    if (elapsed <= 0) return 0;
    if (elapsed >= totalDuration) return 100;
    
    return Math.round((elapsed / totalDuration) * 100);
  }
  return 0;
});

// Virtual for ROI
campaignSchema.virtual('roi').get(function() {
  if (this.budget > 0) {
    return ((this.actualRevenue - this.budget) / this.budget) * 100;
  }
  return 0;
});

// Indexes for better query performance
campaignSchema.index({ status: 1, startDate: 1 });
campaignSchema.index({ assignedTo: 1 });
campaignSchema.index({ type: 1 });
campaignSchema.index({ tags: 1 });
campaignSchema.index({ createdAt: -1 });

// Pre-save middleware to validate dates
campaignSchema.pre('save', function(next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    next(new Error('End date must be after start date'));
  }
  next();
});

// Method to add note
campaignSchema.methods.addNote = function(content, userId) {
  this.notes.push({
    content,
    createdBy: userId
  });
  return this.save();
};

// Method to update metrics
campaignSchema.methods.updateMetrics = function(metricType, value) {
  if (this.metrics[metricType] !== undefined) {
    this.metrics[metricType] = value;
  }
  return this.save();
};

// Static method to get campaign statistics
campaignSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCampaigns: { $sum: 1 },
        activeCampaigns: {
          $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
        },
        totalBudget: { $sum: '$budget' },
        totalRevenue: { $sum: '$actualRevenue' },
        totalLeads: { $sum: '$totalLeads' },
        avgConversionRate: { $avg: '$conversionRate' }
      }
    }
  ]);
  
  return stats[0] || {
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalBudget: 0,
    totalRevenue: 0,
    totalLeads: 0,
    avgConversionRate: 0
  };
};

module.exports = mongoose.model('Campaign', campaignSchema); 