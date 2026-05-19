const mongoose = require('mongoose');

/** Singleton settings for automatic session-refresh follow-up campaigns. */
const recoveryWhatsAppFollowUpSettingsSchema = new mongoose.Schema(
  {
    configKey: { type: String, default: 'default', unique: true },
    enabled: { type: Boolean, default: false },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCampaign', default: null },
    delayHours: { type: Number, default: 14, min: 1, max: 23 },
    lastRunAt: { type: Date },
    lastRunSentCount: { type: Number, default: 0 },
    lastRunSkippedCount: { type: Number, default: 0 },
    lastRunError: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecoveryWhatsAppFollowUpSettings', recoveryWhatsAppFollowUpSettingsSchema);
