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

const applyBoqComputedFields = (doc) => {
  const estimatedQuantity = Number(doc.estimatedQuantity) || 0;
  const estimatedUnitPrice = Number(doc.estimatedUnitPrice) || 0;
  const usedQuantity = Number(doc.usedQuantity) || 0;
  const actualUnitPrice = Number(doc.actualUnitPrice) || 0;

  doc.estimatedTotalCost = estimatedQuantity * estimatedUnitPrice;
  doc.actualTotalCost = usedQuantity * actualUnitPrice;
  doc.quantityVariance = usedQuantity - estimatedQuantity;
  doc.costVariance = doc.actualTotalCost - doc.estimatedTotalCost;
};

boqItemSchema.statics.applyComputedFields = applyBoqComputedFields;

boqItemSchema.pre('save', function (next) {
  applyBoqComputedFields(this);
  next();
});

boqItemSchema.pre('insertMany', function (next, docs) {
  docs.forEach(applyBoqComputedFields);
  next();
});

boqItemSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;
  const affectsTotals = ['estimatedQuantity', 'estimatedUnitPrice', 'usedQuantity', 'actualUnitPrice']
    .some((key) => $set[key] !== undefined);

  if (!affectsTotals) return next();

  const existing = await this.model.findOne(this.getQuery()).lean();
  if (!existing) return next();

  const merged = { ...existing, ...$set };
  applyBoqComputedFields(merged);

  if (!update.$set) {
    update.$set = {};
    Object.keys($set).forEach((key) => {
      if (key !== '$set') update.$set[key] = $set[key];
    });
  }

  update.$set.estimatedTotalCost = merged.estimatedTotalCost;
  update.$set.actualTotalCost = merged.actualTotalCost;
  update.$set.quantityVariance = merged.quantityVariance;
  update.$set.costVariance = merged.costVariance;
  next();
});

boqItemSchema.index({ project: 1, phase: 1 });
boqItemSchema.index({ project: 1, category: 1 });

module.exports = mongoose.model('BOQItem', boqItemSchema);
