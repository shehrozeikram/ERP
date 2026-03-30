const mongoose = require('mongoose');

const assetTagSchema = new mongoose.Schema(
  {
    tagCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FixedAsset',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'void'],
      default: 'active'
    },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, trim: true }
  },
  { timestamps: true }
);

assetTagSchema.index({ asset: 1, status: 1 });

module.exports = mongoose.model('AssetTag', assetTagSchema);
