const mongoose = require('mongoose');

const preAuditSchema = new mongoose.Schema({
  // Document Information
  documentNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Document title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Source Department Information
  sourceDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true
  },
  sourceDepartmentName: {
    type: String,
    required: true,
    trim: true
  },
  sourceModule: {
    type: String,
    required: true,
    enum: ['hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'it', 'general', 'taj_residencia'],
    index: true
  },
  
  // Document Type
  documentType: {
    type: String,
    required: true,
    enum: ['invoice', 'receipt', 'agreement', 'report', 'statement', 'certificate', 'license', 'permit', 'other'],
    index: true
  },
  
  // Document Details
  documentDate: {
    type: Date,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    min: 0
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    fileType: String,
    fileSize: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['pending', 'under_review', 'forwarded_to_director', 'approved', 'returned_with_observations', 'rejected'],
    default: 'pending',
    index: true
  },
  
  // Review and Approval
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewComments: String,
  
  // Forward to Audit Director
  forwardedTo: {
    type: String,
    enum: ['audit_director', null],
    default: null
  },
  forwardedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  forwardedAt: Date,
  forwardComments: String,
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalComments: String,
  
  // Observations
  observations: [{
    observation: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Return Information
  returnedToDepartment: {
    type: Boolean,
    default: false
  },
  returnedAt: Date,
  returnComments: String,
  returnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Response from Department
  departmentResponse: {
    response: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date,
    attachments: [{
      filename: String,
      originalName: String,
      path: String,
      uploadedAt: Date
    }]
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  
  // Due Date for Review
  reviewDueDate: {
    type: Date,
    index: true
  },
  
  // Tags for categorization
  tags: [{
    type: String,
    trim: true
  }],
  
  // Metadata
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
preAuditSchema.index({ sourceDepartment: 1, status: 1 });
preAuditSchema.index({ sourceModule: 1, status: 1 });
preAuditSchema.index({ documentType: 1, status: 1 });
preAuditSchema.index({ status: 1, reviewDueDate: 1 });
preAuditSchema.index({ submittedBy: 1, status: 1 });

// Generate document number before saving
preAuditSchema.pre('save', async function(next) {
  if (!this.isNew || this.documentNumber) {
    return next();
  }
  
  try {
    const count = await mongoose.model('PreAudit').countDocuments();
    this.documentNumber = `PA-${String(count + 1).padStart(6, '0')}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('PreAudit', preAuditSchema);

