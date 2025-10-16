const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  website: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  // Company Details
  industry: {
    type: String,
    required: [true, 'Industry is required'],
    trim: true,
    maxlength: [100, 'Industry cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['Customer', 'Prospect', 'Partner', 'Vendor', 'Competitor', 'Other'],
    default: 'Prospect'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Lead', 'Prospect', 'Customer', 'Former Customer'],
    default: 'Prospect'
  },
  size: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    default: '1-10'
  },
  annualRevenue: {
    type: String,
    enum: ['Less than ₨100M', '₨100M - ₨1B', '₨1B - ₨5B', '₨5B - ₨10B', '₨10B+', 'Less than $1M', '$1M - $10M', '$10M - $50M', '$50M - $100M', '$100M+'],
    default: 'Less than ₨100M'
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
  foundedYear: {
    type: Number,
    min: [1800, 'Founded year must be after 1800'],
    max: [new Date().getFullYear(), 'Founded year cannot be in the future']
  },
  taxId: {
    type: String,
    trim: true,
    maxlength: [50, 'Tax ID cannot exceed 50 characters']
  },
  registrationNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Registration number cannot exceed 50 characters']
  },

  // Social Media
  socialMedia: {
    linkedin: String,
    twitter: String,
    facebook: String,
    instagram: String
  },

  // Company Description
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },

  // Financial Information
  creditLimit: {
    type: Number,
    default: 0
  },
  paymentTerms: {
    type: String,
    enum: ['Net 30', 'Net 60', 'Net 90', 'Due on Receipt', 'Custom'],
    default: 'Net 30'
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },

  // Activity Tracking
  lastActivityDate: {
    type: Date
  },
  lastOrderDate: {
    type: Date
  },
  customerSince: {
    type: Date
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

  // Lead Integration - Bidirectional Reference
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },

  // Tags
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  // Custom Fields
  customFields: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
companySchema.index({ name: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ status: 1 });
companySchema.index({ type: 1 });
companySchema.index({ assignedTo: 1 });
companySchema.index({ createdAt: -1 });
companySchema.index({ 'address.city': 1, 'address.state': 1 });

// Virtual for full address
companySchema.virtual('fullAddress').get(function() {
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.zipCode,
    this.address.country
  ].filter(Boolean);
  return parts.join(', ');
});

// Method to update last activity
companySchema.methods.updateLastActivity = function() {
  this.lastActivityDate = new Date();
  return this.save();
};

// Method to update last order
companySchema.methods.updateLastOrder = function() {
  this.lastOrderDate = new Date();
  this.totalOrders += 1;
  return this.save();
};

// Static method to get companies by type
companySchema.statics.getCompaniesByType = function(type) {
  return this.find({ type }).populate('assignedTo', 'firstName lastName email');
};

// Static method to get companies by status
companySchema.statics.getCompaniesByStatus = function(status) {
  return this.find({ status }).populate('assignedTo', 'firstName lastName email');
};

// Static method to get companies by industry
companySchema.statics.getCompaniesByIndustry = function(industry) {
  return this.find({ industry }).populate('assignedTo', 'firstName lastName email');
};

// Static method to get companies by assigned user
companySchema.statics.getCompaniesByUser = function(userId) {
  return this.find({ assignedTo: userId }).populate('assignedTo', 'firstName lastName email');
};

// Static method to get top customers by revenue
companySchema.statics.getTopCustomers = function(limit = 10) {
  return this.find({ type: 'Customer' })
    .sort({ totalRevenue: -1 })
    .limit(limit)
    .populate('assignedTo', 'firstName lastName email');
};

module.exports = mongoose.model('Company', companySchema); 