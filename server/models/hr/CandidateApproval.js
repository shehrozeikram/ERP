const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const candidateApprovalSchema = new mongoose.Schema({
  // Candidate Information
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  
  // Job Posting Information
  jobPosting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },
  
  // Application Information
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  
  // Approval Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  
  // Current Approval Level
  currentLevel: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  
  // Approval Levels (1-5)
  approvalLevels: [{
    level: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    title: {
      type: String,
      required: true,
      enum: ['Assistant Manager HR', 'Manager HR', 'HOD HR', 'Vice President', 'CEO']
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approverEmail: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    rejectedAt: Date,
    comments: String,
    signature: {
      type: String, // Base64 encoded signature image
      default: null
    },
    emailSentAt: Date,
    emailDeliveredAt: Date,
    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    }
  }],
  
  // Approval Timeline
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  
  // Final Decision
  finalDecision: {
    type: String,
    enum: ['approved', 'rejected'],
    default: undefined
  },
  finalDecisionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  finalDecisionAt: Date,
  finalComments: String,
  
  // Documents
  candidateDocuments: {
    resume: String,
    coverLetter: String,
    interviewFeedback: String,
    technicalTestResults: String,
    referenceChecks: String
  },
  
  // Email Tracking
  emailNotifications: [{
    type: {
      type: String,
      enum: ['approval_request', 'approval_reminder', 'approval_completed', 'appointment_letter', 'hiring_confirmation'],
      required: true
    },
    level: Number,
    sentTo: String,
    sentAt: Date,
    deliveredAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    },
    messageId: String,
    errorMessage: String
  }],
  
  // Audit Trail
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

// Pre-save middleware to set approval levels
candidateApprovalSchema.pre('save', function(next) {
  if (this.isNew) {
    // Set up the 5 approval levels
    this.approvalLevels = [
      {
        level: 1,
        title: 'Assistant Manager HR',
        status: 'pending',
        approverEmail: 'assistant.hr@company.com' // Default email, can be updated
      },
      {
        level: 2,
        title: 'Manager HR',
        status: 'pending',
        approverEmail: 'manager.hr@company.com' // Default email, can be updated
      },
      {
        level: 3,
        title: 'HOD HR',
        status: 'pending',
        approverEmail: 'hod.hr@company.com' // Default email, can be updated
      },
      {
        level: 4,
        title: 'Vice President',
        status: 'pending',
        approverEmail: 'vp@company.com' // Default email, can be updated
      },
      {
        level: 5,
        title: 'CEO',
        status: 'pending',
        approverEmail: 'ceo@company.com' // Default email, can be updated
      }
    ];
  }
  next();
});

// Virtual for approval progress
candidateApprovalSchema.virtual('progress').get(function() {
  const approvedLevels = this.approvalLevels.filter(level => level.status === 'approved').length;
  return Math.round((approvedLevels / 5) * 100);
});

// Virtual for next approver
candidateApprovalSchema.virtual('nextApprover').get(function() {
  const pendingLevel = this.approvalLevels.find(level => level.status === 'pending');
  return pendingLevel || null;
});

// Virtual for is completed
candidateApprovalSchema.virtual('isCompleted').get(function() {
  return this.status === 'approved' || this.status === 'rejected';
});

// Static method to get approval by candidate
candidateApprovalSchema.statics.findByCandidate = function(candidateId) {
  return this.findOne({ candidate: candidateId })
    .populate('candidate', 'firstName lastName email phone')
    .populate('jobPosting', 'title department')
    .populate('application', 'applicationId')
    .populate('approvalLevels.approver', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName');
};

// Static method to get pending approvals for a user
candidateApprovalSchema.statics.findPendingForUser = function(userEmail) {
  return this.find({
    'approvalLevels.approverEmail': userEmail,
    'approvalLevels.status': 'pending',
    status: { $in: ['pending', 'in_progress'] }
  })
    .populate('candidate', 'firstName lastName email phone')
    .populate('jobPosting', 'title department')
    .populate('application', 'applicationId')
    .populate('approvalLevels.approver', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName');
};

// Add pagination plugin
candidateApprovalSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('CandidateApproval', candidateApprovalSchema); 