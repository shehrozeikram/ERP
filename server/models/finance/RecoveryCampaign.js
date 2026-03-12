const mongoose = require('mongoose');

const recoveryCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
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

recoveryCampaignSchema.index({ isActive: 1 });
recoveryCampaignSchema.index({ name: 1 });

module.exports = mongoose.model('RecoveryCampaign', recoveryCampaignSchema);
