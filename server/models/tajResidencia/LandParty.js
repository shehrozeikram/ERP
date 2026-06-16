const mongoose = require('mongoose');

const PARTY_TYPES = ['seller', 'buyer', 'dealer'];

const landPartySchema = new mongoose.Schema({
  partyType: {
    type: String,
    required: true,
    enum: PARTY_TYPES,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  cnic: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20
  },
  partyDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

landPartySchema.index(
  { partyType: 1, cnic: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

landPartySchema.index({ partyType: 1, name: 1 });

module.exports = mongoose.model('LandParty', landPartySchema);
module.exports.PARTY_TYPES = PARTY_TYPES;
