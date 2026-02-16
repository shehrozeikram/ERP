const mongoose = require('mongoose');

const goodsReceiveSchema = new mongoose.Schema({
  receiveNumber: {
    type: String,
    unique: true,
    required: false,
    trim: true
  },
  receiveDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: {
    type: String,
    trim: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder'
  },
  poNumber: {
    type: String,
    trim: true
  },
  supplierAddress: {
    type: String,
    trim: true
  },
  narration: {
    type: String,
    trim: true
  },
  prNumber: {
    type: String,
    trim: true
  },
  store: {
    type: String,
    trim: true
  },
  gatePassNo: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    trim: true,
    default: 'Rupees'
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  otherCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  observation: {
    type: String,
    trim: true
  },
  preparedByName: {
    type: String,
    trim: true
  },
  items: [{
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: false
    },
    itemCode: {
      type: String,
      required: true
    },
    itemName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit: {
      type: String,
      required: true
    },
    unitPrice: {
      type: Number,
      default: 0
    },
    valueExcludingSalesTax: {
      type: Number,
      default: 0
    },
    notes: String
  }],
  totalItems: {
    type: Number,
    default: 0
  },
  totalQuantity: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Received', 'Complete', 'Partial'],
    default: 'Partial'
  }
}, {
  timestamps: true
});

// Pre-save: Generate receive number if not provided (GR00000129 style)
goodsReceiveSchema.pre('save', async function(next) {
  if (!this.receiveNumber) {
    const count = await mongoose.model('GoodsReceive').countDocuments();
    this.receiveNumber = `GR${String(count + 1).padStart(8, '0')}`;
  }

  if (this.items && this.items.length > 0) {
    this.totalItems = this.items.length;
    this.totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    this.items.forEach((item) => {
      item.valueExcludingSalesTax = (item.quantity || 0) * (item.unitPrice || 0);
    });
    const subtotal = this.items.reduce((sum, item) => sum + (item.valueExcludingSalesTax || 0), 0);
    this.netAmount = subtotal - (this.discount || 0) + (this.otherCharges || 0);
    this.total = this.netAmount;
  }

  next();
});

// Shared logic: sync GRN items to inventory (always create new inventory entry, never update existing)
goodsReceiveSchema.statics.syncItemsToInventory = async function(grnDoc) {
  const receivedStatuses = ['Received', 'Complete', 'Partial'];
  if (!grnDoc || !receivedStatuses.includes(grnDoc.status) || !grnDoc.items || grnDoc.items.length === 0) return;
  const receiveNumber = grnDoc.receiveNumber || grnDoc._id?.toString() || 'GRN';
  const Inventory = mongoose.model('Inventory');
  const items = Array.isArray(grnDoc.items) ? grnDoc.items : [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx] && typeof items[idx].toObject === 'function' ? items[idx].toObject() : items[idx];
    if (!item || item.quantity == null) continue;
    try {
      const codeStr = item.itemCode != null ? String(item.itemCode).trim() : '';
      const nameStr = item.itemName != null ? String(item.itemName).trim() : '';
      
      // Always create a new inventory entry with unique itemCode
      // Generate unique code by appending GRN number and item index, or timestamp if needed
      let baseCode = (codeStr && codeStr !== '—') ? codeStr : nameStr || `ITEM-${idx + 1}`;
      let uniqueCode = `${baseCode}-GRN${receiveNumber}-${idx + 1}`;
      
      // Ensure uniqueness by checking if code exists and appending timestamp if needed
      let existing = await Inventory.findOne({ itemCode: uniqueCode });
      if (existing) {
        const timestamp = Date.now().toString().slice(-6);
        uniqueCode = `${baseCode}-GRN${receiveNumber}-${idx + 1}-${timestamp}`;
      }
      
      const name = (nameStr && nameStr !== '—') ? nameStr : uniqueCode;
      
      // Always create new inventory entry
      const inv = new Inventory({
        itemCode: uniqueCode,
        name,
        description: item.description || `Received via GRN ${receiveNumber}`,
        category: item.category || 'Other',
        unit: (item.unit && item.unit !== '—') ? item.unit : 'Nos',
        quantity: 0, // Start with 0, then add stock
        unitPrice: Number(item.unitPrice) || 0,
        createdBy: grnDoc.receivedBy
      });
      await inv.save();
      
      // Add stock to the newly created inventory item
      await inv.addStock(
        Number(item.quantity) || 0,
        receiveNumber,
        item.notes || `Received via GRN ${receiveNumber}`,
        grnDoc.receivedBy
      );
    } catch (error) {
      console.error(`GoodsReceive syncItemsToInventory error for item ${item.itemCode}:`, error);
    }
  }
};

// Post-save: Update inventory when goods are received
goodsReceiveSchema.post('save', async function(doc) {
  try {
    await this.constructor.syncItemsToInventory(doc);
  } catch (error) {
    console.error('GoodsReceive post-save syncItemsToInventory error:', error);
  }
});

goodsReceiveSchema.index({ receiveNumber: 1 });
goodsReceiveSchema.index({ receiveDate: -1 });
goodsReceiveSchema.index({ supplier: 1 });
goodsReceiveSchema.index({ status: 1 });

module.exports = mongoose.model('GoodsReceive', goodsReceiveSchema);
