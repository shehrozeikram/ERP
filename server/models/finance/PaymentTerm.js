const mongoose = require('mongoose');

const paymentTermLineSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['balance', 'percent', 'fixed'],
    default: 'balance'
  },
  value: { type: Number, default: 100, min: 0 },   // % or fixed amount
  daysAfterInvoice: { type: Number, default: 0, min: 0 },
  description: { type: String, trim: true }
}, { _id: false });

const paymentTermSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Payment term name is required'],
      unique: true,
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20
    },
    note: { type: String, trim: true },
    // Instalment lines — total must cover 100%
    lines: [paymentTermLineSchema],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

/**
 * Compute due dates from an invoice date.
 * Returns array of { dueDate, amount, description }
 */
paymentTermSchema.methods.computeDueDates = function (invoiceDate, invoiceTotal) {
  const base = new Date(invoiceDate);
  const total = Number(invoiceTotal) || 0;
  let remaining = total;
  return this.lines.map((line, idx) => {
    const dueDate = new Date(base);
    dueDate.setDate(dueDate.getDate() + (line.daysAfterInvoice || 0));
    let amount;
    if (line.type === 'percent') amount = Math.round((total * line.value) / 100 * 100) / 100;
    else if (line.type === 'fixed') amount = Math.min(line.value, remaining);
    else amount = remaining;                          // 'balance'
    remaining = Math.round((remaining - amount) * 100) / 100;
    return { dueDate, amount, description: line.description || `Payment ${idx + 1}` };
  });
};

module.exports = mongoose.model('PaymentTerm', paymentTermSchema);
