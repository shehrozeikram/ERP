const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Leave type name is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Leave type name cannot exceed 50 characters']
  },
  code: {
    type: String,
    required: [true, 'Leave type code is required'],
    trim: true,
    unique: true,
    uppercase: true,
    maxlength: [10, 'Leave type code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  daysPerYear: {
    type: Number,
    required: [true, 'Days per year is required'],
    min: [0, 'Days per year cannot be negative'],
    max: [365, 'Days per year cannot exceed 365']
  },
  isPaid: {
    type: Boolean,
    default: true
  },
  requiresApproval: {
    type: Boolean,
    default: true
  },
  maxConsecutiveDays: {
    type: Number,
    default: null,
    min: [1, 'Max consecutive days must be at least 1']
  },
  advanceNoticeDays: {
    type: Number,
    default: 0,
    min: [0, 'Advance notice days cannot be negative']
  },
  carryForwardAllowed: {
    type: Boolean,
    default: false
  },
  maxCarryForwardDays: {
    type: Number,
    default: 0,
    min: [0, 'Max carry forward days cannot be negative']
  },
  applicableForProbation: {
    type: Boolean,
    default: true
  },
  applicableForContract: {
    type: Boolean,
    default: true
  },
  applicableForPermanent: {
    type: Boolean,
    default: true
  },
  requiresMedicalCertificate: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#3B82F6',
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: String
}, {
  timestamps: true
});

// Indexes for better query performance
leaveTypeSchema.index({ name: 1 });
leaveTypeSchema.index({ code: 1 });
leaveTypeSchema.index({ isActive: 1 });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);

