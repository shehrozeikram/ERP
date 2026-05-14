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

deliveryChallanSchema.pre('save', async function(next) {
  const Model = mongoose.model('DeliveryChallan');
  if (!this.dcNumber) {
    const count = await Model.countDocuments();
    this.dcNumber = `DC${String(count + 1).padStart(8, '0')}`;
  }
  if (!this.gatePassNo) {
    this.gatePassNo = `GP-${this.dcNumber}`;
  }
  next();
});

module.exports = mongoose.model('DeliveryChallan', deliveryChallanSchema);
