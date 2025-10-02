const mongoose = require('mongoose');

const vehicleLogBookSchema = new mongoose.Schema({
  logId: {
    type: String,
    required: true,
    unique: true,
    default: () => `VL${Date.now().toString().slice(-6)}`
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  startMileage: {
    type: Number,
    required: true,
    min: 0
  },
  endMileage: {
    type: Number,
    required: true,
    min: 0
  },
  distanceTraveled: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  purpose: {
    type: String,
    required: true,
    enum: ['Business', 'Personal', 'Maintenance', 'Training', 'Emergency'],
    default: 'Business'
  },
  startLocation: {
    type: String,
    required: true,
    trim: true
  },
  endLocation: {
    type: String,
    required: true,
    trim: true
  },
  fuelConsumed: {
    type: Number,
    min: 0,
    default: 0
  },
  fuelCost: {
    type: Number,
    min: 0,
    default: 0
  },
  tollCharges: {
    type: Number,
    min: 0,
    default: 0
  },
  parkingCharges: {
    type: Number,
    min: 0,
    default: 0
  },
  otherExpenses: {
    type: Number,
    min: 0,
    default: 0
  },
  totalExpenses: {
    type: Number,
    min: 0,
    default: 0
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: false,
    min: 0,
    default: 0
  },
  passengers: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null
    }
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Cancelled'],
    default: 'Active'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
vehicleLogBookSchema.index({ vehicleId: 1 });
vehicleLogBookSchema.index({ driverId: 1 });
vehicleLogBookSchema.index({ date: 1 });
vehicleLogBookSchema.index({ purpose: 1 });

// Virtual for fuel efficiency (km per liter)
vehicleLogBookSchema.virtual('fuelEfficiency').get(function() {
  if (this.fuelConsumed > 0) {
    return (this.distanceTraveled / this.fuelConsumed).toFixed(2);
  }
  return 0;
});

// Virtual for average speed (km/h)
vehicleLogBookSchema.virtual('averageSpeed').get(function() {
  if (this.duration > 0) {
    return ((this.distanceTraveled / this.duration) * 60).toFixed(2);
  }
  return 0;
});

// Pre-save middleware to calculate distance and duration
vehicleLogBookSchema.pre('save', function(next) {
  // Calculate distance traveled
  this.distanceTraveled = this.endMileage - this.startMileage;
  
  // Calculate duration in minutes
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  
  // Calculate total expenses
  this.totalExpenses = this.fuelCost + this.tollCharges + this.parkingCharges + this.otherExpenses;
  
  next();
});

// Pre-save middleware to update vehicle's current mileage
vehicleLogBookSchema.pre('save', async function(next) {
  if (this.isNew && this.status === 'Completed') {
    try {
      const Vehicle = mongoose.model('Vehicle');
      await Vehicle.findByIdAndUpdate(this.vehicleId, {
        currentMileage: this.endMileage
      });
    } catch (error) {
      console.error('Error updating vehicle mileage:', error);
    }
  }
  next();
});

module.exports = mongoose.model('VehicleLogBook', vehicleLogBookSchema);

