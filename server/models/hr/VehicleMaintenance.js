const mongoose = require('mongoose');

const vehicleMaintenanceSchema = new mongoose.Schema({
  maintenanceId: {
    type: String,
    required: true,
    unique: true,
    default: () => `VM${Date.now().toString().slice(-6)}`
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  maintenanceType: {
    type: String,
    required: true,
    enum: ['Routine', 'Repair', 'Inspection', 'Emergency', 'Preventive'],
    default: 'Routine'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  serviceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  nextServiceDate: {
    type: Date,
    default: null
  },
  serviceProvider: {
    type: String,
    required: true,
    trim: true
  },
  contactNumber: {
    type: String,
    trim: true
  },
  partsReplaced: [{
    partName: {
      type: String,
      required: true,
      trim: true
    },
    partNumber: {
      type: String,
      trim: true
    },
    cost: {
      type: Number,
      required: true,
      min: 0
    },
    warranty: {
      type: String,
      trim: true
    }
  }],
  mileageAtService: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  estimatedDuration: {
    type: Number, // in hours
    min: 0
  },
  actualDuration: {
    type: Number, // in hours
    min: 0
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  attachments: [{
    fileName: String,
    filePath: String,
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
vehicleMaintenanceSchema.index({ vehicleId: 1 });
vehicleMaintenanceSchema.index({ serviceDate: 1 });
vehicleMaintenanceSchema.index({ status: 1 });
vehicleMaintenanceSchema.index({ maintenanceType: 1 });

// Virtual for total parts cost
vehicleMaintenanceSchema.virtual('totalPartsCost').get(function() {
  return this.partsReplaced.reduce((total, part) => total + part.cost, 0);
});

// Virtual for total maintenance cost (service cost + parts cost)
vehicleMaintenanceSchema.virtual('totalMaintenanceCost').get(function() {
  return this.cost + this.totalPartsCost;
});

// Pre-save middleware to update vehicle's lastServiceDate and currentMileage
vehicleMaintenanceSchema.pre('save', async function(next) {
  if (this.isNew && this.status === 'Completed') {
    try {
      const Vehicle = mongoose.model('Vehicle');
      await Vehicle.findByIdAndUpdate(this.vehicleId, {
        lastServiceDate: this.serviceDate,
        currentMileage: this.mileageAtService,
        nextServiceDate: this.nextServiceDate
      });
    } catch (error) {
      console.error('Error updating vehicle maintenance info:', error);
    }
  }
  next();
});

module.exports = mongoose.model('VehicleMaintenance', vehicleMaintenanceSchema);

