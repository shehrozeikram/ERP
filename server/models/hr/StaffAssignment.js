const mongoose = require('mongoose');

const staffAssignmentSchema = new mongoose.Schema({
  assignmentId: {
    type: String,
    required: true,
    unique: true,
    default: () => `STAFF${Date.now().toString().slice(-6)}`
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
    required: function() {
      return ['Guard', 'Security', 'Maintenance'].includes(this.assignmentType);
    }
  },
  // For office staff - assigned to departments
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: function() {
      return ['Office Staff', 'Office Boy', 'Receptionist', 'Admin Staff'].includes(this.assignmentType);
    }
  },
  assignmentType: {
    type: String,
    required: true,
    enum: [
      'Guard',           // Assigned to locations (houses, offices, warehouses)
      'Security',        // Assigned to locations (security posts)
      'Office Boy',      // Assigned to departments (office support)
      'Office Staff',    // Assigned to departments (general office work)
      'Admin Staff',     // Assigned to departments (administrative work)
      'Receptionist',    // Assigned to departments (front desk)
      'Maintenance',     // Assigned to locations (facility maintenance)
      'Driver',          // Assigned to vehicles/locations
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
    startTime: { type: String }, // HH:MM format
    endTime: { type: String },   // HH:MM format
    workingDays: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }]
  },
  responsibilities: [{
    type: String,
    trim: true
  }],
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
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

// Compound index to prevent duplicate active assignments
staffAssignmentSchema.index({ staffId: 1, status: 1 }, { 
  partialFilterExpression: { status: 'Active' },
  unique: true 
});

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
