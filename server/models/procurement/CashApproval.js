const mongoose = require('mongoose');

const cashApprovalSchema = new mongoose.Schema({
  caNumber: {
    type: String,
    unique: true,
    trim: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  indent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Indent'
  },
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  approvalDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedPurchaseDate: {
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
    enum: [
      'Draft',
      'Pending Audit',
      'Forwarded to Audit Director',
      'Send to CEO Office',
      'Forwarded to CEO',
      'Pending Finance',
      'Advance Issued',
      'Payment Settled',
      'Sent to Procurement',
      'Completed',
      'Cancelled',
      'Rejected',
      'Returned from Audit',
      'Returned from CEO Office',
      'Returned from CEO Secretariat'
    ],
    default: 'Draft'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Urgent'
  },

  // ─── Items ───────────────────────────────────────────────────────────────────
  items: [{
    productCode: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    specification: { type: String, trim: true },
    brand: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    discount: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 },

  // ─── Approval Authorities (5-person signature block) ─────────────────────────
  approvalAuthorities: {
    preparedBy: { type: String, trim: true, default: '' },
    verifiedBy: { type: String, trim: true, default: '' },
    authorisedRep: { type: String, trim: true, default: '' },
    financeRep: { type: String, trim: true, default: '' },
    managerProcurement: { type: String, trim: true, default: '' }
  },

  // ─── Audit workflow ───────────────────────────────────────────────────────────
  preAuditInitialApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  preAuditInitialApprovedAt: { type: Date },
  preAuditInitialComments: { type: String },
  auditApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  auditApprovedAt: { type: Date },
  auditRemarks: { type: String },
  auditObservations: [{
    observation: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedAt: { type: Date, default: Date.now },
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
  auditSnapshotAtReturn: { type: mongoose.Schema.Types.Mixed },
  resubmissionChangeSummary: { type: String, trim: true },

  // ─── CEO workflow ─────────────────────────────────────────────────────────────
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

  // ─── Finance: Advance ────────────────────────────────────────────────────────
  // Who will physically receive the advance (procurement officer / buyer)
  advanceTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  advanceToName: { type: String, trim: true },
  advanceAmount: { type: Number, default: 0 },
  advancePaymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online Transfer'],
    default: 'Cash'
  },
  advanceVoucherNo: { type: String, trim: true },
  advanceRemarks: { type: String, trim: true },
  advanceIssuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  advanceIssuedAt: { type: Date },

  // ─── Finance: Settlement ──────────────────────────────────────────────────────
  actualAmountSpent: { type: Number, default: 0 },
  excessReturned: { type: Number, default: 0 },
  additionalPaid: { type: Number, default: 0 },
  receiptAttachments: [{
    filename: { type: String },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  settlementRemarks: { type: String, trim: true },
  settlementDate: { type: Date },
  settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ─── Finance: Sent back ───────────────────────────────────────────────────────
  sentToProcurementBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentToProcurementAt: { type: Date },
  sentToProcurementRemarks: { type: String, trim: true },

  // ─── Procurement completion ───────────────────────────────────────────────────
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
  completionRemarks: { type: String, trim: true },

  notes: { type: String, trim: true },
  internalNotes: { type: String, trim: true },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  workflowHistory: [{
    fromStatus: { type: String, trim: true },
    toStatus: { type: String, trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    comments: { type: String, trim: true },
    module: { type: String, trim: true }
  }]
}, {
  timestamps: true
});

// ─── Auto-generate CA number ──────────────────────────────────────────────────
cashApprovalSchema.pre('save', async function (next) {
  if (this.isNew && !this.caNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `CA-${year}${month}`;
    const last = await this.constructor.findOne({
      caNumber: new RegExp(`^${prefix}`)
    }).sort({ caNumber: -1 });
    let seq = 1;
    if (last && last.caNumber) {
      const parts = last.caNumber.split('-');
      const lastSeq = parseInt(parts[2]);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    this.caNumber = `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  // Recalculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => {
      return sum + ((item.quantity * item.unitPrice) - (item.discount || 0));
    }, 0);
    this.taxAmount = this.items.reduce((sum, item) => {
      const base = (item.quantity * item.unitPrice) - (item.discount || 0);
      return sum + (base * (item.taxRate || 0) / 100);
    }, 0);
    this.discountAmount = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    this.totalAmount = this.subtotal + this.taxAmount + (this.shippingCost || 0);
  }

  next();
});

cashApprovalSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } }
  ]);
  const totalCAs = await this.countDocuments();
  const totalValueAgg = await this.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]);
  return {
    totalCAs,
    totalValue: totalValueAgg[0]?.total || 0,
    byStatus: stats
  };
};

const CashApproval = mongoose.model('CashApproval', cashApprovalSchema);
module.exports = CashApproval;
