const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  locationId: {
    type: String,
    required: true,
    unique: true,
    default: () => `LOC${Date.now().toString().slice(-6)}`
  },
  code: {
    type: String,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Office', 'House', 'Warehouse', 'Factory', 'Security Post', 'Other'],
    default: 'Office'
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  province: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true,
    default: 'Pakistan'
  },
  // Staff capacity management
  capacity: {
    type: Number,
    default: 1,
    min: 1
  },
  currentOccupancy: {
    type: Number,
    default: 0,
    min: 0
  },
  // Specific capacity for different staff types
  staffCapacity: {
    guards: { type: Number, default: 0 },
    security: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    drivers: { type: Number, default: 0 }
  },
  currentStaffCount: {
    guards: { type: Number, default: 0 },
    security: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    drivers: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Under Maintenance'],
    default: 'Active'
  },
  description: {
    type: String,
    trim: true
  },
  // Additional fields for better management
  facilities: [{
    type: String,
    trim: true
  }],
  securityLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Maximum'],
    default: 'Medium'
  },
  accessHours: {
    startTime: { type: String }, // HH:MM format
    endTime: { type: String },   // HH:MM format
    is24Hours: { type: Boolean, default: false }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
locationSchema.index({ locationId: 1 });
locationSchema.index({ type: 1 });
locationSchema.index({ status: 1 });
locationSchema.index({ city: 1 });
locationSchema.index({ province: 1 });

// Virtual for full address
locationSchema.virtual('fullAddress').get(function() {
  const parts = [this.address];
  if (this.city) parts.push(this.city);
  if (this.province) parts.push(this.province);
  if (this.country) parts.push(this.country);
  return parts.join(', ');
});

// Virtual for total staff capacity
locationSchema.virtual('totalStaffCapacity').get(function() {
  return this.staffCapacity.guards + this.staffCapacity.security + 
         this.staffCapacity.maintenance + this.staffCapacity.drivers;
});

// Virtual for current total staff count
locationSchema.virtual('currentTotalStaffCount').get(function() {
  return this.currentStaffCount.guards + this.currentStaffCount.security + 
         this.currentStaffCount.maintenance + this.currentStaffCount.drivers;
});

// Method to check if location can accommodate more staff of a specific type
locationSchema.methods.canAccommodateStaff = function(staffType) {
  const typeMap = {
    'Guard': 'guards',
    'Security': 'security',
    'Maintenance': 'maintenance',
    'Driver': 'drivers'
  };
  
  const capacityField = typeMap[staffType];
  if (!capacityField) return false;
  
  return this.currentStaffCount[capacityField] < this.staffCapacity[capacityField];
};

// Method to get location summary
locationSchema.methods.getLocationSummary = function() {
  return {
    locationId: this.locationId,
    name: this.name,
    type: this.type,
    fullAddress: this.fullAddress,
    status: this.status,
    totalStaffCapacity: this.totalStaffCapacity,
    currentTotalStaffCount: this.currentTotalStaffCount,
    securityLevel: this.securityLevel,
    is24Hours: this.accessHours?.is24Hours || false
  };
};

module.exports = mongoose.model('Location', locationSchema);