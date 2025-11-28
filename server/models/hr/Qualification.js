const mongoose = require('mongoose');

const qualificationSchema = new mongoose.Schema({
  qualificationId: {
    type: String,
    required: true,
    unique: true,
    default: () => `QUAL${Date.now().toString().slice(-6)}`
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
qualificationSchema.index({ qualificationId: 1 });
qualificationSchema.index({ name: 1 });
qualificationSchema.index({ status: 1 });

module.exports = mongoose.model('Qualification', qualificationSchema);

