const mongoose = require('mongoose');

const recognitionLineSchema = new mongoose.Schema({
  period:       { type: String, required: true },  // 'YYYY-MM'
  scheduledDate:{ type: Date, required: true },
  amount:       { type: Number, required: true, min: 0 },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  postedAt:     { type: Date },
  status:       { type: String, enum: ['pending', 'posted', 'skipped'], default: 'pending' }
}, { _id: true });

const deferredEntrySchema = new mongoose.Schema({
  type:        { type: String, enum: ['deferred_revenue', 'deferred_expense'], required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  referenceDoc:{ type: String, trim: true },   // e.g. invoice / PO number

  totalAmount:        { type: Number, required: true, min: 0 },
  recognizedAmount:   { type: Number, default: 0 },
  remainingAmount:    { type: Number, default: 0 },

  startDate:   { type: Date, required: true },
  endDate:     { type: Date, required: true },
  frequency:   { type: String, enum: ['monthly', 'quarterly'], default: 'monthly' },

  // GL accounts
  deferredAccount:    { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },  // Balance sheet account
  recognitionAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },  // P&L account
  department:         { type: String, trim: true },

  status:   { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  schedule: { type: [recognitionLineSchema], default: [] },

  sourceJournalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate recognition schedule
deferredEntrySchema.methods.generateSchedule = function () {
  const start  = new Date(this.startDate);
  const end    = new Date(this.endDate);
  const months = [];

  let d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    months.push(new Date(d));
    if (this.frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else d.setMonth(d.getMonth() + 1);
  }

  const perPeriod = months.length > 0 ? Math.round((this.totalAmount / months.length) * 100) / 100 : 0;
  let remaining  = this.totalAmount;
  this.schedule  = [];

  months.forEach((m, i) => {
    const amt = i === months.length - 1 ? Math.round(remaining * 100) / 100 : perPeriod;
    remaining  = Math.round((remaining - amt) * 100) / 100;
    const period = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    this.schedule.push({
      period,
      scheduledDate: new Date(m.getFullYear(), m.getMonth(), 28),
      amount: amt,
      status: 'pending'
    });
  });
};

deferredEntrySchema.pre('save', function (next) {
  this.recognizedAmount = this.schedule
    .filter(s => s.status === 'posted')
    .reduce((s, l) => s + l.amount, 0);
  this.remainingAmount  = Math.round((this.totalAmount - this.recognizedAmount) * 100) / 100;
  if (this.remainingAmount <= 0) this.status = 'completed';
  next();
});

deferredEntrySchema.index({ status: 1 });
deferredEntrySchema.index({ type: 1 });

module.exports = mongoose.model('DeferredEntry', deferredEntrySchema);
