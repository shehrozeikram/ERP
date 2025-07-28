const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'City name is required'],
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'City code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'City code cannot exceed 10 characters']
  },
  province: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Province',
    required: [true, 'Province is required']
  },
  country: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: [true, 'Country is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  population: {
    type: Number,
    min: [0, 'Population cannot be negative']
  },
  timezone: {
    type: String,
    trim: true
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
citySchema.index({ name: 1 });
citySchema.index({ code: 1 });
citySchema.index({ province: 1 });
citySchema.index({ country: 1 });
citySchema.index({ isActive: 1 });

// Virtual for full city info
citySchema.virtual('fullInfo').get(function() {
  return `${this.name}`;
});

// Static method to find active cities
citySchema.statics.findActive = function() {
  return this.find({ isActive: true })
    .populate('province', 'name code')
    .populate('country', 'name code')
    .sort({ name: 1 });
};

// Static method to find cities by province
citySchema.statics.findByProvince = function(provinceId) {
  return this.find({ province: provinceId, isActive: true }).sort({ name: 1 });
};

// Static method to find cities by country
citySchema.statics.findByCountry = function(countryId) {
  return this.find({ country: countryId, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('City', citySchema); 