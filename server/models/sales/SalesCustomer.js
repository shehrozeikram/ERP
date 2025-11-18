const mongoose = require('mongoose');

const salesCustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['corporate', 'individual'],
    default: 'corporate'
  },
  status: {
    type: String,
    enum: ['prospect', 'active', 'inactive'],
    default: 'active',
    index: true
  },
  industry: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: {
      type: String,
      default: 'Pakistan'
    }
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lifetimeValue: {
    type: Number,
    default: 0
  },
  lastContactedAt: Date,
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

salesCustomerSchema.index({ name: 1, company: 1 });
salesCustomerSchema.index({ email: 1 });

module.exports = mongoose.model('SalesCustomer', salesCustomerSchema);

