const mongoose = require('mongoose');

const tajResidentSchema = new mongoose.Schema(
  {
    // Resident ID
    residentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    // Basic Information
    name: {
      type: String,
      required: false, // Allow empty for suspense account
      trim: true,
      default: ''
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
// residentId index is created by the field definition (unique + sparse)

// Pre-save middleware to auto-generate Resident ID
// Skip auto-generation for suspense account residents (no name and no residentId)
tajResidentSchema.pre('save', async function(next) {
  // Don't auto-generate residentId for suspense account residents (unknown residents)
  // These are residents with empty/null/undefined name and no residentId
  const hasName = this.name !== null && this.name !== undefined && String(this.name).trim() !== '';
  if (!this.residentId && !hasName) {
    // This is a suspense account resident, skip residentId generation
    // Explicitly set residentId to null/empty to prevent any generation
    this.residentId = undefined;
    return next();
  }
  
  if (!this.residentId) {
    try {
      const allResidents = await this.constructor.find({}, { residentId: 1 }).lean();
      
      let highestId = 0;
      
      allResidents.forEach(res => {
        if (res.residentId) {
          const numericId = parseInt(res.residentId.replace(/^0+/, ''));
          if (!isNaN(numericId) && numericId > highestId) {
            highestId = numericId;
          }
        }
      });
      
      const nextId = highestId + 1;
      this.residentId = nextId.toString().padStart(5, '0');
    } catch (error) {
      console.error('Error generating Resident ID:', error);
      this.residentId = Date.now().toString().slice(-6);
    }
  }
  next();
});

module.exports = mongoose.model('TajResident', tajResidentSchema);

