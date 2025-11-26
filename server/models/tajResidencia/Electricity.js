const mongoose = require('mongoose');

const electricitySchema = new mongoose.Schema({
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
  // Meter and Reading Details
  meterNo: {
    type: String,
    trim: true,
    index: true
  },
  propertyType: {
    type: String,
    default: 'Residential',
    trim: true
  },
  prvReading: {
    type: Number,
    default: 0
  },
  curReading: {
    type: Number,
    default: 0
  },
  unitsConsumed: {
    type: Number,
    default: 0
  },
  unitsConsumedForDays: {
    type: Number,
    default: 0
  },
  iescoSlabs: {
    type: String,
    trim: true
  },
  // Billing Period
  fromDate: {
    type: Date
  },
  toDate: {
    type: Date
  },
  month: {
    type: String,
    trim: true
  },
  dueDate: {
    type: Date
  },
  // Pricing and Charges
  iescoUnitPrice: {
    type: Number,
    default: 0
  },
  electricityCost: {
    type: Number,
    default: 0
  },
  fcSurcharge: {
    type: Number,
    default: 0
  },
  meterRent: {
    type: Number,
    default: 0
  },
  njSurcharge: {
    type: Number,
    default: 0
  },
  gst: {
    type: Number,
    default: 0
  },
  electricityDuty: {
    type: Number,
    default: 0
  },
  tvFee: {
    type: Number,
    default: 0
  },
  fixedCharges: {
    type: Number,
    default: 0
  },
  totalBill: {
    type: Number,
    default: 0
  },
  withSurcharge: {
    type: Number,
    default: 0
  },
  receivedAmount: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  // Financial Details
  arrears: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
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
electricitySchema.index({ invoiceNumber: 1 });
electricitySchema.index({ plotNo: 1 });
electricitySchema.index({ sector: 1 });
electricitySchema.index({ status: 1 });
electricitySchema.index({ owner: 1 });

// Auto-generate serial number before saving
electricitySchema.pre('save', async function(next) {
  if (this.isNew && !this.serialNumber) {
    const lastRecord = await this.constructor.findOne({}, {}, { sort: { serialNumber: -1 } });
    this.serialNumber = lastRecord ? lastRecord.serialNumber + 1 : 1;
  }
  next();
});

module.exports = mongoose.model('Electricity', electricitySchema);

