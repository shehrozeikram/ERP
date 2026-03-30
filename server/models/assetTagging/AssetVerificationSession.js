const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema(
  {
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'FixedAsset', required: true },
    tagCode: { type: String, trim: true },
    result: {
      type: String,
      enum: ['pending', 'found', 'missing', 'wrong_location'],
      default: 'pending'
    },
    scannedAt: Date,
    note: { type: String, trim: true }
  },
  { _id: true }
);

const assetVerificationSessionSchema = new mongoose.Schema(
  {
    sessionNumber: { type: String, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    locationFilter: { type: String, trim: true },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lines: [lineSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssetVerificationSession', assetVerificationSessionSchema);
