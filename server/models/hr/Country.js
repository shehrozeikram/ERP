const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Country name is required'],
    trim: true,
    maxlength: [100, 'Country name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Country code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [3, 'Country code cannot exceed 3 characters']
  },
  iso3: {
    type: String,
    required: [true, 'ISO3 code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [3, 'ISO3 code cannot exceed 3 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  capital: {
    type: String,
    trim: true
  },
  population: {
    type: Number,
    min: [0, 'Population cannot be negative']
  },
  area: {
    type: Number,
    min: [0, 'Area cannot be negative']
  },
  currency: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    trim: true
  },
  timezone: {
    type: String,
    trim: true
  },
  phoneCode: {
    type: String,
    trim: true
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
countrySchema.index({ name: 1 });
countrySchema.index({ code: 1 });
countrySchema.index({ iso3: 1 });
countrySchema.index({ isActive: 1 });

// Virtual for full country info
countrySchema.virtual('fullInfo').get(function() {
  return `${this.name} (${this.code})`;
});

// Static method to find active countries
countrySchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find country by code
countrySchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase(), isActive: true });
};

module.exports = mongoose.model('Country', countrySchema); 