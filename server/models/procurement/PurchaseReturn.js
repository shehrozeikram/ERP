const mongoose = require('mongoose');

const purchaseReturnItemSchema = new mongoose.Schema({
  inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
  itemCode: { type: String, trim: true },
  itemName: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0.001 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, default: 0 },
  reason: { type: String, trim: true },
  // Original GRN item reference for traceability
  grnItem: { type: mongoose.Schema.Types.ObjectId }
}, { _id: true });

const purchaseReturnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      unique: true,
      trim: true
    },
    // Link to original GRN
    goodsReceive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceive',
      required: [true, 'Original GRN reference is required']
    },
    // Link to purchase order
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder'
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    supplierName: { type: String, trim: true },
    returnDate: { type: Date, default: Date.now },
    items: [purchaseReturnItemSchema],
    totalAmount: { type: Number, default: 0 },
    reason: {
      type: String,
      enum: ['defective', 'wrong_item', 'over_delivered', 'quality_issue', 'other'],
      default: 'other'
    },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'posted'],
      default: 'draft'
    },
    // Finance impact
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
    // Debit memo or credit note from supplier
    creditNoteNumber: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: Date
  },
  { timestamps: true }
);

purchaseReturnSchema.index({ returnNumber: 1 });
purchaseReturnSchema.index({ goodsReceive: 1 });
purchaseReturnSchema.index({ supplier: 1 });
purchaseReturnSchema.index({ status: 1 });

purchaseReturnSchema.pre('save', async function (next) {
  if (!this.returnNumber) {
    const count = await this.constructor.countDocuments();
    this.returnNumber = `PR-${String(count + 1).padStart(6, '0')}`;
  }
  // Recalculate total
  this.totalAmount = Math.round(this.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * 100) / 100;
  // Update item totals
  this.items.forEach(i => { i.totalAmount = Math.round(i.quantity * i.unitPrice * 100) / 100; });
  next();
});

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
