const mongoose = require('mongoose');

const goodsReceiveSchema = new mongoose.Schema({
  receiveNumber: {
    type: String,
    unique: true,
    required: true,
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
  items: [{
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true
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
    enum: ['Draft', 'Received'],
    default: 'Received'
  }
}, {
  timestamps: true
});

// Pre-save: Generate receive number if not provided
goodsReceiveSchema.pre('save', async function(next) {
  if (!this.receiveNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('GoodsReceive').countDocuments({ 
      receiveDate: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) }
    });
    this.receiveNumber = `GR-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  
  if (this.items && this.items.length > 0) {
    this.totalItems = this.items.length;
    this.totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }
  
  next();
});

// Post-save: Update inventory if status is 'Received'
goodsReceiveSchema.post('save', async function(doc) {
  if (doc.status === 'Received' && doc.items && doc.items.length > 0) {
    const Inventory = mongoose.model('Inventory');
    
    for (const item of doc.items) {
      try {
        const inventory = await Inventory.findById(item.inventoryItem);
        if (inventory) {
          await inventory.addStock(
            item.quantity,
            doc.receiveNumber,
            item.notes || `Received via ${doc.receiveNumber}`,
            doc.receivedBy
          );
        }
      } catch (error) {
        console.error(`Error updating inventory for item ${item.itemCode}:`, error);
      }
    }
  }
});

goodsReceiveSchema.index({ receiveNumber: 1 });
goodsReceiveSchema.index({ receiveDate: -1 });
goodsReceiveSchema.index({ supplier: 1 });
goodsReceiveSchema.index({ status: 1 });

module.exports = mongoose.model('GoodsReceive', goodsReceiveSchema);
