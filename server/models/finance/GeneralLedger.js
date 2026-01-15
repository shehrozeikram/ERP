const mongoose = require('mongoose');

const generalLedgerSchema = new mongoose.Schema({
  // Reference to journal entry
  journalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
    required: [true, 'Journal entry reference is required']
  },
  // Account information
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'Account reference is required']
  },
  // Transaction details
  date: {
    type: Date,
    required: [true, 'Transaction date is required']
  },
  entryNumber: {
    type: String,
    required: [true, 'Entry number is required']
  },
  reference: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  // Amounts
  debit: {
    type: Number,
    default: 0,
    min: [0, 'Debit amount cannot be negative'],
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  credit: {
    type: Number,
    default: 0,
    min: [0, 'Credit amount cannot be negative'],
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  runningBalance: {
    type: Number,
    default: 0,
    get: function(val) {
      return Math.round(val * 100) / 100;
    },
    set: function(val) {
      return Math.round(val * 100) / 100;
    }
  },
  // Department and module tracking
  department: {
    type: String,
    enum: ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general'],
    required: [true, 'Department is required']
  },
  module: {
    type: String,
    enum: ['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general', 'finance', 'taj_utilities'],
    required: [true, 'Module is required']
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceType: {
    type: String,
    enum: ['payroll', 'invoice', 'bill', 'payment', 'receipt', 'adjustment', 'manual'],
    default: 'manual'
  },
  // Status
  status: {
    type: String,
    enum: ['posted', 'reversed', 'cancelled'],
    default: 'posted'
  },
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  },
  postedDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
generalLedgerSchema.index({ account: 1, date: 1 });
generalLedgerSchema.index({ date: 1 });
generalLedgerSchema.index({ entryNumber: 1 });
generalLedgerSchema.index({ department: 1 });
generalLedgerSchema.index({ module: 1 });
generalLedgerSchema.index({ referenceId: 1 });
generalLedgerSchema.index({ status: 1 });

// Virtual for formatted amounts
generalLedgerSchema.virtual('formattedDebit').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.debit);
});

generalLedgerSchema.virtual('formattedCredit').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.credit);
});

generalLedgerSchema.virtual('formattedBalance').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.runningBalance);
});

// Static methods for ledger operations
generalLedgerSchema.statics.getAccountLedger = async function(accountId, startDate, endDate) {
  const query = {
    account: accountId,
    status: 'posted'
  };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }

  const entries = await this.find(query)
    .populate('journalEntry', 'entryNumber reference description')
    .populate('account', 'accountNumber name type')
    .populate('createdBy', 'firstName lastName')
    .sort({ date: 1, entryNumber: 1 });

  // Calculate running balances
  let runningBalance = 0;
  entries.forEach(entry => {
    runningBalance += (entry.debit - entry.credit);
    entry.runningBalance = runningBalance;
  });

  return entries;
};

generalLedgerSchema.statics.getGeneralLedger = async function(filters = {}) {
  const query = { status: 'posted', ...filters };
  
  const entries = await this.find(query)
    .populate('journalEntry', 'entryNumber reference description department module')
    .populate('account', 'accountNumber name type category')
    .populate('createdBy', 'firstName lastName')
    .sort({ date: 1, entryNumber: 1 });

  return entries;
};

generalLedgerSchema.statics.getDepartmentLedger = async function(department, startDate, endDate) {
  const query = {
    department,
    status: 'posted'
  };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }

  return this.find(query)
    .populate('journalEntry', 'entryNumber reference description')
    .populate('account', 'accountNumber name type category')
    .populate('createdBy', 'firstName lastName')
    .sort({ date: 1, entryNumber: 1 });
};

generalLedgerSchema.statics.getModuleLedger = async function(module, startDate, endDate) {
  const query = {
    module,
    status: 'posted'
  };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }

  return this.find(query)
    .populate('journalEntry', 'entryNumber reference description')
    .populate('account', 'accountNumber name type category')
    .populate('createdBy', 'firstName lastName')
    .sort({ date: 1, entryNumber: 1 });
};

generalLedgerSchema.statics.getAccountBalance = async function(accountId, asOfDate = new Date()) {
  const entry = await this.findOne({
    account: accountId,
    status: 'posted',
    date: { $lte: asOfDate }
  }).sort({ date: -1, createdAt: -1 });

  return entry ? entry.runningBalance : 0;
};

generalLedgerSchema.statics.getAccountSummary = async function(accountId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        account: mongoose.Types.ObjectId(accountId),
        status: 'posted'
      }
    }
  ];

  if (startDate || endDate) {
    const dateMatch = {};
    if (startDate) dateMatch.$gte = startDate;
    if (endDate) dateMatch.$lte = endDate;
    pipeline[0].$match.date = dateMatch;
  }

  pipeline.push(
    {
      $group: {
        _id: '$account',
        totalDebits: { $sum: '$debit' },
        totalCredits: { $sum: '$credit' },
        transactionCount: { $sum: 1 },
        firstTransaction: { $min: '$date' },
        lastTransaction: { $max: '$date' }
      }
    },
    {
      $lookup: {
        from: 'accounts',
        localField: '_id',
        foreignField: '_id',
        as: 'account'
      }
    },
    {
      $unwind: '$account'
    }
  );

  const result = await this.aggregate(pipeline);
  return result[0] || null;
};

// Method to create ledger entry from journal entry line
generalLedgerSchema.statics.createFromJournalEntry = async function(journalEntry, line, account) {
  const Account = mongoose.model('Account');
  
  // Get current balance for running balance calculation
  const currentBalance = await this.getAccountBalance(account._id, journalEntry.date);
  
  const ledgerEntry = new this({
    journalEntry: journalEntry._id,
    account: account._id,
    date: journalEntry.date,
    entryNumber: journalEntry.entryNumber,
    reference: journalEntry.reference,
    description: line.description || journalEntry.description,
    debit: line.debit,
    credit: line.credit,
    runningBalance: currentBalance + (line.debit - line.credit),
    department: journalEntry.department,
    module: journalEntry.module,
    referenceId: journalEntry.referenceId,
    referenceType: journalEntry.referenceType,
    createdBy: journalEntry.createdBy,
    postedDate: journalEntry.postedDate
  });

  return ledgerEntry.save();
};

module.exports = mongoose.model('GeneralLedger', generalLedgerSchema);
