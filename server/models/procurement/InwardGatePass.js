const mongoose = require('mongoose');

/**
 * InwardGatePass (IGP) Model — Step 1 of Physical Goods Receiving Pipeline
 * Captures vehicle entry at gate before physical inspection & GRN creation.
 */
const inwardGatePassSchema = new mongoose.Schema(
  {
    igpNumber: {
      type: String,
      unique: true,
      trim: true
    },
    gatePassDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true
    },
    supplierName: {
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
    vehicleNo: {
      type: String,
      required: true,
      trim: true
    },
    driverName: {
      type: String,
      trim: true
    },
    driverPhone: {
      type: String,
      trim: true
    },
    deliveryChallanNo: {
      type: String,
      trim: true
    },
    itemsReceived: [
      {
        itemCode: { type: String, trim: true },
        itemName: { type: String, required: true, trim: true },
        unit: { type: String, required: true, trim: true },
        quantityDelivered: { type: Number, required: true, min: 1 },
        remarks: { type: String, trim: true }
      }
    ],
    status: {
      type: String,
      enum: ['Gate Entry', 'Inspected', 'GRN Created', 'Cancelled'],
      default: 'Gate Entry'
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Pre-save: Auto-generate IGP number (IGP000001)
inwardGatePassSchema.pre('save', async function (next) {
  if (!this.igpNumber) {
    const count = await mongoose.model('InwardGatePass').countDocuments();
    this.igpNumber = `IGP${String(count + 1).padStart(7, '0')}`;
  }
  next();
});

inwardGatePassSchema.index({ igpNumber: 1 });
inwardGatePassSchema.index({ gatePassDate: -1 });
inwardGatePassSchema.index({ supplier: 1 });
inwardGatePassSchema.index({ status: 1 });

module.exports = mongoose.model('InwardGatePass', inwardGatePassSchema);
