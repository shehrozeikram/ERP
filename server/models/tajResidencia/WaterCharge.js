const mongoose = require('mongoose');

const waterChargeSchema = new mongoose.Schema({
  serialNumber: {
    type: Number,
    unique: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  plotNo: {
    type: String,
    trim: true
  },
  rdaNo: {
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
  category: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  project: {
    type: String,
    trim: true
  },
  owner: {
    type: String,
    required: true,
    trim: true
  },
  contactNo: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Pending', 'Completed', 'Cancelled'],
    default: 'Active'
  },
  fileSubmission: {
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
  arrears: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  amountInWords: {
    type: String,
    trim: true
  },
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
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial_paid', 'paid'],
    default: 'unpaid'
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
}, {
  timestamps: true
});

waterChargeSchema.index({ invoiceNumber: 1 });
waterChargeSchema.index({ plotNo: 1 });
waterChargeSchema.index({ address: 1 });
waterChargeSchema.index({ sector: 1 });
waterChargeSchema.index({ status: 1 });
waterChargeSchema.index({ owner: 1 });

waterChargeSchema.pre('save', async function(next) {
  if (this.isNew && !this.serialNumber) {
    const lastRecord = await this.constructor.findOne({}, {}, { sort: { serialNumber: -1 } });
    this.serialNumber = lastRecord ? lastRecord.serialNumber + 1 : 1;
  }
  next();
});

waterChargeSchema.pre('save', function(next) {
  const totalAmount = this.amount + (this.arrears || 0);
  const totalPaid = (this.payments || []).reduce((sum, payment) => sum + (payment.totalAmount || payment.amount || 0), 0);

  if (totalPaid >= totalAmount && totalAmount > 0) {
    this.paymentStatus = 'paid';
  } else if (totalPaid > 0) {
    this.paymentStatus = 'partial_paid';
  } else {
    this.paymentStatus = 'unpaid';
  }

  next();
});

module.exports = mongoose.model('WaterCharge', waterChargeSchema);
