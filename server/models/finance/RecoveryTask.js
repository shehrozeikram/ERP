const mongoose = require('mongoose');

const recoveryTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: ''
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecoveryMember',
      required: true
    },
    scopeType: {
      type: String,
      enum: ['sector', 'slab'],
      required: true
    },
    sector: {
      type: String,
      trim: true,
      default: ''
    },
    minAmount: { type: Number, default: 0 },
    maxAmount: { type: Number, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    targetCount: {
      type: Number,
      default: null
    },
    completedCount: {
      type: Number,
      default: 0
    },
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    notes: { type: String, trim: true },
    action: {
      type: String,
      enum: ['whatsapp', 'call', 'both'],
      default: 'both'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

recoveryTaskSchema.index({ assignedTo: 1 });
recoveryTaskSchema.index({ status: 1 });
recoveryTaskSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('RecoveryTask', recoveryTaskSchema);
