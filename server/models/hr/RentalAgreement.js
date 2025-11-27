const mongoose = require('mongoose');

const rentalAgreementSchema = new mongoose.Schema({
  agreementNumber: {
    type: String,
    required: true,
    unique: true
  },
  propertyName: {
    type: String,
    required: true
  },
  agreementImage: {
    type: String // Path to uploaded agreement image
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

rentalAgreementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('RentalAgreement', rentalAgreementSchema);
