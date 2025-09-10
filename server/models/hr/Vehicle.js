const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  make: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true,
    min: 1990,
    max: new Date().getFullYear() + 1
  },
  licensePlate: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Available', 'In Use', 'Maintenance', 'Retired'],
    default: 'Available'
  },
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  fuelType: {
    type: String,
    enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'],
    default: 'Petrol'
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  currentMileage: {
    type: Number,
    default: 0,
    min: 0
  },
  lastServiceDate: {
    type: Date,
    default: null
  },
  nextServiceDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
vehicleSchema.index({ vehicleId: 1 });
vehicleSchema.index({ licensePlate: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ assignedDriver: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
