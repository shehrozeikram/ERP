const mongoose = require('mongoose');

const EVENT_TYPES = [
  'tag_issued',
  'tag_voided',
  'scan',
  'transfer',
  'verified_found',
  'verified_missing',
  'session_started',
  'session_closed'
];

const assetTagEventSchema = new mongoose.Schema(
  {
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'FixedAsset', index: true },
    tagCode: { type: String, trim: true, index: true },
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: true
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
    location: { type: String, trim: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetVerificationSession' },
    meta: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

assetTagEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AssetTagEvent', assetTagEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
