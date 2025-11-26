const mongoose = require('mongoose');

const tajRentalPropertySchema = new mongoose.Schema({
  propertyCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  propertyType: {
    type: String,
    required: true,
    enum: ['Villa', 'House', 'Building', 'Apartment', 'Shop', 'Office', 'Warehouse', 'Plot', 'Other'],
    trim: true
  },
  propertyName: {
    type: String,
    required: true,
    trim: true
  },
  // Address Details
  street: {
    type: String,
    trim: true
  },
  sector: {
    type: String,
    trim: true
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
    default: 'Islamabad',
    trim: true
  },
  fullAddress: {
    type: String,
    required: true,
    trim: true
  },
  // Property Details
  area: {
    value: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      enum: ['Sq Ft', 'Sq Yards', 'Marla', 'Kanal', 'Acres'],
      default: 'Sq Ft'
    }
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
  // Financial Details
  expectedRent: {
    type: Number,
    default: 0
  },
  securityDeposit: {
    type: Number,
    default: 0
  },
  // Agreement Reference
  rentalAgreement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TajRentalAgreement'
  },
  // Tenant Details (from agreement or override)
  tenantName: {
    type: String,
    trim: true
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
  // Payment Tracking
  payments: [{
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
    periodFrom: {
      type: Date
    },
    periodTo: {
      type: Date
    },
    invoiceNumber: {
      type: String,
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
      default: 'Bank Transfer'
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
  // Status
  status: {
    type: String,
    enum: ['Available', 'Rented', 'Under Maintenance', 'Reserved'],
    default: 'Available'
  },
  // Additional Info
  description: {
    type: String,
    trim: true
  },
  amenities: [{
    type: String,
    trim: true
  }],
  images: [{
    fileName: String,
    filePath: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
}, {
  timestamps: true
});

// Indexes
tajRentalPropertySchema.index({ propertyCode: 1 });
tajRentalPropertySchema.index({ propertyType: 1 });
tajRentalPropertySchema.index({ status: 1 });
tajRentalPropertySchema.index({ city: 1, sector: 1 });

module.exports = mongoose.model('TajRentalProperty', tajRentalPropertySchema);

