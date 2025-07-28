const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
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
    match: [/^[\+]?[0-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  mobile: {
    type: String,
    trim: true,
    match: [/^[\+]?[0-9][\d]{0,15}$/, 'Please enter a valid mobile number']
  },
  jobTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters']
  },

  // Company Information
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  },
  isPrimaryContact: {
    type: Boolean,
    default: false
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

  // Contact Details
  type: {
    type: String,
    enum: ['Customer', 'Prospect', 'Partner', 'Vendor', 'Other'],
    default: 'Customer'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Lead', 'Prospect'],
    default: 'Active'
  },
  source: {
    type: String,
    enum: ['Website', 'Referral', 'Cold Call', 'Trade Show', 'Advertisement', 'Email Campaign', 'Social Media', 'Other'],
    default: 'Website'
  },

  // Communication Preferences
  preferredContactMethod: {
    type: String,
    enum: ['Email', 'Phone', 'Mobile', 'Mail'],
    default: 'Email'
  },
  doNotContact: {
    type: Boolean,
    default: false
  },
  marketingOptIn: {
    type: Boolean,
    default: true
  },

  // Social Media
  socialMedia: {
    linkedin: String,
    twitter: String,
    facebook: String
  },

  // Additional Information
  birthday: {
    type: Date
  },
  anniversary: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },

  // Activity Tracking
  lastContactDate: {
    type: Date
  },
  contactCount: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: Number,
    default: 0
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

  // Custom Fields
  customFields: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
contactSchema.index({ email: 1 });
contactSchema.index({ company: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ assignedTo: 1 });
contactSchema.index({ type: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ 'address.city': 1, 'address.state': 1 });

// Virtual for full name
contactSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for full address
contactSchema.virtual('fullAddress').get(function() {
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.zipCode,
    this.address.country
  ].filter(Boolean);
  return parts.join(', ');
});

// Method to update last contact
contactSchema.methods.updateLastContact = function() {
  this.lastContactDate = new Date();
  this.contactCount += 1;
  return this.save();
};

// Static method to get contacts by type
contactSchema.statics.getContactsByType = function(type) {
  return this.find({ type }).populate('company', 'name industry').populate('assignedTo', 'firstName lastName email');
};

// Static method to get contacts by status
contactSchema.statics.getContactsByStatus = function(status) {
  return this.find({ status }).populate('company', 'name industry').populate('assignedTo', 'firstName lastName email');
};

// Static method to get contacts by assigned user
contactSchema.statics.getContactsByUser = function(userId) {
  return this.find({ assignedTo: userId }).populate('company', 'name industry').populate('assignedTo', 'firstName lastName email');
};

// Static method to get primary contacts
contactSchema.statics.getPrimaryContacts = function() {
  return this.find({ isPrimaryContact: true }).populate('company', 'name industry').populate('assignedTo', 'firstName lastName email');
};

module.exports = mongoose.model('Contact', contactSchema); 