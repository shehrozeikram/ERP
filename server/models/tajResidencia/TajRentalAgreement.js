const mongoose = require('mongoose');

const tajRentalAgreementSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
    trim: true
  },
  agreementNumber: {
    type: String,
    required: true,
    unique: true
  },
  propertyName: {
    type: String,
    required: true
  },
  propertyAddress: {
    type: String,
    required: true
  },
  tenantName: {
    type: String,
    required: true
  },
  tenantContact: {
    type: String,
    required: true
  },
  tenantIdCard: {
    type: String
  },
  monthlyRent: {
    type: Number,
    required: true
  },
  securityDeposit: {
    type: Number,
    default: 0
  },
  annualRentIncreaseType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  annualRentIncreaseValue: {
    type: Number,
    default: 0
  },
  increasedRent: {
    type: Number
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  terms: {
    type: String
  },
  agreementImage: {
    type: String
  },
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Terminated'],
    default: 'Active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

tajRentalAgreementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (this.monthlyRent && this.annualRentIncreaseValue > 0) {
    if (this.annualRentIncreaseType === 'percentage') {
      this.increasedRent = Math.round(this.monthlyRent * (1 + this.annualRentIncreaseValue / 100));
    } else if (this.annualRentIncreaseType === 'fixed') {
      this.increasedRent = this.monthlyRent + this.annualRentIncreaseValue;
    }
  } else {
    this.increasedRent = this.monthlyRent;
  }

  next();
});

module.exports = mongoose.model('TajRentalAgreement', tajRentalAgreementSchema);


