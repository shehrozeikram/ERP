const mongoose = require('mongoose');

const fbrTaxSlabSchema = new mongoose.Schema({
  fiscalYear: {
    type: String,
    required: [true, 'Fiscal year is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  slabs: [{
    minAmount: {
      type: Number,
      required: [true, 'Minimum amount is required'],
      min: [0, 'Minimum amount cannot be negative']
    },
    maxAmount: {
      type: Number,
      required: [true, 'Maximum amount is required'],
      min: [0, 'Maximum amount cannot be negative']
    },
    rate: {
      type: Number,
      required: [true, 'Tax rate is required'],
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%']
    },
    fixedTax: {
      type: Number,
      default: 0,
      min: [0, 'Fixed tax cannot be negative']
    },
    description: {
      type: String,
      trim: true
    }
  }],
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional for system initialization
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
fbrTaxSlabSchema.index({ fiscalYear: 1 });
fbrTaxSlabSchema.index({ isActive: 1 });

// Static method to get active tax slabs
fbrTaxSlabSchema.statics.getActiveSlabs = async function() {
  const activeSlabs = await this.findOne({ isActive: true })
    .sort({ fiscalYear: -1 })
    .limit(1);
  
  return activeSlabs;
};

// Static method to calculate tax for given annual income
fbrTaxSlabSchema.statics.calculateTax = async function(annualIncome) {
  const activeSlabs = await this.getActiveSlabs();
  
  if (!activeSlabs || !activeSlabs.slabs.length) {
    throw new Error('No active tax slabs found');
  }

  // Find applicable slab
  const applicableSlab = activeSlabs.slabs.find(slab => 
    annualIncome >= slab.minAmount && annualIncome <= slab.maxAmount
  );

  if (!applicableSlab) {
    return 0;
  }

  // Calculate tax
  if (applicableSlab.rate === 0) {
    return applicableSlab.fixedTax;
  } else {
    const taxableAmount = annualIncome - applicableSlab.minAmount;
    return applicableSlab.fixedTax + (taxableAmount * (applicableSlab.rate / 100));
  }
};

// Static method to get tax slab info
fbrTaxSlabSchema.statics.getTaxSlabInfo = async function(annualIncome) {
  const activeSlabs = await this.getActiveSlabs();
  
  if (!activeSlabs || !activeSlabs.slabs.length) {
    return null;
  }

  const applicableSlab = activeSlabs.slabs.find(slab => 
    annualIncome >= slab.minAmount && annualIncome <= slab.maxAmount
  );

  if (!applicableSlab) {
    return {
      slab: 'Above maximum',
      rate: '0%',
      description: 'No applicable slab'
    };
  }

  return {
    slab: `Rs ${applicableSlab.minAmount.toLocaleString()} - ${applicableSlab.maxAmount === Infinity ? 'Above' : 'Rs ' + applicableSlab.maxAmount.toLocaleString()}`,
    rate: `${applicableSlab.rate}%`,
    description: applicableSlab.description || `Fixed tax: Rs ${applicableSlab.fixedTax.toLocaleString()} + ${applicableSlab.rate}% of amount over Rs ${applicableSlab.minAmount.toLocaleString()}`
  };
};

module.exports = mongoose.model('FBRTaxSlab', fbrTaxSlabSchema); 