const mongoose = require('mongoose');

const goodsIssueSchema = new mongoose.Schema({
  issueNumber: {
    type: String,
    unique: true,
    required: false, // Auto-generated in pre-save hook
    trim: true
  },
  sinNumber: {
    type: String,
    trim: true
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  issuingLocation: {
    type: String,
    trim: true,
    default: 'Main Store'
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  },
  storeSnapshot: {
    type: String,
    trim: true,
    default: 'Main Store'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  department: {
    type: String,
    required: true,
    enum: ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general', 'it'],
    default: 'general'
  },
  departmentName: {
    type: String,
    trim: true
  },
  concernedDepartment: {
    type: String,
    trim: true
  },
  costCenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCenter'
  },
  costCenterCode: {
    type: String,
    trim: true
  },
  costCenterName: {
    type: String,
    trim: true
  },
  requiredFor: {
    type: String,
    trim: true
  },
  justification: {
    type: String,
    trim: true
  },
  eprNo: {
    type: String,
    trim: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  requestedByName: {
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
      min: 0
    },
    qtyReturned: {
      type: Number,
      default: 0,
      min: 0
    },
    qtyIssued: {
      type: Number,
      default: 0,
      min: 0
    },
    balanceQty: {
      type: Number,
      default: 0,
      min: 0
    },
    issuedFromNewStock: {
      type: Boolean,
      default: true
    },
    issuedFromOldStock: {
      type: Boolean,
      default: false
    },
    subStore: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store'
    },
    location: {
      rack: { type: String, trim: true },
      shelf: { type: String, trim: true },
      bin: { type: String, trim: true }
    },
    unit: {
      type: String,
      required: true
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
  purpose: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  returnedByName: {
    type: String,
    trim: true
  },
  approvedByName: {
    type: String,
    trim: true
  },
  issuedByName: {
    type: String,
    trim: true
  },
  receivedByName: {
    type: String,
    trim: true
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Issued'],
    default: 'Issued'
  }
}, {
  timestamps: true
});

// Pre-save: Generate SIN number (Store Issue Note) and issueNumber if not provided
goodsIssueSchema.pre('save', async function(next) {
  if (!this.issueNumber) {
    const count = await mongoose.model('GoodsIssue').countDocuments();
    const sin = `SIN${String(count + 1).padStart(8, '0')}`;
    this.sinNumber = sin;
    this.issueNumber = sin;
  }
  if (!this.sinNumber && this.issueNumber) {
    this.sinNumber = this.issueNumber;
  }

  if (this.items && this.items.length > 0) {
    this.totalItems = this.items.length;
    this.items.forEach((item) => {
      const issued = item.qtyIssued ?? item.quantity ?? 0;
      item.qtyIssued = issued;
      if (item.quantity === undefined) item.quantity = issued;
    });
    this.totalQuantity = this.items.reduce((sum, item) => sum + (item.qtyIssued ?? item.quantity ?? 0), 0);
  }

  next();
});

// Post-save: Update inventory and create stock transactions if status is 'Issued'
goodsIssueSchema.post('save', async function(doc) {
  if (doc.status === 'Issued' && doc.items && doc.items.length > 0) {
    if (!doc.project) {
      console.error('GoodsIssue post-save: project is required');
      return;
    }
    
    const Inventory = mongoose.model('Inventory');
    const StockTransaction = mongoose.model('StockTransaction');
    // store is now an ObjectId; fall back gracefully if not yet set
    const storeId = doc.store?._id || doc.store;
    const projectId = doc.project._id || doc.project;
    const issueNumber = doc.issueNumber || doc.sinNumber || 'SIN';
    const qtyToDeduct = (item) => item.qtyIssued ?? item.quantity ?? 0;

    for (const item of doc.items) {
      const qty = qtyToDeduct(item);
      if (qty <= 0) continue;
      try {
        const inventory = await Inventory.findById(item.inventoryItem);
        if (inventory) {
          await inventory.removeStock(
            qty,
            issueNumber,
            item.notes || `Issued via ${issueNumber} (Store Issue Note)`,
            doc.issuedBy
          );

          // Resolve sub-store: item-level overrides document-level
          const txStoreId = item.subStore?._id || item.subStore || storeId;
          if (!txStoreId) continue;

          const currentBalance = await StockTransaction.getBalance(txStoreId, projectId, inventory._id);
          const balanceAfter = currentBalance - qty;

          await StockTransaction.create({
            store: txStoreId,
            storeSnapshot: doc.storeSnapshot || doc.issuingLocation || 'Main Store',
            project: projectId,
            item: inventory._id,
            itemCode: item.itemCode || inventory.itemCode,
            itemName: item.itemName || inventory.name,
            transactionType: 'OUT',
            quantity: -qty,
            unit: item.unit || inventory.unit,
            unitPrice: 0,
            referenceType: 'SIN',
            referenceId: doc._id,
            referenceNumber: issueNumber,
            balanceAfter,
            location: {
              rack: item.location?.rack || '',
              shelf: item.location?.shelf || '',
              bin: item.location?.bin || ''
            },
            description: `Issued via ${issueNumber} (Store Issue Note)`,
            notes: item.notes || '',
            createdBy: doc.issuedBy
          });
        }
      } catch (error) {
        console.error(`Error updating inventory for item ${item.itemCode}:`, error.message);
      }
    }
  }
});

goodsIssueSchema.index({ issueNumber: 1 });
goodsIssueSchema.index({ issueDate: -1 });
goodsIssueSchema.index({ department: 1 });
goodsIssueSchema.index({ status: 1 });

module.exports = mongoose.model('GoodsIssue', goodsIssueSchema);
