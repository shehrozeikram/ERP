const mongoose = require('mongoose');

const itVendorSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: [true, 'Vendor name is required'],
    trim: true,
    maxlength: [100, 'Vendor name cannot exceed 100 characters']
  },
  vendorType: {
    type: String,
    enum: [
      'Hardware Supplier', 'Software Vendor', 'Service Provider', 'Consultant',
      'Maintenance Provider', 'Cloud Provider', 'Security Provider', 'Network Provider',
      'Training Provider', 'Other'
    ],
    required: [true, 'Vendor type is required']
  },
  contactInfo: {
    primaryContact: {
      name: String,
      title: String,
      email: String,
      phone: String,
      mobile: String
    },
    secondaryContact: {
      name: String,
      title: String,
      email: String,
      phone: String
    },
    companyEmail: String,
    companyPhone: String,
    website: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  businessInfo: {
    taxId: String,
    registrationNumber: String,
    businessLicense: String,
    establishedYear: Number,
    employeeCount: String,
    annualRevenue: Number,
    currency: {
      type: String,
      default: 'PKR',
      enum: ['PKR', 'USD', 'EUR']
    }
  },
  services: [String],
  specialties: [String],
  certifications: [String],
  paymentTerms: {
    type: String,
    enum: ['Net 30', 'Net 45', 'Net 60', 'Prepaid', 'COD', 'Custom']
  },
  preferredCurrency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR']
  },
  rating: {
    overall: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    quality: {
      type: Number,
      min: 1,
      max: 5
    },
    support: {
      type: Number,
      min: 1,
      max: 5
    },
    pricing: {
      type: Number,
      min: 1,
      max: 5
    },
    delivery: {
      type: Number,
      min: 1,
      max: 5
    },
    reliability: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  financialInfo: {
    creditLimit: Number,
    currentBalance: {
      type: Number,
      default: 0
    },
    paymentHistory: [{
      invoiceNumber: String,
      amount: Number,
      dueDate: Date,
      paidDate: Date,
      status: {
        type: String,
        enum: ['Paid', 'Overdue', 'Pending']
      }
    }]
  },
  relationship: {
    startDate: Date,
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended', 'Terminated'],
      default: 'Active'
    },
    preferredVendor: {
      type: Boolean,
      default: false
    },
    blacklisted: {
      type: Boolean,
      default: false
    },
    blacklistReason: String,
    notes: String
  },
  documents: [{
    type: {
      type: String,
      enum: ['Contract', 'Certificate', 'License', 'Insurance', 'Other']
    },
    name: String,
    fileUrl: String,
    expiryDate: Date,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
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

// Indexes
itVendorSchema.index({ vendorName: 1 });
itVendorSchema.index({ vendorType: 1 });
itVendorSchema.index({ 'relationship.status': 1 });
itVendorSchema.index({ 'rating.overall': -1 });
itVendorSchema.index({ isActive: 1 });

// Virtual for average rating
itVendorSchema.virtual('averageRating').get(function() {
  const ratings = [
    this.rating.quality,
    this.rating.support,
    this.rating.pricing,
    this.rating.delivery,
    this.rating.reliability
  ].filter(rating => rating !== undefined && rating !== null);
  
  if (ratings.length === 0) return 0;
  
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return (sum / ratings.length).toFixed(1);
});

// Virtual for relationship duration
itVendorSchema.virtual('relationshipDuration').get(function() {
  if (!this.relationship?.startDate) return null;
  
  const today = new Date();
  const startDate = new Date(this.relationship.startDate);
  let years = today.getFullYear() - startDate.getFullYear();
  const monthDiff = today.getMonth() - startDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < startDate.getDate())) {
    years--;
  }
  
  return years;
});

// Virtual for overdue payments
itVendorSchema.virtual('overduePayments').get(function() {
  if (!this.financialInfo?.paymentHistory) return 0;
  
  const today = new Date();
  return this.financialInfo.paymentHistory.filter(payment => 
    payment.status === 'Overdue' || 
    (payment.status === 'Pending' && payment.dueDate < today)
  ).length;
});

// Static methods
itVendorSchema.statics.findActiveVendors = function() {
  return this.find({ 
    isActive: true,
    'relationship.status': 'Active'
  }).sort({ vendorName: 1 });
};

itVendorSchema.statics.findPreferredVendors = function() {
  return this.find({
    isActive: true,
    'relationship.preferredVendor': true,
    'relationship.status': 'Active'
  }).sort({ 'rating.overall': -1 });
};

itVendorSchema.statics.findByType = function(vendorType) {
  return this.find({
    vendorType: vendorType,
    isActive: true,
    'relationship.status': 'Active'
  }).sort({ 'rating.overall': -1 });
};

itVendorSchema.statics.findHighRatedVendors = function(minRating = 4) {
  return this.find({
    'rating.overall': { $gte: minRating },
    isActive: true,
    'relationship.status': 'Active'
  }).sort({ 'rating.overall': -1 });
};

itVendorSchema.statics.getVendorStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalVendors: { $sum: 1 },
        activeVendors: {
          $sum: {
            $cond: [{ $eq: ['$relationship.status', 'Active'] }, 1, 0]
          }
        },
        preferredVendors: {
          $sum: {
            $cond: [{ $eq: ['$relationship.preferredVendor', true] }, 1, 0]
          }
        },
        blacklistedVendors: {
          $sum: {
            $cond: [{ $eq: ['$relationship.blacklisted', true] }, 1, 0]
          }
        },
        averageRating: { $avg: '$rating.overall' },
        highRatedVendors: {
          $sum: {
            $cond: [{ $gte: ['$rating.overall', 4] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  const typeStats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$vendorType',
        count: { $sum: 1 },
        averageRating: { $avg: '$rating.overall' },
        preferredCount: {
          $sum: {
            $cond: [{ $eq: ['$relationship.preferredVendor', true] }, 1, 0]
          }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalVendors: 0,
      activeVendors: 0,
      preferredVendors: 0,
      blacklistedVendors: 0,
      averageRating: 0,
      highRatedVendors: 0
    },
    byType: typeStats
  };
};

module.exports = mongoose.model('ITVendor', itVendorSchema);
