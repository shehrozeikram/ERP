const mongoose = require('mongoose');

const indentSchema = new mongoose.Schema({
  // Indent Number (Auto-generated)
  indentNumber: {
    type: String,
    required: false, // Will be auto-generated in pre-save middleware
    unique: true,
    sparse: true,
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
    brand: {
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
    purpose: {
      type: String,
      trim: true
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
  erpRef: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  amount: {
    type: Number,
    min: [0, 'Amount cannot be negative'],
    default: 0
  },
  
  // Justification
  justification: {
    type: String,
    trim: true
  },
  
  // Signatures
  signatures: {
    requester: {
      name: {
        type: String,
        trim: true
      },
      date: {
        type: Date
      }
    },
    headOfDepartment: {
      name: {
        type: String,
        trim: true
      },
      date: {
        type: Date
      }
    },
    gmPd: {
      name: {
        type: String,
        trim: true
      },
      date: {
        type: Date
      }
    },
    svpAvp: {
      name: {
        type: String,
        trim: true
      },
      date: {
        type: Date
      }
    }
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

// Generate ERP Ref number (PR #1, PR #2, etc.)
indentSchema.statics.generateERPRef = async function() {
  // Find the highest ERP Ref number
  const lastIndent = await this.findOne({
    erpRef: { $exists: true, $ne: '' }
  }).sort({ erpRef: -1 });
  
  let sequence = 1;
  if (lastIndent && lastIndent.erpRef) {
    // Extract numeric part from "PR #12" format
    const match = lastIndent.erpRef.match(/#?(\d+)/);
    if (match && match[1]) {
      const lastNum = parseInt(match[1]);
      if (!isNaN(lastNum)) {
        sequence = lastNum + 1;
      }
    }
  }
  
  return `PR #${sequence}`;
};

// Pre-save middleware to calculate total estimated cost and generate ERP Ref and Indent Number
indentSchema.pre('save', async function(next) {
  // Calculate total estimated cost
  if (this.items && this.items.length > 0) {
    this.totalEstimatedCost = this.items.reduce((total, item) => {
      return total + ((item.estimatedCost || 0) * (item.quantity || 0));
    }, 0);
  } else {
    this.totalEstimatedCost = 0;
  }
  
  // Auto-generate Indent Number if not provided and this is a new document
  if ((!this.indentNumber || this.indentNumber.trim() === '') && this.isNew) {
    try {
      this.indentNumber = await this.constructor.generateIndentNumber();
    } catch (error) {
      return next(error);
    }
  }
  
  // Auto-generate ERP Ref if not provided and this is a new document
  if ((!this.erpRef || this.erpRef.trim() === '') && this.isNew) {
    try {
      this.erpRef = await this.constructor.generateERPRef();
    } catch (error) {
      return next(error);
    }
  }
  
  // Ensure indentNumber and erpRef are set (required for validation)
  if (!this.indentNumber || this.indentNumber.trim() === '') {
    return next(new Error('Indent Number is required'));
  }
  
  if (!this.erpRef || this.erpRef.trim() === '') {
    return next(new Error('ERP Ref is required'));
  }
  
  next();
});

// Generate indent number (simple auto-increment: 1, 2, 3, etc.)
indentSchema.statics.generateIndentNumber = async function() {
  // Find the highest numeric indent number
  const lastIndent = await this.findOne({
    indentNumber: { $exists: true, $ne: '' }
  }).sort({ indentNumber: -1 });
  
  let sequence = 1;
  if (lastIndent && lastIndent.indentNumber) {
    // Extract numeric part (handle both formats: "21964" or "IND-2025-00001" or just "1")
    const numericPart = lastIndent.indentNumber.replace(/[^0-9]/g, '');
    if (numericPart) {
      const lastNum = parseInt(numericPart);
      if (!isNaN(lastNum) && lastNum > 0) {
        sequence = lastNum + 1;
      }
    }
  }
  
  // Return as simple number (e.g., "1", "2", "3")
  return sequence.toString();
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

