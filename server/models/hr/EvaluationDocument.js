const mongoose = require('mongoose');

const evaluationDocumentSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  evaluator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  formType: {
    type: String,
    enum: ['blue_collar', 'white_collar'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'in_progress', 'submitted', 'completed', 'archived'],
    default: 'draft'
  },
  // Employee Information
  code: String,
  date: Date,
  name: String,
  reviewPeriodFrom: Date,
  reviewPeriodTo: Date,
  designation: String,
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  immediateBoss: String,
  appraisalHistory: String,
  
  // Evaluation Data
  evaluationScores: mongoose.Schema.Types.Mixed, // For Blue Collar
  whiteCollarProfessionalScores: mongoose.Schema.Types.Mixed, // For White Collar
  whiteCollarPersonalScores: mongoose.Schema.Types.Mixed, // For White Collar
  
  // Overall Result
  overallResult: String,
  totalScore: Number,
  percentage: Number,
  
  // Comments
  strength: String,
  weakness: String,
  otherComments: String,
  
  // White Collar specific fields
  reportingOfficerComments: String,
  reportingOfficerName: String,
  reportingOfficerDate: Date,
  counterSigningOfficerComments: String,
  counterSigningOfficerName: String,
  counterSigningOfficerDate: Date,
  developmentPlan: String,
  recommendedByHOD: String,
  recommendedByHR: String,
  developmentPlanObjectives: [{
    objective: String,
    who: String,
    when: String,
    where: String
  }],
  developmentPlanResult: String,
  employeeSignature: String,
  employeeSignatureDate: Date,
  headOfHRSignature: String,
  headOfHRDate: Date,
  
  // Metadata
  sentAt: Date,
  submittedAt: Date,
  completedAt: Date,
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  accessToken: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Approval System
  approvalStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected'],
    default: 'pending'
  },
  currentApprovalLevel: {
    type: Number,
    min: 1,
    max: 4,
    default: null
  },
  approvalLevels: [{
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 4
    },
    title: {
      type: String,
      required: true
    },
    approverName: {
      type: String,
      required: true
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    rejectedAt: Date,
    comments: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Pre-save middleware to initialize approval levels when status changes to 'submitted'
evaluationDocumentSchema.pre('save', async function(next) {
  // Only initialize approval if status is being changed to 'submitted' and approval levels don't exist
  if (this.isModified('status') && this.status === 'submitted' && (!this.approvalLevels || this.approvalLevels.length === 0)) {
    const approvalLevels = [
      {
        level: 1,
        title: 'Assistant Vice President / CHRO SGC',
        approverName: 'Fahad Fareed',
        status: 'pending'
      },
      {
        level: 2,
        title: 'Chairman Steering Committee',
        approverName: 'Ahmad Tansim',
        status: 'pending'
      },
      {
        level: 3,
        title: 'CEO SGC',
        approverName: 'Sardar Umer Tanveer',
        status: 'pending'
      },
      {
        level: 4,
        title: 'President SGC',
        approverName: 'Sardar Tanveer Ilyas',
        status: 'pending'
      }
    ];
    
    this.approvalLevels = approvalLevels;
    this.approvalStatus = 'pending';
    this.currentApprovalLevel = 1;
    
    // Try to find and link approvers by name
    for (let i = 0; i < approvalLevels.length; i++) {
      const approver = await Employee.findOne({
        $or: [
          { firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') }, 
            lastName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ').slice(1).join(' '), 'i') } },
          { firstName: { $regex: new RegExp(approvalLevels[i].approverName.split(' ')[0], 'i') } }
        ]
      });
      
      if (approver) {
        this.approvalLevels[i].approver = approver._id;
      }
    }
  }
  
  // Update approval status based on levels
  if (this.approvalLevels && this.approvalLevels.length > 0) {
    const allApproved = this.approvalLevels.every(level => level.status === 'approved');
    const anyRejected = this.approvalLevels.some(level => level.status === 'rejected');
    
    if (anyRejected) {
      this.approvalStatus = 'rejected';
    } else if (allApproved) {
      this.approvalStatus = 'approved';
      this.status = 'completed';
      this.completedAt = new Date();
    } else {
      this.approvalStatus = 'in_progress';
    }
  }
  
  next();
});

// Indexes for better query performance
evaluationDocumentSchema.index({ employee: 1, status: 1 });
evaluationDocumentSchema.index({ evaluator: 1, status: 1 });
evaluationDocumentSchema.index({ department: 1, status: 1 });
evaluationDocumentSchema.index({ formType: 1, status: 1 });
evaluationDocumentSchema.index({ accessToken: 1 });
evaluationDocumentSchema.index({ approvalStatus: 1, currentApprovalLevel: 1 });

module.exports = mongoose.model('EvaluationDocument', evaluationDocumentSchema);

