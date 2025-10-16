const mongoose = require('mongoose');

const softwareVendorSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: [true, 'Vendor name is required'],
    trim: true,
    maxlength: [100, 'Vendor name cannot exceed 100 characters']
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
    position: String
  },
  companyInfo: {
    website: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    },
    phone: String,
    email: String,
    taxId: String,
    registrationNumber: String
  },
  businessType: {
    type: String,
    enum: ['Software Publisher', 'Reseller', 'Distributor', 'Consultant', 'Support Provider', 'Other']
  },
  specialties: [String],
  paymentTerms: {
    type: String,
    enum: ['Net 30', 'Net 45', 'Net 60', 'Prepaid', 'COD', 'Custom']
  },
  currency: {
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
    }
  },
  notes: String,
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
softwareVendorSchema.index({ vendorName: 1 });
softwareVendorSchema.index({ businessType: 1 });
softwareVendorSchema.index({ isActive: 1 });

// Virtual for average rating
softwareVendorSchema.virtual('averageRating').get(function() {
  const ratings = [
    this.rating.quality,
    this.rating.support,
    this.rating.pricing,
    this.rating.delivery
  ].filter(rating => rating !== undefined && rating !== null);
  
  if (ratings.length === 0) return 0;
  
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return (sum / ratings.length).toFixed(1);
});

// Static methods
softwareVendorSchema.statics.findActiveVendors = function() {
  return this.find({ isActive: true }).sort({ vendorName: 1 });
};

softwareVendorSchema.statics.findBySpecialty = function(specialty) {
  return this.find({
    specialties: { $in: [specialty] },
    isActive: true
  });
};

softwareVendorSchema.statics.getVendorStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalVendors: { $sum: 1 },
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
        _id: '$businessType',
        count: { $sum: 1 },
        averageRating: { $avg: '$rating.overall' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalVendors: 0,
      averageRating: 0,
      highRatedVendors: 0
    },
    byType: typeStats
  };
};

module.exports = mongoose.model('SoftwareVendor', softwareVendorSchema);
