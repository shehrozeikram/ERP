const mongoose = require('mongoose');

const bankingSetupSchema = new mongoose.Schema({
  paymentTypes: {
    type: [String],
    default: []
  },
  mainAccountHeads: {
    type: [String],
    default: []
  },
  subAccountHeads: {
    type: [String],
    default: []
  },
  // To ensure singleton, we can use a fixed identifier if needed, though we usually just query findOne()
}, { timestamps: true });

module.exports = mongoose.model('BankingSetup', bankingSetupSchema);
