const mongoose = require('mongoose');

const deliveryChallanItemSchema = new mongoose.Schema({
  poLineIndex: {
    type: Number,
    required: true,
    min: 0
  },
  productCode: { type: String, trim: true, default: '' },
  itemCode: { type: String, trim: true, default: '' },
  itemName: { type: String, trim: true, default: '' },
  quantity: { type: Number, required: true, min: 0.01 },
  unit: { type: String, trim: true, default: '' },
  unitPrice: { type: Number, default: 0, min: 0 },
  /** Cumulative qty posted on GRNs against this DC line */
  quantityReceived: { type: Number, default: 0, min: 0 }
}, { _id: true });

const deliveryChallanSchema = new mongoose.Schema({
  dcNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: true,
    index: true
  },
  vendorDcReference: { type: String, trim: true },
  /** Unique gate pass issued with this delivery challan (copied to GRN in full-advance flow). */
  gatePassNo: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['qa_pending', 'qa_passed', 'qa_failed', 'closed'],
    default: 'qa_pending'
  },
  qaStatus: {
    type: String,
    enum: ['pending', 'passed', 'failed'],
    default: 'pending'
  },
  qaTestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  qaTestedAt: { type: Date },
  qaRemarks: { type: String, trim: true },
  items: [deliveryChallanItemSchema],
  grnIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GoodsReceive' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

/** Next DC####### from highest existing number (not count — count breaks after deletes). */
async function allocateNextDcNumber(Model) {
  const last = await Model.findOne({ dcNumber: { $regex: /^DC\d+$/i } })
    .sort({ dcNumber: -1 })
    .select('dcNumber')
    .lean();
  let next = 1;
  if (last?.dcNumber) {
    const n = parseInt(String(last.dcNumber).replace(/^DC/i, ''), 10);
    if (Number.isFinite(n) && n >= 0) next = n + 1;
  }
  return `DC${String(next).padStart(8, '0')}`;
}

deliveryChallanSchema.pre('save', async function (next) {
  try {
    const Model = mongoose.model('DeliveryChallan');
    if (!this.dcNumber) {
      this.dcNumber = await allocateNextDcNumber(Model);
    }
    if (!this.gatePassNo) {
      this.gatePassNo = `GP-${this.dcNumber}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

deliveryChallanSchema.statics.createWithUniqueDcNumber = async function (payload, { maxAttempts = 8 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const doc = new this({
        ...payload,
        dcNumber: undefined,
        gatePassNo: undefined
      });
      await doc.save();
      return doc;
    } catch (err) {
      lastErr = err;
      const isDup =
        err?.code === 11000 &&
        (String(err?.message || '').includes('dcNumber') ||
          String(err?.message || '').includes('gatePassNo') ||
          err?.keyPattern?.dcNumber ||
          err?.keyPattern?.gatePassNo);
      if (!isDup) throw err;
    }
  }
  throw lastErr || new Error('Could not allocate a unique delivery challan number');
};

module.exports = mongoose.model('DeliveryChallan', deliveryChallanSchema);
