const mongoose = require('mongoose');

const tajPropertySchema = new mongoose.Schema(
  {
    srNo: {
      type: Number,
      unique: true
    },
    propertyType: {
      type: String,
      trim: true,
      default: 'House'
    },
    propertyName: {
      type: String,
      trim: true
    },
    zoneType: {
      type: String,
      enum: ['Residential', 'Commercial', 'Agricultural'],
      default: 'Residential'
    },
    plotNumber: {
      type: String,
      trim: true
    },
    rdaNumber: {
      type: String,
      trim: true
    },
    street: {
      type: String,
      trim: true
    },
    sector: {
      type: String,
      trim: true
    },
    categoryType: {
      type: String,
      enum: ['Personal', 'Private', 'Personal Rent'],
      default: 'Personal'
    },
    block: {
      type: String,
      trim: true
    },
    floor: {
      type: String,
      trim: true
    },
    unit: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true,
      default: 'Islamabad'
    },
    address: {
      type: String,
      trim: true
    },
    fullAddress: {
      type: String,
      trim: true
    },
    project: {
      type: String,
      trim: true
    },
    ownerName: {
      type: String,
      trim: true
    },
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TajResident',
      default: null
    },
    contactNumber: {
      type: String,
      trim: true
    },
    tenantName: {
      type: String,
      trim: true
    },
    rentalAgreement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TajRentalAgreement'
    },
    tenantPhone: {
      type: String,
      trim: true
    },
    tenantEmail: {
      type: String,
      trim: true
    },
    tenantCNIC: {
      type: String,
      trim: true
    },
rentalAgreement: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'TajRentalAgreement'
},
  rentalPayments: [{
    amount: {
      type: Number,
      required: true
    },
    arrears: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: function() {
        return (this.amount || 0) + (this.arrears || 0);
      }
    },
    paymentDate: {
      type: Date,
      required: true
    },
    periodFrom: Date,
    periodTo: Date,
    invoiceNumber: {
      type: String,
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
      default: 'Bank Transfer'
    },
    bankName: {
      type: String,
      trim: true
    },
    attachmentUrl: {
      type: String,
      trim: true
    },
    reference: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['Draft', 'Unpaid', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Draft'
    },
    statusUpdatedAt: {
      type: Date,
      default: Date.now
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],
    status: {
      type: String,
      trim: true,
      default: 'Pending'
    },
    fileSubmissionDate: {
      type: Date
    },
    demarcationDate: {
      type: Date
    },
    constructionDate: {
      type: Date
    },
    familyStatus: {
      type: String,
      trim: true
    },
    areaValue: {
      type: Number,
      default: 0
    },
    areaUnit: {
      type: String,
      default: 'Sq Ft'
    },
    bedrooms: {
      type: Number,
      default: 0
    },
    bathrooms: {
      type: Number,
      default: 0
    },
    parking: {
      type: Number,
      default: 0
    },
    expectedRent: {
      type: Number,
      default: 0
    },
    securityDeposit: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    amenities: {
      type: [String],
      default: []
    },
    // Electricity & Water fields
    hasElectricityWater: {
      type: Boolean,
      default: false
    },
    // Legacy single meter fields (kept for backward compatibility)
    electricityWaterConsumer: {
      type: String,
      trim: true
    },
    electricityWaterMeterNo: {
      type: String,
      trim: true
    },
    connectionType: {
      type: String,
      enum: ['Single Phase', 'Two Phase', 'Three Phase'],
      trim: true
    },
    occupiedUnderConstruction: {
      type: String,
      enum: ['Office', 'Occupied', 'Under-Construction', 'Un-occupied'],
      trim: true
    },
    dateOfOccupation: {
      type: Date
    },
    meterType: {
      type: String,
      trim: true
    },
    // New dynamic meters array
    meters: [{
      floor: {
        type: String,
        trim: true,
        required: true
      },
      consumer: {
        type: String,
        trim: true
      },
      meterNo: {
        type: String,
        trim: true
      },
      connectionType: {
        type: String,
        enum: ['Single Phase', 'Two Phase', 'Three Phase'],
        trim: true
      },
      meterType: {
        type: String,
        trim: true
      },
      dateOfOccupation: {
        type: Date
      },
      occupiedUnderConstruction: {
        type: String,
        enum: ['Office', 'Occupied', 'Under-Construction'],
        trim: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

tajPropertySchema.index({ srNo: 1 }, { unique: true });
tajPropertySchema.index({ ownerName: 1 });
tajPropertySchema.index({ resident: 1 });

// Auto-increment srNo starting from 1001
tajPropertySchema.pre('save', async function(next) {
  if (!this.isNew || (this.srNo !== undefined && this.srNo !== null)) {
    return next();
  }

  try {
    const lastRecord = await this.constructor.findOne({}, {}, { sort: { srNo: -1 } });
    this.srNo = lastRecord && lastRecord.srNo >= 1000 ? lastRecord.srNo + 1 : 1001;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('TajProperty', tajPropertySchema);

