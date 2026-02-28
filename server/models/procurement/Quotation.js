const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: false, // Auto-generated in pre-save hook
    unique: true,
    trim: true
  },
  indent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Indent',
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  quotationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Received', 'Shortlisted', 'Finalized', 'Rejected'],
    default: 'Received'
  },
  items: [{
    description: {
      type: String,
      required: false,
      trim: true,
      default: ''
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    unit: {
      type: String,
      required: false,
      trim: true,
      default: ''
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    amount: {
      type: Number,
      required: false,
      default: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  validityDays: {
    type: Number,
    default: 30
  },
  deliveryTime: {
    type: String,
    trim: true
  },
  paymentTerms: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow null for public submissions
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  editReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Generate quotation number
quotationSchema.pre('save', async function(next) {
  if (this.isNew && !this.quotationNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Find the last quotation number for this month
    const lastQuote = await this.constructor.findOne({
      quotationNumber: new RegExp(`^QTN-${year}${month}`)
    }).sort({ quotationNumber: -1 });
    
    let sequence = 1;
    if (lastQuote && lastQuote.quotationNumber) {
      const parts = lastQuote.quotationNumber.split('-');
      const lastSequence = parseInt(parts[parts.length - 1]);
      sequence = lastSequence + 1;
    }
    
    this.quotationNumber = `QTN-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }
  
  // Calculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
    
    this.taxAmount = this.items.reduce((sum, item) => {
      const itemTotal = (item.quantity * item.unitPrice) - (item.discount || 0);
      return sum + (itemTotal * (item.taxRate || 0) / 100);
    }, 0);
    
    this.discountAmount = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    
    this.totalAmount = this.subtotal + this.taxAmount - this.discountAmount;
  }
  
  next();
});

const Quotation = mongoose.model('Quotation', quotationSchema);

module.exports = Quotation;
