const mongoose = require('mongoose');

const goodsIssueSchema = new mongoose.Schema({
  issueNumber: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
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
      min: 1
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

// Pre-save: Generate issue number if not provided
goodsIssueSchema.pre('save', async function(next) {
  if (!this.issueNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('GoodsIssue').countDocuments({ 
      issueDate: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) }
    });
    this.issueNumber = `GI-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  
  if (this.items && this.items.length > 0) {
    this.totalItems = this.items.length;
    this.totalQuantity = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }
  
  next();
});

// Post-save: Update inventory if status is 'Issued'
goodsIssueSchema.post('save', async function(doc) {
  if (doc.status === 'Issued' && doc.items && doc.items.length > 0) {
    const Inventory = mongoose.model('Inventory');
    
    for (const item of doc.items) {
      try {
        const inventory = await Inventory.findById(item.inventoryItem);
        if (inventory) {
          await inventory.removeStock(
            item.quantity,
            doc.issueNumber,
            item.notes || `Issued to ${doc.departmentName || doc.department} via ${doc.issueNumber}`,
            doc.issuedBy
          );
        }
      } catch (error) {
        console.error(`Error updating inventory for item ${item.itemCode}:`, error.message);
        // Continue processing other items even if one fails
      }
    }
  }
});

goodsIssueSchema.index({ issueNumber: 1 });
goodsIssueSchema.index({ issueDate: -1 });
goodsIssueSchema.index({ department: 1 });
goodsIssueSchema.index({ status: 1 });

module.exports = mongoose.model('GoodsIssue', goodsIssueSchema);
