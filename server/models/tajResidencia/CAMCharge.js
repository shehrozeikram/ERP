const mongoose = require('mongoose');

const camChargeSchema = new mongoose.Schema({
  // Auto-generated serial number
  serialNumber: {
    type: Number,
    unique: true
  },
  // Invoice Details
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  // Property Details
  plotNo: {
    type: String,
    trim: true
  },
  rdaNo: {
    type: String,
    trim: true
  },
  street: {
    type: String,
    trim: true
  },
  sector: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  project: {
    type: String,
    trim: true
  },
  // Owner Details
  owner: {
    type: String,
    required: true,
    trim: true
  },
  contactNo: {
    type: String,
    trim: true
  },
  // Status and Dates
  status: {
    type: String,
    enum: ['Active', 'Pending', 'Completed', 'Cancelled'],
    default: 'Active'
  },
  fileSubmission: {
    type: Date
  },
  demarcationDate: {
    type: Date
  },
  constructionDate: {
    type: Date
  },
  familyStatus: {
    type: String,
    trim: true
  },
  // Financial Details
  arrears: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  amountInWords: {
    type: String,
    trim: true
  },
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
camChargeSchema.index({ invoiceNumber: 1 });
camChargeSchema.index({ plotNo: 1 });
camChargeSchema.index({ sector: 1 });
camChargeSchema.index({ status: 1 });
camChargeSchema.index({ owner: 1 });

// Auto-generate serial number before saving
camChargeSchema.pre('save', async function(next) {
  if (this.isNew && !this.serialNumber) {
    const lastRecord = await this.constructor.findOne({}, {}, { sort: { serialNumber: -1 } });
    this.serialNumber = lastRecord ? lastRecord.serialNumber + 1 : 1;
  }
  next();
});

module.exports = mongoose.model('CAMCharge', camChargeSchema);

