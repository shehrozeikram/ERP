const mongoose = require('mongoose');

const recoveryAssignmentSchema = new mongoose.Schema(
  {
    orderCode: { type: String, trim: true, index: true },
    customerName: { type: String, trim: true, index: true },
    bookingDate: { type: Date },
    sector: { type: String, trim: true, index: true },
    size: { type: String, trim: true },
    cnic: { type: String, trim: true, index: true },
    mobileNumber: { type: String, trim: true },
    customerAddress: { type: String, trim: true },
    length: { type: String, trim: true },
    plotNo: { type: String, trim: true, index: true },
    status: { type: String, trim: true, index: true },
    salePrice: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
    currentlyDue: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    whatsappFeedback: { type: String, trim: true, default: '' },
    callFeedback: { type: String, trim: true, default: '' },
    lastCampaignSentAt: { type: Date },
    lastCampaignName: { type: String, trim: true, default: '' },
    taskStatus: { type: String, trim: true, default: 'pending' },
    taskCompletedAt: { type: Date },
    taskCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

recoveryAssignmentSchema.index({ orderCode: 1, customerName: 1 });
recoveryAssignmentSchema.index({ status: 1, sector: 1 });
// Default Recovery Assignments list sorts by currentlyDue (see GET /recovery-assignments); without this,
// large collections do in-memory / collection scans and often hit gateway timeouts in production.
recoveryAssignmentSchema.index({ currentlyDue: -1, sortOrder: 1, orderCode: 1 });
recoveryAssignmentSchema.index({ currentlyDue: 1, sortOrder: 1, orderCode: 1 });
// Unread filter loads all rows sorted by sortOrder then orderCode before slicing in memory.
recoveryAssignmentSchema.index({ sortOrder: 1, orderCode: 1 });

module.exports = mongoose.model('RecoveryAssignment', recoveryAssignmentSchema);
