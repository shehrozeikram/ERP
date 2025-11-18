const mongoose = require('mongoose');

const salesProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  stockQuantity: {
    type: Number,
    min: 0,
    default: 0
  },
  reorderLevel: {
    type: Number,
    min: 0,
    default: 10
  },
  unit: {
    type: String,
    default: 'units'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  taxRate: {
    type: Number,
    min: 0,
    default: 0
  },
  margin: {
    type: Number,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  lastRestockedAt: Date,
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

salesProductSchema.index({ name: 1, sku: 1 });

module.exports = mongoose.model('SalesProduct', salesProductSchema);

