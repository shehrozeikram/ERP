const mongoose = require('mongoose');

const joiningDocumentSchema = new mongoose.Schema({
  documentType: {
    type: String,
    required: true,
    enum: ['CNIC', 'Passport', 'Driving License', 'Birth Certificate', 'Educational Certificate', 'Experience Certificate', 'Other']
  },
  documentNumber: {
    type: String,
    required: true
  },
  issuingAuthority: {
    type: String,
    required: true
  },
  issueDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date
  },
  documentFile: {
    type: String // File path or URL
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDate: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
});

const employeeOnboardingSchema = new mongoose.Schema({
  // Reference fields
  approvalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CandidateApproval',
    required: true
  },
  
  // Employee record (created when onboarding is completed)
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Onboarding status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'rejected'],
    default: 'pending'
  },
  
  // Document collection
  joiningDocuments: [joiningDocumentSchema],
  
  // Onboarding tasks tracking
  onboardingTasks: [{
    taskName: {
      type: String,
      required: true
    },
    description: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dueDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    completedDate: Date,
    notes: String
  }],
  
  // Training requirements tracking
  trainingRequirements: [{
    trainingName: String,
    description: String,
    isRequired: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    },
    completionDate: Date,
    certificate: String
  }],
  
  // Equipment and access setup
  equipmentAndAccess: {
    computer: {
      type: Boolean,
      default: false
    },
    email: {
      type: Boolean,
      default: false
    },
    systemAccess: {
      type: Boolean,
      default: false
    },
    officeSpace: {
      type: Boolean,
      default: false
    },
    otherEquipment: [String]
  },
  
  // Notes and tracking
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
employeeOnboardingSchema.index({ approvalId: 1, status: 1 });
employeeOnboardingSchema.index({ employeeId: 1 });

module.exports = mongoose.model('EmployeeOnboarding', employeeOnboardingSchema);
