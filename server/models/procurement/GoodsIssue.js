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
    const store = doc.store || doc.issuingLocation || 'Main Store';
    const projectId = doc.project._id || doc.project;
    const issueNumber = doc.issueNumber || doc.sinNumber || 'SIN';
    const qtyToDeduct = (item) => item.qtyIssued ?? item.quantity ?? 0;
    
    for (const item of doc.items) {
      const qty = qtyToDeduct(item);
      if (qty <= 0) continue;
      try {
        const inventory = await Inventory.findById(item.inventoryItem);
        if (inventory) {
          // Update inventory (for backward compatibility)
          await inventory.removeStock(
            qty,
            issueNumber,
            item.notes || `Issued via ${issueNumber} (Store Issue Note)`,
            doc.issuedBy
          );
          
          // Create StockTransaction record for project-wise tracking
          const currentBalance = await StockTransaction.getBalance(store, projectId, inventory._id);
          const balanceAfter = currentBalance - qty; // Negative quantity for OUT
          
          await StockTransaction.create({
            store: store,
            project: projectId,
            item: inventory._id,
            itemCode: item.itemCode || inventory.itemCode,
            itemName: item.itemName || inventory.name,
            transactionType: 'OUT',
            quantity: -qty, // Negative for OUT
            unit: item.unit || inventory.unit,
            unitPrice: 0, // Issue doesn't have unit price
            referenceType: 'SIN',
            referenceId: doc._id,
            referenceNumber: issueNumber,
            balanceAfter: balanceAfter,
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
