const mongoose = require('mongoose');

const staffAssignmentSchema = new mongoose.Schema({
  assignmentId: {
    type: String,
    required: true,
    unique: true,
    default: () => `STAFF${Date.now().toString().slice(-6)}_${Math.random().toString(36).substr(2, 4)}`
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  // For guards and security - assigned to locations
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: false,
    default: null,
    validate: {
      validator: function(v) {
        // Allow null/empty for now
        if (v === null || v === undefined || v === '') {
          return true;
        }
        // If provided, validate it's a valid ObjectId
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Location ID must be provided for Guards, Security, Maintenance, and Driver assignments'
    }
  },
  // For office staff - assigned to departments
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false,
    default: null,
    validate: {
      validator: function(v) {
        // Allow null/empty for now
        if (v === null || v === undefined || v === '') {
          return true;
        }
        // If provided, validate it's a valid ObjectId
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Department ID must be provided for Office Staff, Office Boy, Admin Staff, and Receptionist assignments'
    }
  },
  assignmentType: {
    type: String,
    required: true,
    enum: [
      'Driver',          // Assigned to vehicles/locations
      'Office Boy',      // Assigned to departments (office support)
      'Guard',           // Assigned to locations (houses, offices, warehouses)
      'Security',        // Assigned to locations (security posts)
      'Office Staff',    // Assigned to departments (general office work)
      'Admin Staff',     // Assigned to departments (administrative work)
      'Maintenance',     // Assigned to locations (facility maintenance)
      'Receptionist',    // Assigned to departments (front desk)
      'Other'
    ],
    default: 'Office Staff'
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Transferred', 'Suspended'],
    default: 'Active'
  },
  // Additional fields for better management
  shiftTimings: {
    startTime: { type: String, default: '' }, // HH:MM format
    endTime: { type: String, default: '' },   // HH:MM format
    workingDays: { type: [String], default: [] }
  },
  responsibilities: [{
    type: String,
    trim: true
  }],
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false,
    default: null,
    validate: {
      validator: function(v) {
        // If provided, must be a valid ObjectId
        if (v !== null && v !== undefined && v !== '') {
          return mongoose.Types.ObjectId.isValid(v);
        }
        return true; // Allow null/empty
      },
      message: 'Reporting Manager ID must be a valid ObjectId or empty'
    }
  },
  notes: {
    type: String,
    trim: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
staffAssignmentSchema.index({ assignmentId: 1 });
staffAssignmentSchema.index({ staffId: 1 });
staffAssignmentSchema.index({ locationId: 1 });
staffAssignmentSchema.index({ departmentId: 1 });
staffAssignmentSchema.index({ status: 1 });
staffAssignmentSchema.index({ assignmentType: 1 });
staffAssignmentSchema.index({ reportingManager: 1 });

// Compound index to prevent duplicate active assignments - Temporarily disabled for debugging
// staffAssignmentSchema.index({ staffId: 1, status: 1 }, { 
//   partialFilterExpression: { status: 'Active' },
//   unique: true 
// });

// Virtual for assignment type description
staffAssignmentSchema.virtual('assignmentTypeDescription').get(function() {
  const descriptions = {
    'Guard': 'Security guard assigned to location',
    'Security': 'Security personnel for location',
    'Office Boy': 'Office support staff assigned to department',
    'Office Staff': 'General office staff assigned to department',
    'Admin Staff': 'Administrative staff assigned to department',
    'Receptionist': 'Front desk staff assigned to department',
    'Maintenance': 'Maintenance staff assigned to location',
    'Driver': 'Driver assigned to vehicle/location',
    'Other': 'Other staff assignment'
  };
  return descriptions[this.assignmentType] || 'Staff assignment';
});

// Method to get assignment details
staffAssignmentSchema.methods.getAssignmentDetails = function() {
  return {
    assignmentId: this.assignmentId,
    assignmentType: this.assignmentType,
    assignmentTypeDescription: this.assignmentTypeDescription,
    status: this.status,
    startDate: this.startDate,
    endDate: this.endDate,
    hasLocation: !!this.locationId,
    hasDepartment: !!this.departmentId
  };
};

module.exports = mongoose.model('StaffAssignment', staffAssignmentSchema);
