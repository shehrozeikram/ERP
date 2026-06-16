const mongoose = require('mongoose');

const houseInventoryItemSchema = new mongoose.Schema({
  houseName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  areaName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  serialNo: {
    type: Number,
    default: null
  },
  inventoryDate: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  quantityText: {
    type: String,
    trim: true,
    default: ''
  },
  quantityValue: {
    type: Number,
    default: null
  },
  quantityUnit: {
    type: String,
    trim: true,
    default: ''
  },
  sourceSheet: {
    type: String,
    trim: true,
    default: ''
  },
  sourceRow: {
    type: Number,
    default: null
  },
  importedFromWorkbook: {
    type: Boolean,
    default: false
  },
  notes: {
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

houseInventoryItemSchema.index({ houseName: 1, areaName: 1, description: 1 });

module.exports = mongoose.model('HouseInventoryItem', houseInventoryItemSchema);
