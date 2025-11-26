const mongoose = require('mongoose');

const documentMovementSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentMaster',
    required: [true, 'Document reference is required']
  },
  fromDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  toDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'To department is required']
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'To user is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  comments: {
    type: String,
    trim: true,
    maxlength: [1000, 'Comments cannot exceed 1000 characters']
  },
  statusBefore: {
    type: String,
    enum: ['Registered', 'In Review', 'In Approval', 'Sent', 'Completed', 'Archived', 'Missing'],
    required: true
  },
  statusAfter: {
    type: String,
    enum: ['Registered', 'In Review', 'In Approval', 'Sent', 'Completed', 'Archived', 'Missing'],
    required: true
  },
  movementType: {
    type: String,
    enum: ['Send', 'Receive', 'Return', 'Transfer', 'Archive', 'Status Change'],
    default: 'Transfer'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  receivedAt: {
    type: Date
  },
  acknowledgedAt: {
    type: Date
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
documentMovementSchema.index({ document: 1, timestamp: -1 });
documentMovementSchema.index({ fromUser: 1 });
documentMovementSchema.index({ toUser: 1 });
documentMovementSchema.index({ fromDepartment: 1 });
documentMovementSchema.index({ toDepartment: 1 });
documentMovementSchema.index({ timestamp: -1 });
documentMovementSchema.index({ statusAfter: 1 });

// Pre-save middleware to set receivedAt if movement type is Receive
documentMovementSchema.pre('save', function(next) {
  if (this.movementType === 'Receive' && !this.receivedAt) {
    this.receivedAt = new Date();
  }
  next();
});

// Static method to get movement history for a document
documentMovementSchema.statics.getDocumentHistory = function(documentId) {
  return this.find({ document: documentId, isActive: true })
    .sort({ timestamp: -1 })
    .populate('fromUser', 'firstName lastName email')
    .populate('toUser', 'firstName lastName email')
    .populate('fromDepartment', 'name code')
    .populate('toDepartment', 'name code')
    .populate('createdBy', 'firstName lastName email');
};

// Static method to get movements by user
documentMovementSchema.statics.getMovementsByUser = function(userId, limit = 50) {
  return this.find({
    $or: [
      { fromUser: userId },
      { toUser: userId }
    ],
    isActive: true
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('document', 'name trackingId status')
    .populate('fromUser', 'firstName lastName email')
    .populate('toUser', 'firstName lastName email')
    .populate('fromDepartment', 'name code')
    .populate('toDepartment', 'name code');
};

// Static method to get pending movements (not acknowledged)
documentMovementSchema.statics.getPendingMovements = function(userId) {
  return this.find({
    toUser: userId,
    acknowledgedAt: { $exists: false },
    isActive: true
  })
    .sort({ timestamp: -1 })
    .populate('document', 'name trackingId status priority')
    .populate('fromUser', 'firstName lastName email')
    .populate('fromDepartment', 'name code');
};

module.exports = mongoose.model('DocumentMovement', documentMovementSchema);


