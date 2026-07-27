const mongoose = require('mongoose');

/**
 * StockQuant Model — Enterprise Multi-Warehouse Inventory Quant & Valuation Ledger
 * Decouples Global Item Master (Inventory) from Store/Warehouse specific physical stock,
 * bin locations, stock reservations, and AVCO (Moving Average Costing) valuation.
 */
const stockQuantSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true
    },
    subStore: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store'
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    location: {
      rack: { type: String, trim: true, default: '' },
      shelf: { type: String, trim: true, default: '' },
      bin: { type: String, trim: true, default: '' }
    },
    onHandQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    // AVCO: Moving Average Unit Price for this specific stock quant
    unitPrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    lastReceivedDate: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual: Available Quantity (Physical On-Hand minus Allocated/Reserved)
stockQuantSchema.virtual('availableQuantity').get(function () {
  return Math.max(0, (this.onHandQuantity || 0) - (this.reservedQuantity || 0));
});

// Virtual: Total Valuation for this Quant
stockQuantSchema.virtual('totalValue').get(function () {
  return (this.onHandQuantity || 0) * (this.unitPrice || 0);
});

// Compound indexes for fast lookup
stockQuantSchema.index({ store: 1, project: 1, item: 1 }, { unique: true });

/**
 * Static: Find or create a StockQuant for a store + project + item combination
 */
stockQuantSchema.statics.getOrCreateQuant = async function (storeId, projectId, itemId, location = {}) {
  let quant = await this.findOne({ store: storeId, project: projectId, item: itemId });
  if (!quant) {
    quant = new this({
      store: storeId,
      project: projectId,
      item: itemId,
      location: {
        rack: location.rack || '',
        shelf: location.shelf || '',
        bin: location.bin || ''
      },
      onHandQuantity: 0,
      reservedQuantity: 0,
      unitPrice: 0
    });
    await quant.save();
  }
  return quant;
};

/**
 * Static: Receive stock & update Weighted Moving Average Cost (AVCO)
 * New AVCO = ((Old Qty * Old Cost) + (New Qty * New Cost)) / (Old Qty + New Qty)
 */
stockQuantSchema.statics.addStockAVCO = async function (storeId, projectId, itemId, qtyReceived, unitCostReceived, location = {}) {
  const qty = Number(qtyReceived) || 0;
  const newCost = Number(unitCostReceived) || 0;
  if (qty <= 0) return null;

  const quant = await this.getOrCreateQuant(storeId, projectId, itemId, location);
  const oldQty = quant.onHandQuantity || 0;
  const oldCost = quant.unitPrice || 0;

  const totalOldValue = oldQty * oldCost;
  const totalNewValue = qty * newCost;
  const newTotalQty = oldQty + qty;

  const updatedAVCO = newTotalQty > 0 ? (totalOldValue + totalNewValue) / newTotalQty : newCost;

  quant.onHandQuantity = newTotalQty;
  quant.unitPrice = Number(updatedAVCO.toFixed(4));
  quant.lastReceivedDate = new Date();
  if (location && (location.rack || location.shelf || location.bin)) {
    quant.location = {
      rack: location.rack || quant.location?.rack || '',
      shelf: location.shelf || quant.location?.shelf || '',
      bin: location.bin || quant.location?.bin || ''
    };
  }

  await quant.save();

  // Also update Global Item Master AVCO & Total Stock
  const Inventory = mongoose.model('Inventory');
  const inv = await Inventory.findById(itemId);
  if (inv) {
    inv.unitPrice = quant.unitPrice;
    inv.lastRestocked = new Date();
    await inv.save();
  }

  return quant;
};

/**
 * Static: Reserve stock for approved requisition / Store Issue Note
 */
stockQuantSchema.statics.reserveStock = async function (storeId, projectId, itemId, qtyToReserve) {
  const qty = Number(qtyToReserve) || 0;
  if (qty <= 0) return null;

  const quant = await this.findOne({ store: storeId, project: projectId, item: itemId });
  if (!quant) throw new Error('StockQuant record not found for reservation');

  const available = quant.onHandQuantity - quant.reservedQuantity;
  if (qty > available) {
    throw new Error(`Insufficient available stock to reserve. Available: ${available}, Requested: ${qty}`);
  }

  quant.reservedQuantity += qty;
  await quant.save();
  return quant;
};

/**
 * Static: Release reservation (if requisition cancelled)
 */
stockQuantSchema.statics.releaseStock = async function (storeId, projectId, itemId, qtyToRelease) {
  const qty = Number(qtyToRelease) || 0;
  if (qty <= 0) return null;

  const quant = await this.findOne({ store: storeId, project: projectId, item: itemId });
  if (quant) {
    quant.reservedQuantity = Math.max(0, quant.reservedQuantity - qty);
    await quant.save();
  }
  return quant;
};

/**
 * Static: Deduct stock upon physical issue (SIN)
 */
stockQuantSchema.statics.deductStock = async function (storeId, projectId, itemId, qtyToDeduct) {
  const qty = Number(qtyToDeduct) || 0;
  if (qty <= 0) return null;

  const quant = await this.findOne({ store: storeId, project: projectId, item: itemId });
  if (!quant) throw new Error('StockQuant record not found for stock deduction');

  if (qty > quant.onHandQuantity) {
    throw new Error(`Insufficient physical stock on hand. On Hand: ${quant.onHandQuantity}, Required: ${qty}`);
  }

  quant.onHandQuantity -= qty;
  // If reserved stock existed for this issue, reduce reserved quantity as well
  if (quant.reservedQuantity > 0) {
    quant.reservedQuantity = Math.max(0, quant.reservedQuantity - qty);
  }

  await quant.save();
  return quant;
};

module.exports = mongoose.model('StockQuant', stockQuantSchema);
