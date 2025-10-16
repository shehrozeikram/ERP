const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Raw Materials', 'Finished Goods', 'Office Supplies', 'Equipment', 'Consumables', 'Other'],
    default: 'Other'
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  maxQuantity: {
    type: Number,
    default: 1000,
    min: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  location: {
    warehouse: String,
    shelf: String,
    bin: String
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'],
    default: 'In Stock'
  },
  lastRestocked: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  transactions: [{
    type: {
      type: String,
      enum: ['In', 'Out', 'Adjustment'],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    reference: {
      type: String
    },
    notes: {
      type: String
    },
    date: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Calculate total value before saving
inventorySchema.pre('save', function(next) {
  this.totalValue = this.quantity * this.unitPrice;
  
  // Update status based on quantity
  if (this.quantity === 0) {
    this.status = 'Out of Stock';
  } else if (this.quantity <= this.minQuantity) {
    this.status = 'Low Stock';
  } else {
    this.status = 'In Stock';
  }
  
  next();
});

// Method to add stock
inventorySchema.methods.addStock = function(quantity, reference, notes, userId) {
  this.quantity += quantity;
  this.lastRestocked = new Date();
  this.transactions.push({
    type: 'In',
    quantity,
    reference,
    notes,
    performedBy: userId
  });
  return this.save();
};

// Method to remove stock
inventorySchema.methods.removeStock = function(quantity, reference, notes, userId) {
  if (this.quantity < quantity) {
    throw new Error('Insufficient stock');
  }
  this.quantity -= quantity;
  this.transactions.push({
    type: 'Out',
    quantity,
    reference,
    notes,
    performedBy: userId
  });
  return this.save();
};

// Method to adjust stock
inventorySchema.methods.adjustStock = function(newQuantity, reference, notes, userId) {
  const difference = newQuantity - this.quantity;
  this.quantity = newQuantity;
  this.transactions.push({
    type: 'Adjustment',
    quantity: difference,
    reference,
    notes,
    performedBy: userId
  });
  return this.save();
};

// Static method to get statistics
inventorySchema.statics.getStatistics = async function() {
  const totalItems = await this.countDocuments();
  const inStock = await this.countDocuments({ status: 'In Stock' });
  const lowStock = await this.countDocuments({ status: 'Low Stock' });
  const outOfStock = await this.countDocuments({ status: 'Out of Stock' });
  
  const totalValue = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$totalValue' }
      }
    }
  ]);
  
  const byCategory = await this.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalValue: { $sum: '$totalValue' }
      }
    }
  ]);
  
  return {
    totalItems,
    inStock,
    lowStock,
    outOfStock,
    totalValue: totalValue[0]?.total || 0,
    byCategory
  };
};

// Indexes for better performance
inventorySchema.index({ itemCode: 1 });
inventorySchema.index({ name: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ status: 1 });
inventorySchema.index({ supplier: 1 });

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;

