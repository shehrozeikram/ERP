const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true,
    maxlength: [100, 'Location name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Location code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Location code cannot exceed 10 characters']
  },
  type: {
    type: String,
    enum: ['Office', 'Branch', 'Site', 'Remote', 'Client Site', 'Other'],
    default: 'Office'
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'Pakistan'
    }
  },
  contactInfo: {
    phone: String,
    email: String,
    fax: String
  },
  capacity: {
    type: Number,
    min: [0, 'Capacity cannot be negative']
  },
  facilities: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
locationSchema.index({ name: 1 });
locationSchema.index({ code: 1 });
locationSchema.index({ type: 1 });
locationSchema.index({ isActive: 1 });
locationSchema.index({ 'address.city': 1 });
locationSchema.index({ 'address.country': 1 });

// Virtual for full address
locationSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Static method to find active locations
locationSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find locations by type
locationSchema.statics.findByType = function(type) {
  return this.find({ type, isActive: true }).sort({ name: 1 });
};

// Static method to find locations by city
locationSchema.statics.findByCity = function(city) {
  return this.find({ 'address.city': city, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('Location', locationSchema); 