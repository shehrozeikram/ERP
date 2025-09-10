const mongoose = require('mongoose');

const groceryItemSchema = new mongoose.Schema({
  itemId: {
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
  category: {
    type: String,
    required: true,
    enum: ['Vegetables', 'Fruits', 'Dairy', 'Meat', 'Grains', 'Beverages', 'Snacks', 'Cleaning', 'Other'],
    default: 'Other'
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'pieces', 'liters', 'packets', 'boxes', 'bottles'],
    default: 'pieces'
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  minStockLevel: {
    type: Number,
    required: true,
    min: 0,
    default: 5
  },
  maxStockLevel: {
    type: Number,
    required: true,
    min: 0,
    default: 100
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },
  expiryDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['Available', 'Low Stock', 'Out of Stock', 'Expired'],
    default: 'Available'
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  barcode: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  location: {
    type: String,
    trim: true,
    default: 'Main Storage'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better performance
groceryItemSchema.index({ itemId: 1 });
groceryItemSchema.index({ category: 1 });
groceryItemSchema.index({ status: 1 });
groceryItemSchema.index({ supplier: 1 });
groceryItemSchema.index({ expiryDate: 1 });

// Virtual for total value
groceryItemSchema.virtual('totalValue').get(function() {
  return this.currentStock * this.unitPrice;
});

// Pre-save middleware to update status based on stock
groceryItemSchema.pre('save', function(next) {
  if (this.currentStock <= 0) {
    this.status = 'Out of Stock';
  } else if (this.currentStock <= this.minStockLevel) {
    this.status = 'Low Stock';
  } else if (this.expiryDate && this.expiryDate < new Date()) {
    this.status = 'Expired';
  } else {
    this.status = 'Available';
  }
  next();
});

module.exports = mongoose.model('GroceryItem', groceryItemSchema);
