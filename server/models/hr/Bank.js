const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Bank name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Bank name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Bank code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Bank code cannot exceed 10 characters']
  },
  type: {
    type: String,
    enum: ['Commercial', 'Islamic', 'Investment', 'Central', 'Development', 'Other'],
    default: 'Commercial'
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    default: 'Pakistan'
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
  notes: String
}, {
  timestamps: true
});

// Indexes
bankSchema.index({ name: 1 });
bankSchema.index({ code: 1 });
bankSchema.index({ isActive: 1 });
bankSchema.index({ country: 1 });

// Static method to find active banks
bankSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find banks by country
bankSchema.statics.findByCountry = function(country) {
  return this.find({ country, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('Bank', bankSchema); 