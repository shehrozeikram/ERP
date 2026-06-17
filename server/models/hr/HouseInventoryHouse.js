const mongoose = require('mongoose');

const houseInventoryHouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 200
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

houseInventoryHouseSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('HouseInventoryHouse', houseInventoryHouseSchema);
