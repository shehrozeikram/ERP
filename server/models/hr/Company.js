const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Company code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Company code cannot exceed 10 characters']
  },
  type: {
    type: String,
    enum: ['Private Limited', 'Public Limited', 'Partnership', 'Sole Proprietorship', 'Government', 'NGO', 'Other'],
    default: 'Private Limited'
  },
  industry: {
    type: String,
    trim: true,
    maxlength: [50, 'Industry cannot exceed 50 characters']
  },
  website: {
    type: String,
    trim: true
  },
  contactInfo: {
    phone: String,
    email: String,
    address: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date
  },
  notes: String,
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes
companySchema.index({ name: 1 });
companySchema.index({ code: 1 });
companySchema.index({ isActive: 1 });
companySchema.index({ type: 1 });

// Static method to find active companies
companySchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find companies by type
companySchema.statics.findByType = function(type) {
  return this.find({ type, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('PlacementCompany', companySchema); 