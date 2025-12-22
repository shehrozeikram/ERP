const mongoose = require('mongoose');

const indentSchema = new mongoose.Schema({
  // Indent Number (Auto-generated)
  indentNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Basic Information
  title: {
    type: String,
    required: [true, 'Indent title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Department and Requester
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required']
  },
  
  // Items
  items: [{
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unit: {
      type: String,
      trim: true,
      default: 'Piece'
    },
    estimatedCost: {
      type: Number,
      min: [0, 'Estimated cost cannot be negative'],
      default: 0
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium'
    },
    remarks: {
      type: String,
      trim: true
    }
  }],
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'],
    default: 'Draft'
  },
  
  // Dates
  requestedDate: {
    type: Date,
    default: Date.now
  },
  requiredDate: {
    type: Date
  },
  approvedDate: {
    type: Date
  },
  fulfilledDate: {
    type: Date
  },
  
  // Approval
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  
  // Financial Information
  totalEstimatedCost: {
    type: Number,
    default: 0,
    min: [0, 'Total estimated cost cannot be negative']
  },
  
  // Reference and Amount Information
  referenceNo: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    min: [0, 'Amount cannot be negative'],
    default: 0
  },
  
  // Additional Information
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  category: {
    type: String,
    trim: true,
    enum: ['Office Supplies', 'IT Equipment', 'Furniture', 'Maintenance', 'Raw Materials', 'Services', 'Other'],
    default: 'Other'
  },
  
  // Attachments
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Notes and Comments
  notes: {
    type: String,
    trim: true
  },
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
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

// Pre-save middleware to calculate total estimated cost
indentSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.totalEstimatedCost = this.items.reduce((total, item) => {
      return total + ((item.estimatedCost || 0) * (item.quantity || 0));
    }, 0);
  } else {
    this.totalEstimatedCost = 0;
  }
  next();
});

// Generate indent number
indentSchema.statics.generateIndentNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `IND-${year}-`;
  
  const lastIndent = await this.findOne({
    indentNumber: new RegExp(`^${prefix}`)
  }).sort({ indentNumber: -1 });
  
  let sequence = 1;
  if (lastIndent) {
    const lastSequence = parseInt(lastIndent.indentNumber.split('-').pop());
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }
  
  return `${prefix}${sequence.toString().padStart(5, '0')}`;
};

// Indexes
indentSchema.index({ indentNumber: 1 });
indentSchema.index({ status: 1 });
indentSchema.index({ department: 1 });
indentSchema.index({ requestedBy: 1 });
indentSchema.index({ requestedDate: -1 });
indentSchema.index({ category: 1 });
indentSchema.index({ priority: 1 });

module.exports = mongoose.model('Indent', indentSchema);

