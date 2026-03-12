const mongoose = require('mongoose');

const recoveryTaskAssignmentRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['sector', 'slab'],
      required: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecoveryMember',
      required: true
    },
    sector: {
      type: String,
      trim: true,
      default: ''
    },
    minAmount: {
      type: Number,
      default: 0
    },
    maxAmount: {
      type: Number,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    action: {
      type: String,
      enum: ['whatsapp', 'call', 'both'],
      default: 'both'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

recoveryTaskAssignmentRuleSchema.index({ type: 1, sector: 1 });
recoveryTaskAssignmentRuleSchema.index({ assignedTo: 1 });
recoveryTaskAssignmentRuleSchema.index({ isActive: 1 });

module.exports = mongoose.model('RecoveryTaskAssignmentRule', recoveryTaskAssignmentRuleSchema);
