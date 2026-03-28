const mongoose = require('mongoose');

/**
 * Finance Journal — "folder" concept from Odoo.
 * Every JournalEntry must belong to exactly one Journal.
 * This lets accountants filter and audit entries by source.
 */
const financeJournalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Journal name is required'],
      unique: true,
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Journal code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 10
    },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'bank', 'cash', 'inventory', 'payroll', 'depreciation', 'general'],
      required: [true, 'Journal type is required']
    },
    description: {
      type: String,
      trim: true
    },
    // Default debit/credit account for this journal (used when auto-posting)
    defaultAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // System journals cannot be deleted (Purchase, Inventory, Bank, etc.)
    isSystem: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

financeJournalSchema.index({ code: 1 });
financeJournalSchema.index({ type: 1 });
financeJournalSchema.index({ isActive: 1 });

module.exports = mongoose.model('FinanceJournal', financeJournalSchema);
