const mongoose = require('mongoose');

const tajResidentSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true
    },
    accountType: {
      type: String,
      enum: ['Resident', 'Property Dealer', 'Other'],
      default: 'Resident'
    },
    cnic: {
      type: String,
      trim: true
    },
    contactNumber: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true
    },
    
    // Account Balance
    balance: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Properties owned by this resident
    properties: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TajProperty'
    }],
    
    // Additional Info
    notes: {
      type: String,
      trim: true
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true
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
  },
  { timestamps: true }
);

// Indexes
tajResidentSchema.index({ name: 1 });
tajResidentSchema.index({ cnic: 1 });
tajResidentSchema.index({ isActive: 1 });

module.exports = mongoose.model('TajResident', tajResidentSchema);

