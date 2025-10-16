const mongoose = require('mongoose');

const bankingSchema = new mongoose.Schema({
  // Bank account information
  accountName: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    trim: true
  },
  routingNumber: {
    type: String,
    required: [true, 'Routing number is required'],
    trim: true
  },
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true
  },
  accountType: {
    type: String,
    enum: ['checking', 'savings', 'money_market', 'cd', 'line_of_credit', 'credit_card'],
    required: [true, 'Account type is required']
  },
  // Financial information
  currentBalance: {
    type: Number,
    default: 0,
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  availableBalance: {
    type: Number,
    default: 0,
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  creditLimit: {
    type: Number,
    default: 0,
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  interestRate: {
    type: Number,
    default: 0,
    min: [0, 'Interest rate cannot be negative'],
    max: [100, 'Interest rate cannot exceed 100%']
  },
  // Account settings
  isActive: {
    type: Boolean,
    default: true
  },
  isReconciled: {
    type: Boolean,
    default: false
  },
  lastReconciledDate: Date,
  lastReconciledBalance: {
    type: Number,
    default: 0,
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  // Department integration
  department: {
    type: String,
    enum: ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general'],
    default: 'finance'
  },
  module: {
    type: String,
    enum: ['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general'],
    default: 'general'
  },
  // Transactions
  transactions: [{
    transactionDate: {
      type: Date,
      required: [true, 'Transaction date is required']
    },
    description: {
      type: String,
      required: [true, 'Transaction description is required'],
      trim: true
    },
    reference: {
      type: String,
      trim: true
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    transactionType: {
      type: String,
      enum: ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'fee', 'interest', 'adjustment'],
      required: [true, 'Transaction type is required']
    },
    balance: {
      type: Number,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    isReconciled: {
      type: Boolean,
      default: false
    },
    reconciledDate: Date,
    journalEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry'
    },
    department: {
      type: String,
      enum: ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general'],
      default: 'general'
    },
    module: {
      type: String,
      enum: ['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general'],
      default: 'general'
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    referenceType: {
      type: String,
      enum: ['payroll', 'invoice', 'bill', 'payment', 'receipt', 'adjustment', 'manual'],
      default: 'manual'
    },
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required']
    }
  }],
  // Bank reconciliation
  reconciliation: {
    statementDate: Date,
    statementBalance: {
      type: Number,
      default: 0,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    bookBalance: {
      type: Number,
      default: 0,
      get: function(val) {
        return Math.round(val * 100) / 100;
      },
      set: function(val) {
        return Math.round(val * 100) / 100;
      }
    },
    outstandingDeposits: [{
      date: Date,
      amount: {
        type: Number,
        get: function(val) {
          return Math.round(val * 100) / 100;
        },
        set: function(val) {
          return Math.round(val * 100) / 100;
        }
      },
      description: String
    }],
    outstandingChecks: [{
      checkNumber: String,
      date: Date,
      amount: {
        type: Number,
        get: function(val) {
          return Math.round(val * 100) / 100;
        },
        set: function(val) {
          return Math.round(val * 100) / 100;
        }
      },
      description: String,
      payee: String
    }],
    bankCharges: [{
      date: Date,
      amount: {
        type: Number,
        get: function(val) {
          return Math.round(val * 100) / 100;
        },
        set: function(val) {
          return Math.round(val * 100) / 100;
        }
      },
      description: String
    }],
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reconciledDate: Date,
    notes: String
  },
  // Additional fields
  notes: String,
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
bankingSchema.index({ accountNumber: 1 });
bankingSchema.index({ bankName: 1 });
bankingSchema.index({ accountType: 1 });
bankingSchema.index({ isActive: 1 });
bankingSchema.index({ department: 1 });
bankingSchema.index({ 'transactions.transactionDate': 1 });

// Virtuals
bankingSchema.virtual('formattedCurrentBalance').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.currentBalance);
});

bankingSchema.virtual('formattedAvailableBalance').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.availableBalance);
});

bankingSchema.virtual('isOverdrawn').get(function() {
  return this.currentBalance < 0;
});

// Pre-save middleware
bankingSchema.pre('save', function(next) {
  // Calculate current balance from transactions
  if (this.transactions && this.transactions.length > 0) {
    this.currentBalance = this.transactions.reduce((sum, transaction) => {
      switch (transaction.transactionType) {
        case 'deposit':
        case 'transfer_in':
        case 'interest':
          return sum + transaction.amount;
        case 'withdrawal':
        case 'transfer_out':
        case 'fee':
          return sum - transaction.amount;
        default:
          return sum;
      }
    }, 0);
  }

  // Update available balance (considering credit limits for credit accounts)
  if (this.accountType === 'credit_card') {
    this.availableBalance = this.creditLimit + this.currentBalance;
  } else {
    this.availableBalance = this.currentBalance;
  }

  next();
});

// Method to add transaction
bankingSchema.methods.addTransaction = async function(transactionData) {
  const JournalEntry = mongoose.model('JournalEntry');
  const Account = mongoose.model('Account');

  // Find the bank account in chart of accounts
  const bankAccount = await Account.findOne({ accountNumber: this.accountNumber });
  if (!bankAccount) {
    throw new Error('Bank account not found in chart of accounts');
  }

  // Create journal entry for the transaction
  let journalEntry;
  
  if (transactionData.transactionType === 'deposit') {
    // Deposit: Debit Cash/Bank, Credit appropriate account
    const sourceAccount = await Account.findOne({ accountNumber: '4000' }); // Revenue or appropriate account
    
    journalEntry = new JournalEntry({
      date: transactionData.transactionDate,
      reference: transactionData.reference || `DEP-${Date.now()}`,
      description: transactionData.description,
      department: transactionData.department || this.department,
      module: transactionData.module || this.module,
      referenceId: transactionData.referenceId,
      referenceType: transactionData.referenceType || 'manual',
      lines: [
        {
          account: bankAccount._id,
          description: transactionData.description,
          debit: transactionData.amount,
          department: transactionData.department || this.department
        },
        {
          account: sourceAccount._id,
          description: transactionData.description,
          credit: transactionData.amount,
          department: transactionData.department || this.department
        }
      ],
      createdBy: transactionData.createdBy
    });
  } else if (transactionData.transactionType === 'withdrawal') {
    // Withdrawal: Debit appropriate account, Credit Cash/Bank
    const expenseAccount = await Account.findOne({ accountNumber: '5000' }); // Expense account
    
    journalEntry = new JournalEntry({
      date: transactionData.transactionDate,
      reference: transactionData.reference || `WDL-${Date.now()}`,
      description: transactionData.description,
      department: transactionData.department || this.department,
      module: transactionData.module || this.module,
      referenceId: transactionData.referenceId,
      referenceType: transactionData.referenceType || 'manual',
      lines: [
        {
          account: expenseAccount._id,
          description: transactionData.description,
          debit: transactionData.amount,
          department: transactionData.department || this.department
        },
        {
          account: bankAccount._id,
          description: transactionData.description,
          credit: transactionData.amount,
          department: transactionData.department || this.department
        }
      ],
      createdBy: transactionData.createdBy
    });
  }

  if (journalEntry) {
    await journalEntry.post(transactionData.createdBy);
  }

  // Add transaction to bank account
  this.transactions.push({
    ...transactionData,
    journalEntry: journalEntry?._id
  });

  return this.save();
};

// Method to reconcile account
bankingSchema.methods.reconcile = async function(reconciliationData) {
  const { statementDate, statementBalance, outstandingDeposits, outstandingChecks, bankCharges, notes, reconciledBy } = reconciliationData;

  // Calculate book balance
  const bookBalance = this.currentBalance;

  // Add outstanding deposits
  const totalOutstandingDeposits = outstandingDeposits.reduce((sum, dep) => sum + dep.amount, 0);

  // Subtract outstanding checks
  const totalOutstandingChecks = outstandingChecks.reduce((sum, check) => sum + check.amount, 0);

  // Subtract bank charges
  const totalBankCharges = bankCharges.reduce((sum, charge) => sum + charge.amount, 0);

  const adjustedBookBalance = bookBalance + totalOutstandingDeposits - totalOutstandingChecks - totalBankCharges;

  this.reconciliation = {
    statementDate,
    statementBalance,
    bookBalance: adjustedBookBalance,
    outstandingDeposits,
    outstandingChecks,
    bankCharges,
    reconciledBy,
    reconciledDate: new Date(),
    notes
  };

  this.isReconciled = true;
  this.lastReconciledDate = new Date();
  this.lastReconciledBalance = statementBalance;

  // Mark transactions as reconciled
  this.transactions.forEach(transaction => {
    if (transaction.transactionDate <= statementDate) {
      transaction.isReconciled = true;
      transaction.reconciledDate = new Date();
    }
  });

  return this.save();
};

// Static methods
bankingSchema.statics.getCashFlowReport = async function(startDate, endDate) {
  const pipeline = [
    {
      $unwind: '$transactions'
    },
    {
      $match: {
        'transactions.transactionDate': { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          account: '$accountName',
          department: '$department',
          type: '$transactions.transactionType'
        },
        totalAmount: { $sum: '$transactions.amount' },
        transactionCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.department',
        accounts: {
          $push: {
            account: '$_id.account',
            type: '$_id.type',
            totalAmount: '$totalAmount',
            transactionCount: '$transactionCount'
          }
        },
        departmentTotal: { $sum: '$totalAmount' }
      }
    }
  ];

  return this.aggregate(pipeline);
};

bankingSchema.statics.getAccountSummary = async function() {
  const pipeline = [
    {
      $group: {
        _id: '$accountType',
        accountCount: { $sum: 1 },
        totalBalance: { $sum: '$currentBalance' },
        totalAvailable: { $sum: '$availableBalance' }
      }
    }
  ];

  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Banking', bankingSchema);
