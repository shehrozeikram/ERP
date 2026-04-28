const mongoose = require('mongoose');

const boqItemSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConstructionProject',
    required: true,
    index: true
  },

  // Grouping
  phase: { type: String, trim: true, default: 'General' },
  category: { type: String, trim: true },

  // Item details
  itemCode: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  specification: { type: String, trim: true },
  unit: { type: String, required: true, trim: true },

  // Estimation
  estimatedQuantity: { type: Number, required: true, min: 0 },
  estimatedUnitPrice: { type: Number, required: true, min: 0 },
  estimatedTotalCost: { type: Number, default: 0, min: 0 },

  // Actuals (updated as procurement happens)
  orderedQuantity: { type: Number, default: 0, min: 0 },
  receivedQuantity: { type: Number, default: 0, min: 0 },
  usedQuantity: { type: Number, default: 0, min: 0 },
  actualUnitPrice: { type: Number, default: 0, min: 0 },
  actualTotalCost: { type: Number, default: 0, min: 0 },

  // Variance fields (computed on save)
  quantityVariance: { type: Number, default: 0 },
  costVariance: { type: Number, default: 0 },

  // Links to purchase orders
  linkedPurchaseOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }],

  notes: { type: String, trim: true },
  orderIndex: { type: Number, default: 0 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-compute totals and variances
boqItemSchema.pre('save', function (next) {
  this.estimatedTotalCost = (this.estimatedQuantity || 0) * (this.estimatedUnitPrice || 0);
  this.actualTotalCost = (this.usedQuantity || 0) * (this.actualUnitPrice || 0);
  this.quantityVariance = (this.usedQuantity || 0) - (this.estimatedQuantity || 0);
  this.costVariance = this.actualTotalCost - this.estimatedTotalCost;
  next();
});

boqItemSchema.index({ project: 1, phase: 1 });
boqItemSchema.index({ project: 1, category: 1 });

module.exports = mongoose.model('BOQItem', boqItemSchema);
