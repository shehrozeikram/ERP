const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  jobTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid website URL']
  },

  // Business Information
  business: {
    type: String,
    required: [true, 'Business is required'],
    enum: ['Taj Residencia', 'Boly.pk', 'SGC General'],
    default: 'SGC General'
  },

  // Lead Details
  source: {
    type: String,
    required: [true, 'Lead source is required'],
    enum: ['Website', 'Social Media', 'Referral', 'Cold Call', 'Trade Show', 'Advertisement', 'Email Campaign', 'Walk-in', 'Phone Call', 'Other'],
    default: 'Website'
  },
  status: {
    type: String,
    required: [true, 'Lead status is required'],
    enum: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Unqualified'],
    default: 'New'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // Address Information
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'United States'
    }
  },

  // Business Information
  industry: {
    type: String,
    trim: true,
    maxlength: [100, 'Industry cannot exceed 100 characters']
  },
  companySize: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    default: '1-10'
  },
  annualRevenue: {
    type: String,
    enum: ['Less than $1M', '$1M - $10M', '$10M - $50M', '$50M - $100M', '$100M+'],
    default: 'Less than $1M'
  },

  // ==================== TAJ RESIDENCIA SPECIFIC FIELDS ====================
  // Real Estate / Housing Society Fields
  propertyType: {
    type: String,
    enum: ['Plot', 'House', 'Apartment', 'Commercial', 'Farm House', 'Other'],
    default: 'Plot'
  },
  plotSize: {
    type: String,
    enum: ['5 Marla', '7 Marla', '10 Marla', '1 Kanal', '2 Kanal', '5 Kanal', '10 Kanal', 'Other'],
    default: '5 Marla'
  },
  budget: {
    type: String,
    enum: ['Under 50 Lakh', '50 Lakh - 1 Crore', '1 Crore - 2 Crore', '2 Crore - 5 Crore', '5 Crore+'],
    default: 'Under 50 Lakh'
  },
  paymentPlan: {
    type: String,
    enum: ['Cash', 'Installments', 'Bank Financing', 'Not Decided'],
    default: 'Not Decided'
  },
  preferredLocation: {
    type: String,
    trim: true,
    maxlength: [100, 'Preferred location cannot exceed 100 characters']
  },
  timeline: {
    type: String,
    enum: ['Immediate', 'Within 3 months', 'Within 6 months', 'Within 1 year', 'Just Exploring'],
    default: 'Just Exploring'
  },

  // ==================== PROPERTY SALES SPECIFIC FIELDS ====================
  // Property Details for Sales
  propertyPhase: {
    type: String,
    enum: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5', 'Not Specified'],
    default: 'Not Specified'
  },
  propertyBlock: {
    type: String,
    enum: ['Block A', 'Block B', 'Block C', 'Block D', 'Block E', 'Commercial Block', 'Not Specified'],
    default: 'Not Specified'
  },
  propertyNumber: {
    type: String,
    trim: true,
    maxlength: [20, 'Property number cannot exceed 20 characters']
  },
  propertyPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  propertyStatus: {
    type: String,
    enum: ['Available', 'Reserved', 'Sold', 'Under Construction', 'Ready for Possession'],
    default: 'Available'
  },

  // Sales Process Fields
  salesStage: {
    type: String,
    enum: ['Initial Contact', 'Property Shown', 'Price Negotiation', 'Documentation', 'Payment Processing', 'Deal Closed', 'Deal Lost'],
    default: 'Initial Contact'
  },
  nextFollowUp: {
    type: Date,
    default: Date.now
  },
  followUpNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Follow-up notes cannot exceed 500 characters']
  },
  salesAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  commission: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // Customer Requirements
  customerType: {
    type: String,
    enum: ['Investor', 'End User', 'Business Owner', 'Developer', 'Other'],
    default: 'End User'
  },
  urgency: {
    type: String,
    enum: ['Very High', 'High', 'Medium', 'Low'],
    default: 'Medium'
  },
  decisionMaker: {
    type: String,
    trim: true,
    maxlength: [100, 'Decision maker name cannot exceed 100 characters']
  },

  // ==================== BOLY.PK SPECIFIC FIELDS ====================
  // Super App Fields
  appService: {
    type: String,
    enum: ['Food Delivery', 'Grocery', 'Pharmacy', 'Transport', 'Shopping', 'Services', 'Multiple Services', 'Other'],
    default: 'Food Delivery'
  },
  userType: {
    type: String,
    enum: ['Individual', 'Business', 'Restaurant', 'Store Owner', 'Service Provider', 'Other'],
    default: 'Individual'
  },
  platform: {
    type: String,
    enum: ['Android', 'iOS', 'Web', 'All Platforms'],
    default: 'All Platforms'
  },
  integrationType: {
    type: String,
    enum: ['New User', 'Existing Business', 'API Integration', 'White Label', 'Partnership'],
    default: 'New User'
  },

  // Lead Details
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  notes: [{
    content: {
      type: String,
      required: true,
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

  // Follow-up Information
  nextFollowUp: {
    type: Date
  },
  followUpNotes: {
    type: String,
    maxlength: [500, 'Follow-up notes cannot exceed 500 characters']
  },

  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Tags
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  // Activity Tracking
  lastContactDate: {
    type: Date
  },
  contactCount: {
    type: Number,
    default: 0
  },

  // Custom Fields
  customFields: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ company: 1 });
leadSchema.index({ 'address.city': 1, 'address.state': 1 });

// Virtual for full name
leadSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for full address
leadSchema.virtual('fullAddress').get(function() {
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.zipCode,
    this.address.country
  ].filter(Boolean);
  return parts.join(', ');
});

// Method to add note
leadSchema.methods.addNote = function(content, userId) {
  this.notes.push({
    content,
    createdBy: userId
  });
  return this.save();
};

// Method to update last contact
leadSchema.methods.updateLastContact = function() {
  this.lastContactDate = new Date();
  this.contactCount += 1;
  return this.save();
};

// Static method to get leads by status
leadSchema.statics.getLeadsByStatus = function(status) {
  return this.find({ status }).populate('assignedTo', 'firstName lastName email');
};

// Static method to get leads by source
leadSchema.statics.getLeadsBySource = function(source) {
  return this.find({ source }).populate('assignedTo', 'firstName lastName email');
};

// Static method to get leads by assigned user
leadSchema.statics.getLeadsByUser = function(userId) {
  return this.find({ assignedTo: userId }).populate('assignedTo', 'firstName lastName email');
};

// Pre-save middleware to update score based on various factors
leadSchema.pre('save', function(next) {
  let score = 0;
  
  // Score based on company size
  const companySizeScores = {
    '1-10': 10,
    '11-50': 20,
    '51-200': 30,
    '201-500': 40,
    '501-1000': 50,
    '1000+': 60
  };
  score += companySizeScores[this.companySize] || 0;
  
  // Score based on annual revenue
  const revenueScores = {
    'Less than $1M': 10,
    '$1M - $10M': 20,
    '$10M - $50M': 30,
    '$50M - $100M': 40,
    '$100M+': 50
  };
  score += revenueScores[this.annualRevenue] || 0;
  
  // Score based on priority
  const priorityScores = {
    'Low': 5,
    'Medium': 10,
    'High': 20,
    'Urgent': 30
  };
  score += priorityScores[this.priority] || 0;
  
  // Score based on contact count
  score += Math.min(this.contactCount * 5, 20);
  
  this.score = Math.min(score, 100);
  next();
});

module.exports = mongoose.model('Lead', leadSchema); 