const mongoose = require('mongoose');

/**
 * QualityInspection Model — Step 2 of Physical Goods Receiving Pipeline
 * Captures technical inspection, accepted/rejected/damaged quantity breakdown,
 * and test certificates before approving GRN.
 */
const qualityInspectionSchema = new mongoose.Schema(
  {
    inspectionNumber: {
      type: String,
      unique: true,
      trim: true
    },
    inspectionDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    inwardGatePass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InwardGatePass',
      required: true
    },
    igpNumber: {
      type: String,
      trim: true
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder'
    },
    poNumber: {
      type: String,
      trim: true
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [
      {
        itemCode: { type: String, trim: true },
        itemName: { type: String, required: true, trim: true },
        unit: { type: String, required: true, trim: true },
        quantityDelivered: { type: Number, required: true, min: 0 },
        acceptedQuantity: { type: Number, required: true, min: 0 },
        rejectedQuantity: { type: Number, default: 0, min: 0 },
        damagedQuantity: { type: Number, default: 0, min: 0 },
        rejectionReason: { type: String, trim: true },
        batchNumber: { type: String, trim: true },
        lotNumber: { type: String, trim: true },
        heatNumber: { type: String, trim: true },
        expiryDate: { type: Date },
        testCertAttached: { type: Boolean, default: false },
        qcRemarks: { type: String, trim: true }
      }
    ],
    status: {
      type: String,
      enum: ['Passed', 'Partial Pass', 'Failed'],
      default: 'Passed'
    },
    notes: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Pre-save: Auto-generate QC Inspection number (QC000001)
qualityInspectionSchema.pre('save', async function (next) {
  if (!this.inspectionNumber) {
    const count = await mongoose.model('QualityInspection').countDocuments();
    this.inspectionNumber = `QC${String(count + 1).padStart(7, '0')}`;
  }
  next();
});

qualityInspectionSchema.index({ inspectionNumber: 1 });
qualityInspectionSchema.index({ inspectionDate: -1 });
qualityInspectionSchema.index({ inwardGatePass: 1 });
qualityInspectionSchema.index({ status: 1 });

module.exports = mongoose.model('QualityInspection', qualityInspectionSchema);
