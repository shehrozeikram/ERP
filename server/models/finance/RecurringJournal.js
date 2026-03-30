const mongoose = require('mongoose');

const recurringLineSchema = new mongoose.Schema({
  account:     { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  description: { type: String, trim: true },
  debit:       { type: Number, default: 0 },
  credit:      { type: Number, default: 0 },
  department:  { type: String, trim: true }
}, { _id: true });

const recurringJournalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  // Frequency
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    required: true,
    default: 'monthly'
  },

  // Day of month (1-28) for monthly/quarterly/yearly; day of week (0=Sun) for weekly
  dayOfMonth: { type: Number, min: 1, max: 28, default: 1 },

  // When to start and stop
  startDate: { type: Date, required: true },
  endDate:   { type: Date },           // null = run indefinitely
  nextRunDate: { type: Date },         // computed

  // Active flag
  isActive:  { type: Boolean, default: true },

  // Journal entry template
  journalCode: { type: String, trim: true, default: 'GEN' },
  department:  { type: String, trim: true, default: 'finance' },
  lines:       { type: [recurringLineSchema], required: true },

  // Execution history
  lastRunDate:  { type: Date },
  runCount:     { type: Number, default: 0 },
  postedEntries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Compute nextRunDate from frequency + dayOfMonth + startDate
recurringJournalSchema.methods.computeNextRunDate = function (fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date(this.startDate);
  const day  = this.dayOfMonth || 1;

  const nextMonth = (d, n) => {
    const r = new Date(d);
    r.setMonth(r.getMonth() + n);
    r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
    return r;
  };

  switch (this.frequency) {
    case 'daily':     { const d = new Date(base); d.setDate(d.getDate() + 1); return d; }
    case 'weekly':    { const d = new Date(base); d.setDate(d.getDate() + 7); return d; }
    case 'monthly':   return nextMonth(base, 1);
    case 'quarterly': return nextMonth(base, 3);
    case 'yearly':    return nextMonth(base, 12);
    default:          return nextMonth(base, 1);
  }
};

module.exports = mongoose.model('RecurringJournal', recurringJournalSchema);
