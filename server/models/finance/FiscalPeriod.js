const mongoose = require('mongoose');

/**
 * Fiscal Period — monthly accounting period.
 * Once a period is closed, no journal entry can be posted into it.
 * This protects finalized reports from retroactive changes.
 *
 * Status flow: open → closed → locked
 *   open   : Normal posting allowed
 *   closed : Period is closed; only finance managers can re-open
 *   locked : Audited; cannot be re-opened by anyone
 */
const fiscalPeriodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Period name is required'],
      trim: true
    },
    year: {
      type: Number,
      required: [true, 'Fiscal year is required'],
      min: 2000,
      max: 2100
    },
    month: {
      type: Number,
      required: [true, 'Month is required'],
      min: 1,
      max: 12
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'locked'],
      default: 'open'
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    closedAt: Date,
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lockedAt: Date,
    notes: {
      type: String,
      trim: true
    },
    // Closing entries reference (year-end P&L → Retained Earnings transfer)
    closingJournalEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry'
    }
  },
  { timestamps: true }
);

// Each year/month combination must be unique
fiscalPeriodSchema.index({ year: 1, month: 1 }, { unique: true });
fiscalPeriodSchema.index({ status: 1 });
fiscalPeriodSchema.index({ startDate: 1, endDate: 1 });

/**
 * Check if a given date falls within an open fiscal period.
 * Returns the period if found and open, throws if closed/locked.
 */
fiscalPeriodSchema.statics.validatePostingDate = async function (date) {
  const d = new Date(date);
  const period = await this.findOne({
    startDate: { $lte: d },
    endDate: { $gte: d }
  });

  if (!period) return null; // No period defined — allow posting (lenient mode)
  if (period.status === 'closed') {
    throw new Error(
      `Fiscal period ${period.name} is closed. Cannot post journal entries to a closed period.`
    );
  }
  if (period.status === 'locked') {
    throw new Error(
      `Fiscal period ${period.name} is locked. Contact your Finance Manager.`
    );
  }
  return period;
};

/**
 * Auto-generate fiscal periods for a full year.
 */
fiscalPeriodSchema.statics.generateYear = async function (year, createdBy) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const created = [];
  for (let m = 1; m <= 12; m++) {
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 0, 23, 59, 59);
    const exists = await this.findOne({ year, month: m });
    if (!exists) {
      const period = await this.create({
        name: `${months[m - 1]} ${year}`,
        year,
        month: m,
        startDate,
        endDate,
        status: 'open',
        createdBy
      });
      created.push(period);
    }
  }
  return created;
};

module.exports = mongoose.model('FiscalPeriod', fiscalPeriodSchema);
