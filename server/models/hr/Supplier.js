const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  supplierId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  paymentTerms: {
    type: String,
    enum: ['Cash', 'Credit 7 days', 'Credit 15 days', 'Credit 30 days'],
    default: 'Cash'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  /** Procurement AVL / approved-vendor grouping (from category section headers in AVL spreadsheet) */
  vendorCategory: {
    type: String,
    trim: true,
    default: ''
  },
  ntnCnic: {
    type: String,
    trim: true,
    default: ''
  },
  payeeName: {
    type: String,
    trim: true,
    default: ''
  },
  /** Set when created from `import-procurement-vendors-xlsx.js` so a reset can target imports only */
  importSource: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
supplierSchema.index({ supplierId: 1 });
supplierSchema.index({ name: 1 });
supplierSchema.index({ status: 1 });
supplierSchema.index({ vendorCategory: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
