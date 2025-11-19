const mongoose = require('mongoose');

const STATUS_OPTIONS = [
  'New',
  'Contacted',
  'Completed',
  'Hold',
  'Approval Required',
  'Others',
  'Not Applicable'
];

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

const complaintSchema = new mongoose.Schema({
  trackingCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  priority: {
    type: String,
    enum: PRIORITY_OPTIONS,
    default: 'Medium'
  },
  status: {
    type: String,
    enum: STATUS_OPTIONS,
    default: 'New',
    index: true
  },
  location: {
    type: String,
    trim: true
  },
  reporter: {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  meta: {
    source: { type: String, default: 'Public Portal' },
    assignedTo: { type: String, trim: true }
  },
  lastUpdatedBy: {
    type: String,
    trim: true
  },
  lastUpdatedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  history: [
    {
      status: { type: String, enum: STATUS_OPTIONS },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedByName: { type: String, trim: true },
      notes: String
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('TajComplaint', complaintSchema);

