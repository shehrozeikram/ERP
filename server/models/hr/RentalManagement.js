const mongoose = require('mongoose');

const rentalManagementSchema = new mongoose.Schema({
  rentalAgreement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentalAgreement'
  },
  advancePayment: {
    type: Number,
    default: 0
  },
  agreementDate: {
    type: Date
  },
  vendorIdCard: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String
  },
  title: {
    type: String
  },
  subtitle: {
    type: String
  },
  location: {
    type: String
  },
  custodian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  status: {
    type: String,
    enum: ['Draft', 'HOD Admin', 'Audit', 'Finance', 'CEO/President', 'Approved', 'Paid', 'Rejected'],
    default: 'Draft'
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

rentalManagementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('RentalManagement', rentalManagementSchema);
