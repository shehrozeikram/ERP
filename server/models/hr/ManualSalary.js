const mongoose = require('mongoose');

const manualSalarySchema = new mongoose.Schema({
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  empId: {
    type: String,
    trim: true,
    default: ''
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  designation: {
    type: String,
    trim: true,
    default: ''
  },
  project: {
    type: String,
    trim: true,
    default: ''
  },
  doj: {
    type: String,
    trim: true,
    default: ''
  },
  basicSalary: {
    type: Number,
    default: 0
  },
  foodAllowance: {
    type: Number,
    default: 0
  },
  houseRentAllowance: {
    type: Number,
    default: 0
  },
  medicalAllowance: {
    type: Number,
    default: 0
  },
  conveyanceAllowance: {
    type: Number,
    default: 0
  },
  vehicleAllowance: {
    type: Number,
    default: 0
  },
  fuelAllowance: {
    type: Number,
    default: 0
  },
  specialAllowance: {
    type: Number,
    default: 0
  },
  otherAllowance: {
    type: Number,
    default: 0
  },
  grossSalary: {
    type: Number,
    default: 0
  },
  incomeTax: {
    type: Number,
    default: 0
  },
  netPayable: {
    type: Number,
    default: 0
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ManualSalary', manualSalarySchema);
