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
    nextOfKinCNIC: { type: String, trim: true },
    plotNo: { type: String, trim: true, index: true },
    status: { type: String, trim: true, index: true },
    salePrice: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
    currentlyDue: { type: Number, default: 0 }
  },
  { timestamps: true }
);

recoveryAssignmentSchema.index({ orderCode: 1, customerName: 1 });
recoveryAssignmentSchema.index({ status: 1, sector: 1 });

module.exports = mongoose.model('RecoveryAssignment', recoveryAssignmentSchema);
