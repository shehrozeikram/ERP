const mongoose = require('mongoose');

const NODE_TYPES = ['patron', 'project', 'department', 'management', 'staff'];

const orgChartNodeSchema = new mongoose.Schema({
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrgChartNode',
    default: null,
    index: true
  },
  isRoot: {
    type: Boolean,
    default: false,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  name: {
    type: String,
    trim: true,
    default: '',
    maxlength: 200
  },
  type: {
    type: String,
    enum: NODE_TYPES,
    required: true,
    default: 'staff'
  },
  isVacant: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  legacyId: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

orgChartNodeSchema.index({ parent: 1, sortOrder: 1 });

module.exports = mongoose.model('OrgChartNode', orgChartNodeSchema);
module.exports.NODE_TYPES = NODE_TYPES;
