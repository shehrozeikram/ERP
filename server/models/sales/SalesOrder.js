const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesProduct'
  },
  productName: {
    type: String,
    required: true
  },
  sku: String,
  unitPrice: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  discount: {
    type: Number,
    min: 0,
    default: 0
  },
  total: {
    type: Number,
    required: true
  }
}, {
  _id: false
});

const salesOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesCustomer',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'fulfilled', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  stage: {
    type: String,
    enum: ['lead', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    default: 'proposal',
    index: true
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  dueDate: Date,
  currency: {
    type: String,
    default: 'PKR'
  },
  subtotal: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  taxRate: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  shippingAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'refunded'],
    default: 'unpaid'
  },
  items: [orderItemSchema],
  notes: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  attachments: [{
    filename: String,
    url: String
  }]
}, {
  timestamps: true
});

salesOrderSchema.pre('validate', async function(next) {
  if (!this.isNew || this.orderNumber) {
    return next();
  }

  const count = await this.constructor.countDocuments();
  const year = new Date().getFullYear();
  this.orderNumber = `SO-${year}-${String(count + 1).padStart(4, '0')}`;
  next();
});

salesOrderSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    const subtotal = this.items.reduce((acc, item) => acc + (item.total || 0), 0);
    this.subtotal = subtotal;
    this.taxAmount = Number(((subtotal - this.discount) * (this.taxRate / 100)).toFixed(2));
    this.totalAmount = subtotal - this.discount + this.taxAmount + this.shippingAmount;
  } else {
    this.subtotal = 0;
    this.totalAmount = 0;
  }
  next();
});

module.exports = mongoose.model('SalesOrder', salesOrderSchema);

