const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true,
    maxlength: [100, 'Account name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
    required: [true, 'Account type is required']
  },
  category: {
    type: String,
    enum: [
      // Assets
      'Current Assets', 'Fixed Assets', 'Intangible Assets',
      // Liabilities
      'Current Liabilities', 'Long-term Liabilities',
      // Equity
      'Owner Equity', 'Retained Earnings',
      // Revenue
      'Operating Revenue', 'Non-operating Revenue',
      // Expenses
      'Operating Expenses', 'Non-operating Expenses', 'Cost of Goods Sold'
    ],
    required: [true, 'Account category is required']
  },
  subcategory: {
    type: String,
    trim: true
  },
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  balance: {
    type: Number,
    default: 0,
    get: function(val) {
      return Math.round(val * 100) / 100; // Round to 2 decimal places
    },
    set: function(val) {
      return Math.round(val * 100) / 100; // Round to 2 decimal places
    }
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  allowTransactions: {
    type: Boolean,
    default: true
  },
  reconciliationRequired: {
    type: Boolean,
    default: false
  },
  lastReconciled: Date,
  notes: String,
  // Department integration
  department: {
    type: String,
    enum: ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general'],
    default: 'general'
  },
  // Module integration for auto-posting
  module: {
    type: String,
    enum: ['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general', 'finance', 'taj_utilities'],
    default: 'general'
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalDate: Date
  }
}, {
  timestamps: true
});

// Indexes
accountSchema.index({ accountNumber: 1 });
accountSchema.index({ type: 1 });
accountSchema.index({ category: 1 });
accountSchema.index({ isActive: 1 });
accountSchema.index({ parentAccount: 1 });
accountSchema.index({ department: 1 });
accountSchema.index({ module: 1 });

// Virtual for account hierarchy level
accountSchema.virtual('level').get(function() {
  if (!this.parentAccount) return 0;
  // This would need to be calculated based on parent hierarchy
  return 1; // Simplified for now
});

// Virtual for formatted balance
accountSchema.virtual('formattedBalance').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.balance);
});

// Pre-save middleware to validate account structure
accountSchema.pre('save', function(next) {
  // Validate account number format (e.g., 1000-1999 for assets)
  const accountNum = parseInt(this.accountNumber);
  
  if (this.type === 'Asset' && (accountNum < 1000 || accountNum > 1999)) {
    return next(new Error('Asset accounts should have numbers between 1000-1999'));
  }
  
  if (this.type === 'Liability' && (accountNum < 2000 || accountNum > 2999)) {
    return next(new Error('Liability accounts should have numbers between 2000-2999'));
  }
  
  if (this.type === 'Equity' && (accountNum < 3000 || accountNum > 3999)) {
    return next(new Error('Equity accounts should have numbers between 3000-3999'));
  }
  
  if (this.type === 'Revenue' && (accountNum < 4000 || accountNum > 4999)) {
    return next(new Error('Revenue accounts should have numbers between 4000-4999'));
  }
  
  if (this.type === 'Expense' && (accountNum < 5000 || accountNum > 5999)) {
    return next(new Error('Expense accounts should have numbers between 5000-5999'));
  }
  
  next();
});

// Static method to find active accounts
accountSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find accounts by type
accountSchema.statics.findByType = function(type) {
  return this.find({ type, isActive: true });
};

// Static method to find accounts by category
accountSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Static method to get account hierarchy
accountSchema.statics.getHierarchy = async function() {
  const accounts = await this.find({ isActive: true })
    .populate('parentAccount', 'accountNumber name')
    .lean();

  const buildHierarchy = (parentId = null) => {
    return accounts
      .filter(account => 
        parentId === null 
          ? !account.parentAccount 
          : account.parentAccount && account.parentAccount._id.toString() === parentId.toString()
      )
      .map(account => ({
        ...account,
        children: buildHierarchy(account._id)
      }));
  };

  return buildHierarchy();
};

// Static method to get trial balance
accountSchema.statics.getTrialBalance = async function() {
  const accounts = await this.find({ isActive: true })
    .select('accountNumber name type balance')
    .lean();

  const trialBalance = {
    assets: accounts.filter(acc => acc.type === 'Asset'),
    liabilities: accounts.filter(acc => acc.type === 'Liability'),
    equity: accounts.filter(acc => acc.type === 'Equity'),
    revenue: accounts.filter(acc => acc.type === 'Revenue'),
    expenses: accounts.filter(acc => acc.type === 'Expense')
  };

  // Calculate totals
  trialBalance.totalAssets = trialBalance.assets.reduce((sum, acc) => sum + acc.balance, 0);
  trialBalance.totalLiabilities = trialBalance.liabilities.reduce((sum, acc) => sum + acc.balance, 0);
  trialBalance.totalEquity = trialBalance.equity.reduce((sum, acc) => sum + acc.balance, 0);
  trialBalance.totalRevenue = trialBalance.revenue.reduce((sum, acc) => sum + acc.balance, 0);
  trialBalance.totalExpenses = trialBalance.expenses.reduce((sum, acc) => sum + acc.balance, 0);

  return trialBalance;
};

module.exports = mongoose.model('Account', accountSchema); 