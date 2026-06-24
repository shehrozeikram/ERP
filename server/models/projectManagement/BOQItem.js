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
  title: { type: String, trim: true, default: '' },
  description: { type: String, required: true, trim: true },
  specification: { type: String, trim: true },
  unit: { type: String, required: true, trim: true },

  // Estimation
  estimatedQuantity: { type: Number, required: true },
  estimatedUnitPrice: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, default: 0 },
  estimatedTotalCost: { type: Number, default: 0 },
  netEstimatedCost: { type: Number, default: 0 },

  // Actuals (updated as procurement happens)
  orderedQuantity: { type: Number, default: 0 },
  receivedQuantity: { type: Number, default: 0 },
  usedQuantity: { type: Number, default: 0 },
  actualUnitPrice: { type: Number, default: 0, min: 0 },
  actualTotalCost: { type: Number, default: 0 },

  // Variance fields (computed on save)
  quantityVariance: { type: Number, default: 0 },
  costVariance: { type: Number, default: 0 },

  // Links to purchase orders
  linkedPurchaseOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' }],

  notes: { type: String, trim: true },
  orderIndex: { type: Number, default: 0 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const boqTitleFromDescription = (description) =>
  String(description || '').split(/\r?\n/)[0]?.trim() || '';

const applyBoqTitle = (doc) => {
  const explicit = String(doc.title || '').trim();
  doc.title = explicit || boqTitleFromDescription(doc.description);
};

const applyBoqComputedFields = (doc) => {
  applyBoqTitle(doc);
  const estimatedQuantity = Number(doc.estimatedQuantity) || 0;
  const estimatedUnitPrice = Number(doc.estimatedUnitPrice) || 0;
  const usedQuantity = Number(doc.usedQuantity) || 0;
  const actualUnitPrice = Number(doc.actualUnitPrice) || 0;

  const grossEstimated = estimatedQuantity * estimatedUnitPrice;
  let inputDiscount = Number(doc.discountAmount) || 0;
  let discountAmount = 0;
  
  if (grossEstimated >= 0) {
    discountAmount = Math.min(Math.max(0, inputDiscount), grossEstimated);
  } else {
    discountAmount = 0;
  }

  doc.discountAmount = discountAmount;
  doc.estimatedTotalCost = grossEstimated;
  doc.netEstimatedCost = grossEstimated - discountAmount;
  doc.actualTotalCost = usedQuantity * actualUnitPrice;
  doc.quantityVariance = usedQuantity - estimatedQuantity;
  doc.costVariance = doc.actualTotalCost - doc.netEstimatedCost;
};

boqItemSchema.statics.applyComputedFields = applyBoqComputedFields;
boqItemSchema.statics.titleFromDescription = boqTitleFromDescription;

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
  const affectsComputed = ['title', 'description', 'estimatedQuantity', 'estimatedUnitPrice', 'discountAmount', 'usedQuantity', 'actualUnitPrice']
    .some((key) => $set[key] !== undefined);

  if (!affectsComputed) return next();

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

  update.$set.title = merged.title;
  update.$set.discountAmount = merged.discountAmount;
  update.$set.estimatedTotalCost = merged.estimatedTotalCost;
  update.$set.netEstimatedCost = merged.netEstimatedCost;
  update.$set.actualTotalCost = merged.actualTotalCost;
  update.$set.quantityVariance = merged.quantityVariance;
  update.$set.costVariance = merged.costVariance;
  next();
});

boqItemSchema.index({ project: 1, phase: 1 });
boqItemSchema.index({ project: 1, category: 1 });

module.exports = mongoose.model('BOQItem', boqItemSchema);
