const mongoose = require('mongoose');

/**
 * Billable line item in Centralized Store (e.g. Electricity — Meter 1, SGCHQ).
 */
const utilityStoreItemSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UtilityStoreCategory',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  code: {
    type: String,
    trim: true,
    default: ''
  },
  utilityType: {
    type: String,
    enum: [
      'Electricity',
      'Water',
      'Gas',
      'Internet',
      'Phone',
      'Maintenance',
      'Security',
      'Cleaning',
      'Rent',
      'Other'
    ],
    default: 'Electricity'
  },
  meterNumber: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  site: {
    type: String,
    trim: true,
    default: ''
  },
  department: {
    type: String,
    trim: true,
    default: ''
  },
  /** Chart of accounts — expense debited when this item is billed */
  expenseAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  defaultAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

utilityStoreItemSchema.index({ category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('UtilityStoreItem', utilityStoreItemSchema);
