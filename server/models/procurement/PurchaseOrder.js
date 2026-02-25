const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: false, // Auto-generated in pre-save hook
    unique: true,
    trim: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date,
    required: true
  },
  deliveryAddress: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Draft', 'Pending Audit', 'Pending Finance', 'Send to CEO Office', 'Forwarded to CEO', 'Approved', 'Sent to Store', 'GRN Created', 'Sent to Procurement', 'Sent to Finance', 'Ordered', 'Partially Received', 'Received', 'Cancelled', 'Rejected', 'Returned from Audit', 'Returned from CEO Office', 'Returned from CEO Secretariat'],
    default: 'Draft'
  },
  indent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Indent'
  },
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  auditApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  auditApprovedAt: {
    type: Date
  },
  auditRemarks: String,
  auditObservations: [{
    observation: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedAt: { type: Date, default: Date.now },
    // Answer to the observation (provided by procurement when resubmitting)
    answer: { type: String, trim: true },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answeredAt: { type: Date },
    resolved: { type: Boolean, default: false }
  }],
  auditReturnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  auditReturnedAt: { type: Date },
  auditReturnComments: { type: String },
  auditRejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  auditRejectedAt: { type: Date },
  auditRejectionComments: { type: String },
  auditRejectObservations: [{ observation: String, severity: String }],
  // Snapshot of PO items/totals when returned or rejected from audit (for computing change summary on resubmit)
  auditSnapshotAtReturn: { type: mongoose.Schema.Types.Mixed },
  // Human-readable summary of changes made by procurement when resubmitting to audit (e.g. "Quantity of Chairs reduced from 10 to 5")
  resubmissionChangeSummary: { type: String, trim: true },
  ceoForwardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ceoForwardedAt: { type: Date },
  ceoApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ceoApprovedAt: { type: Date },
  ceoApprovalComments: { type: String },
  ceoDigitalSignature: { type: String },
  ceoRejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ceoRejectedAt: { type: Date },
  ceoRejectionComments: { type: String },
  ceoReturnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ceoReturnedAt: { type: Date },
  ceoReturnComments: { type: String },
  financeApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  financeApprovedAt: {
    type: Date
  },
  financeRemarks: String,
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  items: [{
    productCode: { type: String, trim: true },
    description: {
      type: String,
      required: true,
      trim: true
    },
    specification: { type: String, trim: true },
    brand: { type: String, trim: true },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    amount: {
      type: Number,
      required: true
    },
    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  paymentTerms: {
    type: String,
    trim: true
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  billingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  notes: {
    type: String,
    trim: true
  },
  internalNotes: {
    type: String,
    trim: true
  },
  // Approval authorities (names/designations) for signature section - prefilled from comparative statement when created from quotation
  approvalAuthorities: {
    preparedBy: { type: String, trim: true, default: '' },
    verifiedBy: { type: String, trim: true, default: '' },
    authorisedRep: { type: String, trim: true, default: '' },
    financeRep: { type: String, trim: true, default: '' },
    managerProcurement: { type: String, trim: true, default: '' }
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receivedAt: {
    type: Date
  },
  qaStatus: {
    type: String,
    enum: ['Pending', 'Passed', 'Rejected'],
    default: 'Pending'
  },
  qaCheckedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  qaCheckedAt: {
    type: Date
  },
  qaRemarks: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Workflow history for audit/CEO flow (shown in Pre-Audit, CEO Secretariat, Procurement, etc.)
  workflowHistory: [{
    fromStatus: { type: String, trim: true },
    toStatus: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    comments: { type: String, trim: true },
    module: { type: String, trim: true } // e.g. 'Procurement', 'Pre-Audit', 'CEO Secretariat' – where the action was taken
  }]
}, {
  timestamps: true
});

// Generate order number
purchaseOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Find the last order number for this month
    const lastOrder = await this.constructor.findOne({
      orderNumber: new RegExp(`^PO-${year}${month}`)
    }).sort({ orderNumber: -1 });
    
    let sequence = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `PO-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }
  
  // Calculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => {
      const itemTotal = (item.quantity * item.unitPrice) - (item.discount || 0);
      return sum + itemTotal;
    }, 0);
    
    this.taxAmount = this.items.reduce((sum, item) => {
      const itemTotal = (item.quantity * item.unitPrice) - (item.discount || 0);
      const tax = itemTotal * (item.taxRate || 0) / 100;
      return sum + tax;
    }, 0);
    
    this.discountAmount = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    
    this.totalAmount = this.subtotal + this.taxAmount + (this.shippingCost || 0);
  }
  
  next();
});

// Update status based on received quantities
purchaseOrderSchema.methods.updateReceivingStatus = function() {
  const totalItems = this.items.length;
  const fullyReceived = this.items.filter(item => item.receivedQuantity >= item.quantity).length;
  const partiallyReceived = this.items.filter(item => item.receivedQuantity > 0 && item.receivedQuantity < item.quantity).length;
  
  if (fullyReceived === totalItems) {
    this.status = 'Received';
  } else if (partiallyReceived > 0 || fullyReceived > 0) {
    this.status = 'Partially Received';
  }
};

// Static method to get statistics
purchaseOrderSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  const totalOrders = await this.countDocuments();
  const totalValue = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  return {
    totalOrders,
    totalValue: totalValue[0]?.total || 0,
    byStatus: stats
  };
};

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

module.exports = PurchaseOrder;

