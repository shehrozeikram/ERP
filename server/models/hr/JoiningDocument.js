const mongoose = require('mongoose');

const joiningDocumentSchema = new mongoose.Schema({
  // Approval and candidate references
  approvalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CandidateApproval',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },

  // Form data fields (all optional)
  employeeName: {
    type: String,
    required: false,
    trim: true
  },
  guardianRelation: {
    type: String,
    required: false,
    trim: true
  },
  guardianName: {
    type: String,
    required: false,
    trim: true
  },
  cnic: {
    type: String,
    required: false,
    trim: true
  },
  contactNo: {
    type: String,
    required: false,
    trim: true
  },
  dutyLocation: {
    type: String,
    required: false,
    trim: true
  },
  dutyDate: {
    type: Date,
    required: false
  },
  dutyTime: {
    type: String,
    required: false,
    trim: true
  },
  department: {
    type: String,
    required: false,
    trim: true
  },
  hodName: {
    type: String,
    required: false,
    trim: true
  },
  joiningRemarks: {
    type: String,
    required: false,
    trim: true
  },

  // Document status
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'submitted'
  },

  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: String,

  // Additional metadata
  formData: {
    type: mongoose.Schema.Types.Mixed, // Store complete form data as backup
    required: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
joiningDocumentSchema.index({ approvalId: 1 });
joiningDocumentSchema.index({ candidateId: 1 });
joiningDocumentSchema.index({ status: 1 });
joiningDocumentSchema.index({ submittedAt: 1 });

module.exports = mongoose.model('JoiningDocument', joiningDocumentSchema);
