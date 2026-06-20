const mongoose = require('mongoose');

const companyBankSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlacementCompany',
    required: [true, 'Company is required'],
    index: true
  },
  bankName: {
    type: String,
    required: [true, 'Bank name is required'],
    trim: true,
    maxlength: [120, 'Bank name cannot exceed 120 characters']
  },
  accountTitle: {
    type: String,
    trim: true,
    maxlength: [150, 'Account title cannot exceed 150 characters']
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    trim: true,
    maxlength: [50, 'Account number cannot exceed 50 characters']
  },
  branch: {
    type: String,
    trim: true,
    maxlength: [120, 'Branch cannot exceed 120 characters']
  },
  iban: {
    type: String,
    trim: true,
    maxlength: [34, 'IBAN cannot exceed 34 characters']
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

companyBankSchema.index({ company: 1, accountNumber: 1 }, { unique: true });
companyBankSchema.index({ company: 1, isActive: 1 });

module.exports = mongoose.model('CompanyBank', companyBankSchema);
