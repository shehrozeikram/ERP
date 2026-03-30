const mongoose = require('mongoose');

const budgetLineSchema = new mongoose.Schema({
  account:      { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  accountName:  { type: String, trim: true },
  budgetAmount: { type: Number, default: 0, min: 0 },
  notes:        { type: String, trim: true }
}, { _id: true });

const budgetSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  fiscalYear:  { type: Number, required: true },          // e.g. 2025
  startDate:   { type: Date, required: true },
  endDate:     { type: Date, required: true },
  department:  { type: String, trim: true },
  description: { type: String, trim: true },
  status:      { type: String, enum: ['draft', 'approved', 'locked'], default: 'draft' },
  lines:       { type: [budgetLineSchema], default: [] },
  totalBudget: { type: Number, default: 0 },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt:  { type: Date },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

budgetSchema.pre('save', function (next) {
  this.totalBudget = this.lines.reduce((s, l) => s + (l.budgetAmount || 0), 0);
  next();
});

budgetSchema.index({ fiscalYear: 1, department: 1 });
budgetSchema.index({ status: 1 });

module.exports = mongoose.model('Budget', budgetSchema);
