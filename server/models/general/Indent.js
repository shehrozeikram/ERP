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
      required: [true, 'Item description is required'],
      trim: true
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      trim: true,
      default: 'Piece'
    },
    purpose: {
      type: String,
      required: [true, 'Purpose is required'],
      trim: true
    },
    estimatedCost: {
      type: Number,
      required: [true, 'Estimated cost is required'],
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
  // Store routing: when approved, indent goes to Store first. Store checks stock.
  // pending_store_check = in Store Dashboard; moved_to_procurement = moved to Procurement Requisitions by store
  storeRoutingStatus: {
    type: String,
    enum: [null, 'pending_store_check', 'moved_to_procurement'],
    default: null
  },
  movedToProcurementBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  movedToProcurementAt: {
    type: Date
  },
  movedToProcurementReason: {
    type: String,
    trim: true
  },
  
  // Dates
  requestedDate: {
    type: Date,
    default: Date.now
  },
  requiredDate: {
    type: Date,
    required: [true, 'Required date is required']
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
    required: [true, 'Justification is required'],
    trim: true
  },
  
  // Comparative Statement approval authorities (editable names/designations at bottom of comparative statement)
  comparativeStatementApprovals: {
    preparedBy: { type: String, trim: true, default: '' },
    verifiedBy: { type: String, trim: true, default: '' },
    authorisedRep: { type: String, trim: true, default: '' },
    financeRep: { type: String, trim: true, default: '' },
    managerProcurement: { type: String, trim: true, default: '' }
  },
  // Per-item vendor assignments from Comparative Statement (item index -> quotation id). When set, quotations are shortlisted; create split POs from Quotations page.
  splitPOAssignments: {
    type: mongoose.Schema.Types.Mixed,
    default: null
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
    required: [true, 'Priority is required'],
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [200, 'Category cannot exceed 200 characters']
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
  
  // Ensure indentNumber and erpRef are set (only for new documents; updates may have legacy empty values)
  if (this.isNew) {
    if (!this.indentNumber || this.indentNumber.trim() === '') {
      return next(new Error('Indent Number is required'));
    }
    if (!this.erpRef || this.erpRef.trim() === '') {
      return next(new Error('ERP Ref is required'));
    }
  }
  
  next();
});

// Generate indent number (last indent + 1 to ensure uniqueness)
indentSchema.statics.generateIndentNumber = async function() {
  // Find the true max numeric value - don't use string sort (e.g. "9" > "10" as strings)
  const indents = await this.find({ indentNumber: { $exists: true, $ne: '' } })
    .select('indentNumber')
    .lean();

  let maxNum = 0;
  for (const ind of indents) {
    const numericPart = (ind.indentNumber || '').replace(/[^0-9]/g, '');
    if (numericPart) {
      const num = parseInt(numericPart, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return (maxNum + 1).toString();
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

