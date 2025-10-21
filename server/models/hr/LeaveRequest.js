const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  leaveType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveType',
    required: [true, 'Leave type is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  totalDays: {
    type: Number,
    required: [true, 'Total days is required'],
    min: [0.5, 'Total days must be at least 0.5'],
    max: [365, 'Total days cannot exceed 365']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  appliedDate: {
    type: Date,
    default: Date.now
  },
  approvedDate: Date,
  rejectedDate: Date,
  cancelledDate: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalComments: {
    type: String,
    trim: true,
    maxlength: [500, 'Approval comments cannot exceed 500 characters']
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  // Emergency leave flag
  isEmergency: {
    type: Boolean,
    default: false
  },
  // Half day leave support
  isHalfDay: {
    type: Boolean,
    default: false
  },
  halfDayType: {
    type: String,
    enum: ['first_half', 'second_half'],
    required: function() {
      return this.isHalfDay === true;
    }
  },
  // Medical certificate
  medicalCertificate: {
    fileName: String,
    filePath: String,
    uploadedDate: Date
  },
  // Work handover
  workHandover: {
    type: String,
    trim: true,
    maxlength: [1000, 'Work handover cannot exceed 1000 characters']
  },
  // Contact during leave
  contactDuringLeave: {
    phone: String,
    email: String,
    availableHours: String
  },
  // Auto-generated fields
  leaveYear: {
    type: Number,
    required: true
  },
  workYear: {
    type: Number,
    required: true,
    min: [1, 'Work year must be 1 or later'],
    max: [50, 'Work year must be less than 50']
  },
  // Integration with attendance
  attendanceRecords: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance'
  }],
  // Integration with payroll
  payrollDeduction: {
    type: Number,
    default: 0,
    min: [0, 'Payroll deduction cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
leaveRequestSchema.index({ employee: 1, status: 1 });
leaveRequestSchema.index({ leaveType: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });
leaveRequestSchema.index({ status: 1 });
leaveRequestSchema.index({ leaveYear: 1 });
leaveRequestSchema.index({ workYear: 1 });
leaveRequestSchema.index({ employee: 1, workYear: 1 });
leaveRequestSchema.index({ appliedDate: -1 });

// Pre-save middleware to calculate total days and leave year
leaveRequestSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    // Calculate total days (including both start and end dates)
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    // For half day, adjust calculation
    if (this.isHalfDay) {
      this.totalDays = 0.5;
    } else {
      this.totalDays = daysDiff;
    }
    
    // Set leave year based on start date
    this.leaveYear = this.startDate.getFullYear();
  }
  next();
});

// Virtual for leave duration in readable format
leaveRequestSchema.virtual('duration').get(function() {
  if (this.isHalfDay) {
    return this.halfDayType === 'first_half' ? 'First Half' : 'Second Half';
  }
  return `${this.totalDays} day${this.totalDays > 1 ? 's' : ''}`;
});

// Static method to get leave requests by employee and year
leaveRequestSchema.statics.getEmployeeLeavesByYear = async function(employeeId, year) {
  return this.find({
    employee: employeeId,
    leaveYear: year,
    isActive: true
  }).populate('leaveType', 'name code color');
};

// Static method to get pending leave requests
leaveRequestSchema.statics.getPendingRequests = async function() {
  return this.find({
    status: 'pending',
    isActive: true
  }).populate('employee', 'firstName lastName employeeId')
    .populate('leaveType', 'name code color')
    .sort({ appliedDate: -1 });
};

// Instance method to check if leave can be cancelled
leaveRequestSchema.methods.canBeCancelled = function() {
  const today = new Date();
  return this.status === 'approved' && this.startDate > today;
};

// Instance method to check if leave is active
leaveRequestSchema.methods.isActiveLeave = function() {
  const today = new Date();
  return this.status === 'approved' && 
         this.startDate <= today && 
         this.endDate >= today;
};

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);

