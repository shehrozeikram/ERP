const mongoose = require('mongoose');

const depreciationLineSchema = new mongoose.Schema({
  period: { type: String, required: true },    // e.g. "2025-01"
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  amount: { type: Number, required: true, min: 0 },
  bookValue: { type: Number, required: true, min: 0 },
  accumulatedDepreciation: { type: Number, required: true, min: 0 },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
  postedAt: Date,
  status: { type: String, enum: ['pending', 'posted', 'skipped'], default: 'pending' }
}, { _id: true });

const fixedAssetSchema = new mongoose.Schema(
  {
    assetNumber: {
      type: String,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true
    },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ['land', 'building', 'machinery', 'vehicle', 'furniture', 'computer', 'equipment', 'other'],
      default: 'other'
    },
    // Acquisition
    purchaseDate: { type: Date, required: [true, 'Purchase date is required'] },
    purchaseCost: { type: Number, required: [true, 'Purchase cost is required'], min: 0 },
    residualValue: { type: Number, default: 0, min: 0 },
    // Depreciation
    depreciationMethod: {
      type: String,
      enum: ['straight_line', 'declining_balance', 'none'],
      default: 'straight_line'
    },
    usefulLifeYears: { type: Number, default: 5, min: 0 },
    depreciationRate: { type: Number, default: 0, min: 0, max: 100 },
    // Computed / running
    accumulatedDepreciation: { type: Number, default: 0, min: 0 },
    currentBookValue: { type: Number, default: 0, min: 0 },
    lastDepreciationDate: Date,
    // GL accounts
    assetAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    accumulatedDeprecAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    depreciationExpenseAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    // Location / assignment
    location: { type: String, trim: true },
    assignedTo: { type: String, trim: true },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CostCenter' },
    serialNumber: { type: String, trim: true },
    // Status
    status: {
      type: String,
      enum: ['active', 'disposed', 'fully_depreciated'],
      default: 'active'
    },
    disposalDate: Date,
    disposalValue: { type: Number, default: 0 },
    // Depreciation schedule
    depreciationSchedule: [depreciationLineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

fixedAssetSchema.index({ status: 1 });
fixedAssetSchema.index({ category: 1 });
fixedAssetSchema.index({ assetNumber: 1 });

// Auto-generate asset number
fixedAssetSchema.pre('save', async function (next) {
  if (!this.assetNumber) {
    const count = await this.constructor.countDocuments();
    this.assetNumber = `FA-${String(count + 1).padStart(5, '0')}`;
  }
  if (this.isNew) {
    this.currentBookValue = this.purchaseCost - this.accumulatedDepreciation;
  }
  next();
});

// Calculate monthly straight-line depreciation
fixedAssetSchema.methods.calcMonthlyDepreciation = function () {
  if (this.depreciationMethod === 'none' || this.status !== 'active') return 0;
  if (this.depreciationMethod === 'straight_line') {
    const depreciableAmount = this.purchaseCost - this.residualValue;
    const totalMonths = this.usefulLifeYears * 12;
    return totalMonths > 0 ? Math.round((depreciableAmount / totalMonths) * 100) / 100 : 0;
  }
  if (this.depreciationMethod === 'declining_balance') {
    const rate = (this.depreciationRate / 100) / 12;
    return Math.round(this.currentBookValue * rate * 100) / 100;
  }
  return 0;
};

module.exports = mongoose.model('FixedAsset', fixedAssetSchema);
