const mongoose = require('mongoose');

const employeeIncrementSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required'],
    index: true
  },
  incrementType: {
    type: String,
    enum: ['annual', 'performance', 'special', 'market_adjustment'],
    required: [true, 'Increment type is required'],
    default: 'annual'
  },
  previousSalary: {
    type: Number,
    required: [true, 'Previous salary is required'],
    min: [0, 'Previous salary cannot be negative']
  },
  newSalary: {
    type: Number,
    required: [true, 'New salary is required'],
    min: [0, 'New salary cannot be negative']
  },
  incrementAmount: {
    type: Number,
    required: [true, 'Increment amount is required'],
    min: [0, 'Increment amount cannot be negative']
  },
  incrementPercentage: {
    type: Number,
    required: [true, 'Increment percentage is required'],
    min: [0, 'Increment percentage cannot be negative']
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'implemented'],
    default: 'pending',
    index: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requested by is required']
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  effectiveDate: {
    type: Date,
    required: [true, 'Effective date is required']
  },
  comments: {
    type: String,
    trim: true,
    maxlength: [1000, 'Comments cannot exceed 1000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
employeeIncrementSchema.index({ employee: 1, status: 1 });
employeeIncrementSchema.index({ effectiveDate: 1, status: 1 });
employeeIncrementSchema.index({ incrementType: 1, status: 1 });

// Virtual for increment summary
employeeIncrementSchema.virtual('incrementSummary').get(function() {
  return `${this.incrementType} increment of ${this.incrementPercentage}% (Rs. ${this.incrementAmount.toLocaleString()})`;
});

// Pre-save middleware to calculate increment amount and percentage
employeeIncrementSchema.pre('save', function(next) {
  if (this.isModified('previousSalary') || this.isModified('newSalary')) {
    this.incrementAmount = this.newSalary - this.previousSalary;
    this.incrementPercentage = this.previousSalary > 0 ? 
      ((this.incrementAmount / this.previousSalary) * 100).toFixed(2) : 0;
  }
  next();
});

// Static method to get employee's latest increment
employeeIncrementSchema.statics.getLatestIncrement = function(employeeId) {
  return this.findOne({
    employee: employeeId,
    status: 'implemented'
  }).sort({ effectiveDate: -1 });
};

// Static method to get pending increments
employeeIncrementSchema.statics.getPendingIncrements = function() {
  return this.find({ status: 'pending' })
    .populate('employee', 'employeeId firstName lastName department position salary.gross')
    .populate('requestedBy', 'firstName lastName')
    .sort({ requestDate: -1 });
};

// Index for efficient queries
employeeIncrementSchema.index({ employee: 1, status: 1 });
employeeIncrementSchema.index({ status: 1, effectiveDate: -1 });
employeeIncrementSchema.index({ requestDate: -1 });
employeeIncrementSchema.index({ employee: 1, effectiveDate: -1 });

module.exports = mongoose.model('EmployeeIncrement', employeeIncrementSchema);
