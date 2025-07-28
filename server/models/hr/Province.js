const mongoose = require('mongoose');

const provinceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Province name is required'],
    trim: true,
    maxlength: [100, 'Province name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Province code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Province code cannot exceed 10 characters']
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
  notes: String
}, {
  timestamps: true
});

// Indexes
provinceSchema.index({ name: 1 });
provinceSchema.index({ code: 1 });
provinceSchema.index({ country: 1 });
provinceSchema.index({ isActive: 1 });

// Virtual for full province info
provinceSchema.virtual('fullInfo').get(function() {
  return `${this.name}`;
});

// Static method to find active provinces
provinceSchema.statics.findActive = function() {
  return this.find({ isActive: true })
    .populate('country', 'name code')
    .sort({ name: 1 });
};

// Static method to find provinces by country
provinceSchema.statics.findByCountry = function(countryId) {
  return this.find({ country: countryId, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('Province', provinceSchema); 