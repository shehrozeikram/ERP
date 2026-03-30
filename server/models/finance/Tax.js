const mongoose = require('mongoose');

const taxSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tax name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    code: {
      type: String,
      required: [true, 'Tax code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Code cannot exceed 20 characters']
    },
    // GST (Sales Tax), WHT (Withholding Tax), Income Tax, Custom Duty, etc.
    taxType: {
      type: String,
      enum: ['gst', 'wht', 'income_tax', 'custom_duty', 'other'],
      required: [true, 'Tax type is required']
    },
    // Whether this is applied on purchases, sales, or both
    scope: {
      type: String,
      enum: ['purchase', 'sale', 'both'],
      default: 'both'
    },
    rate: {
      type: Number,
      required: [true, 'Tax rate is required'],
      min: [0, 'Rate cannot be negative'],
      max: [100, 'Rate cannot exceed 100']
    },
    // Calculation method: percentage of amount, or fixed amount per unit
    computeMethod: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    // Inclusion: exclusive (tax added on top) or inclusive (tax already in price)
    priceIncludesTax: {
      type: Boolean,
      default: false
    },
    // Accounts where tax is collected / paid
    taxPayableAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      comment: 'Liability account for tax collected on sales (GST payable)'
    },
    taxReceivableAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      comment: 'Asset account for input tax on purchases (GST receivable)'
    },
    // For WHT: which account to credit when deducting from vendor payment
    whtPayableAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      comment: 'WHT payable to FBR — used when paying vendors'
    },
    description: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

taxSchema.index({ taxType: 1 });
taxSchema.index({ scope: 1 });
taxSchema.index({ isActive: 1 });

/**
 * Calculate the tax amount for a given base amount.
 * Returns { taxAmount, taxableAmount, totalAmount }
 */
taxSchema.methods.calculate = function (baseAmount) {
  const base = Number(baseAmount) || 0;
  let taxAmount = 0;
  let taxableAmount = base;

  if (this.computeMethod === 'percentage') {
    if (this.priceIncludesTax) {
      taxableAmount = Math.round((base / (1 + this.rate / 100)) * 100) / 100;
      taxAmount = Math.round((base - taxableAmount) * 100) / 100;
    } else {
      taxAmount = Math.round((base * this.rate) / 100 * 100) / 100;
    }
  } else {
    taxAmount = Math.round(this.rate * 100) / 100;
  }

  return {
    taxableAmount,
    taxAmount,
    totalAmount: Math.round((taxableAmount + taxAmount) * 100) / 100
  };
};

module.exports = mongoose.model('Tax', taxSchema);
