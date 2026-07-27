const mongoose = require('mongoose');

/**
 * LandedCostVoucher Model — Allocates freight, shipping, customs duties, and loading/unloading
 * charges proportionally across received GRN items to update inventory asset valuation.
 */
const landedCostVoucherSchema = new mongoose.Schema(
  {
    voucherNumber: {
      type: String,
      unique: true,
      trim: true
    },
    voucherDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    goodsReceive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceive',
      required: true
    },
    receiveNumber: {
      type: String,
      trim: true
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    apportionmentMethod: {
      type: String,
      enum: ['By Value', 'By Quantity'],
      default: 'By Value'
    },
    charges: [
      {
        chargeType: {
          type: String,
          required: true,
          enum: ['Freight', 'Customs Duty', 'Insurance', 'Loading/Unloading', 'Handling', 'Other']
        },
        amount: { type: Number, required: true, min: 0 },
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
        description: { type: String, trim: true }
      }
    ],
    totalLandedCost: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['Draft', 'Posted', 'Cancelled'],
      default: 'Draft'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// Pre-save: Auto-generate Voucher number (LC000001) and total charges
landedCostVoucherSchema.pre('save', async function (next) {
  if (!this.voucherNumber) {
    const count = await mongoose.model('LandedCostVoucher').countDocuments();
    this.voucherNumber = `LC${String(count + 1).padStart(7, '0')}`;
  }

  if (Array.isArray(this.charges)) {
    this.totalLandedCost = this.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
  }

  next();
});

// Post-save: Apportion landed cost to StockQuant & Inventory valuation when posted
landedCostVoucherSchema.post('save', async function (doc) {
  if (doc.status === 'Posted' && doc.goodsReceive && doc.totalLandedCost > 0) {
    try {
      const GoodsReceive = mongoose.model('GoodsReceive');
      const StockQuant = mongoose.model('StockQuant');
      const Inventory = mongoose.model('Inventory');

      const grn = await GoodsReceive.findById(doc.goodsReceive).lean();
      if (!grn || !Array.isArray(grn.items) || grn.items.length === 0) return;

      const totalGrnValue = grn.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
      const totalGrnQty = grn.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

      for (const item of grn.items) {
        const qty = item.quantity || 0;
        if (qty <= 0) continue;

        const itemId = item.inventoryItem?._id || item.inventoryItem;
        if (!itemId) continue;

        let extraCostPerUnit = 0;
        if (doc.apportionmentMethod === 'By Value' && totalGrnValue > 0) {
          const itemTotalValue = qty * (item.unitPrice || 0);
          const itemLandedShare = (itemTotalValue / totalGrnValue) * doc.totalLandedCost;
          extraCostPerUnit = itemLandedShare / qty;
        } else if (totalGrnQty > 0) {
          const itemLandedShare = (qty / totalGrnQty) * doc.totalLandedCost;
          extraCostPerUnit = itemLandedShare / qty;
        }

        if (extraCostPerUnit > 0) {
          const quant = await StockQuant.findOne({ store: doc.store, project: doc.project, item: itemId });
          if (quant) {
            quant.unitPrice = Number((quant.unitPrice + extraCostPerUnit).toFixed(4));
            await quant.save();

            const inv = await Inventory.findById(itemId);
            if (inv) {
              inv.unitPrice = quant.unitPrice;
              await inv.save();
            }
          }
        }
      }
    } catch (err) {
      console.error('Error posting LandedCostVoucher to StockQuant:', err);
    }
  }
});

landedCostVoucherSchema.index({ voucherNumber: 1 });
landedCostVoucherSchema.index({ goodsReceive: 1 });
landedCostVoucherSchema.index({ status: 1 });

module.exports = mongoose.model('LandedCostVoucher', landedCostVoucherSchema);
