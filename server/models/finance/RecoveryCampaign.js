const mongoose = require('mongoose');

const recoveryCampaignSchema = new mongoose.Schema(
  {
    isActive: {
      type: Boolean,
      default: true
    },
    whatsappTemplateName: {
      type: String,
      trim: true,
      required: true
    },
    whatsappLanguageCode: {
      type: String,
      trim: true,
      default: ''
    },
    messagePreview: {
      type: String,
      trim: true,
      default: ''
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
recoveryCampaignSchema.index({ whatsappTemplateName: 1 });

module.exports = mongoose.model('RecoveryCampaign', recoveryCampaignSchema);
