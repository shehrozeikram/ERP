const mongoose = require('mongoose');

const reconciliationRecordSchema = new mongoose.Schema({
  monthKey: { type: String, required: true, index: true },
  reconcileAmount: { type: Number, required: true, default: 0 },
  attachmentPath: { type: String, default: null },
  attachmentOriginalName: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

reconciliationRecordSchema.index({ monthKey: 1 }, { unique: true });

module.exports = mongoose.model('ReconciliationRecord', reconciliationRecordSchema);
