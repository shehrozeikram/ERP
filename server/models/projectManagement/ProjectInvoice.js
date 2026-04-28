const mongoose = require('mongoose');

const projectInvoiceSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConstructionProject',
    required: true,
    index: true
  },

  invoiceNumber: { type: String, unique: true, sparse: true, trim: true },

  // Milestone link (optional — manual invoices have no milestone)
  milestoneId: { type: mongoose.Schema.Types.ObjectId, default: null },
  milestoneName: { type: String, trim: true },

  // Client info (snapshot from project at invoice time)
  clientName: { type: String, trim: true },
  clientContact: { type: String, trim: true },
  clientAddress: { type: String, trim: true },

  // Billing
  contractValue: { type: Number, default: 0, min: 0 },
  billingPercentage: { type: Number, default: 0, min: 0, max: 100 },
  invoiceAmount: { type: Number, required: true, min: 0 },

  description: { type: String, trim: true },

  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date },

  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Cancelled'],
    default: 'Draft'
  },

  paidAmount: { type: Number, default: 0, min: 0 },
  paidDate: { type: Date },
  paymentMethod: { type: String, trim: true },
  paymentReference: { type: String, trim: true },

  notes: { type: String, trim: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate invoice number (PI = Project Invoice)
projectInvoiceSchema.pre('save', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.invoiceNumber = `PI-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

projectInvoiceSchema.index({ project: 1, status: 1 });
projectInvoiceSchema.index({ issueDate: -1 });

module.exports = mongoose.model('ProjectInvoice', projectInvoiceSchema);
