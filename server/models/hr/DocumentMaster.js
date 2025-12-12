const mongoose = require('mongoose');

const documentMasterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Document name is required'],
    trim: true,
    maxlength: [200, 'Document name cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Document type is required'],
    trim: true,
    maxlength: [100, 'Document type cannot exceed 100 characters']
  },
  module: {
    type: String,
    trim: true,
    default: 'General'
  },
  moduleDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  moduleDocumentType: {
    type: String,
    trim: true
  },
  moduleMeta: mongoose.Schema.Types.Mixed,
  trackingId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: ['Registered', 'In Review', 'In Approval', 'Sent', 'Completed', 'Archived', 'Missing'],
    default: 'Registered'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Document owner is required']
  },
  physicalLocation: {
    building: {
      type: String,
      trim: true
    },
    floor: {
      type: String,
      trim: true
    },
    room: {
      type: String,
      trim: true
    },
    shelf: {
      type: String,
      trim: true
    },
    cabinet: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Location notes cannot exceed 500 characters']
    }
  },
  currentHolder: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    receivedAt: {
      type: Date
    }
  },
  qrCode: {
    type: String,
    unique: true,
    sparse: true
  },
  qrCodeImage: {
    type: String, // URL to stored QR code image
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  tags: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  dueDate: {
    type: Date
  },
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

// Indexes for better query performance
documentMasterSchema.index({ trackingId: 1 });
documentMasterSchema.index({ status: 1 });
documentMasterSchema.index({ category: 1 });
documentMasterSchema.index({ owner: 1 });
documentMasterSchema.index({ 'currentHolder.user': 1 });
documentMasterSchema.index({ 'currentHolder.department': 1 });
documentMasterSchema.index({ createdAt: -1 });
documentMasterSchema.index({ module: 1 });
documentMasterSchema.index({ moduleDocumentId: 1 });
documentMasterSchema.index({ name: 'text', description: 'text', category: 'text', type: 'text' });

// Pre-save middleware to auto-generate tracking ID
documentMasterSchema.pre('save', async function(next) {
  if (!this.trackingId) {
    const year = new Date().getFullYear();
    let attempts = 0;
    const maxAttempts = 10;
    let trackingId;
    let isUnique = false;

    // Try to generate a unique tracking ID
    while (!isUnique && attempts < maxAttempts) {
      // Use timestamp + random for better uniqueness
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // 3 digit random
      trackingId = `DOC-${year}-${timestamp}${random}`;
      
      // Check if this trackingId already exists
      const existing = await this.constructor.findOne({ trackingId });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      // Fallback: use full timestamp + counter if all attempts failed
      const fallbackId = `DOC-${year}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      trackingId = fallbackId;
    }

    this.trackingId = trackingId;
  }
  next();
});

// Virtual for full physical location string
documentMasterSchema.virtual('fullPhysicalLocation').get(function() {
  const parts = [];
  if (this.physicalLocation.building) parts.push(`Building: ${this.physicalLocation.building}`);
  if (this.physicalLocation.floor) parts.push(`Floor: ${this.physicalLocation.floor}`);
  if (this.physicalLocation.room) parts.push(`Room: ${this.physicalLocation.room}`);
  if (this.physicalLocation.shelf) parts.push(`Shelf: ${this.physicalLocation.shelf}`);
  if (this.physicalLocation.cabinet) parts.push(`Cabinet: ${this.physicalLocation.cabinet}`);
  if (this.physicalLocation.notes) parts.push(`Notes: ${this.physicalLocation.notes}`);
  return parts.length > 0 ? parts.join(', ') : 'Not specified';
});

// Method to check if document is overdue
documentMasterSchema.methods.isOverdue = function() {
  if (!this.dueDate) return false;
  return new Date() > this.dueDate && this.status !== 'Completed' && this.status !== 'Archived';
};

// Method to get days in current status
documentMasterSchema.methods.getDaysInCurrentStatus = function() {
  // This will be calculated based on movement history
  // For now, return days since last update
  const now = new Date();
  const updated = new Date(this.updatedAt);
  const diffTime = Math.abs(now - updated);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Static method to find documents by status
documentMasterSchema.statics.findByStatus = function(status) {
  return this.find({ status, isActive: true });
};

// Static method to find documents by current holder
documentMasterSchema.statics.findByCurrentHolder = function(userId) {
  return this.find({ 'currentHolder.user': userId, isActive: true });
};

// Static method to find overdue documents
documentMasterSchema.statics.findOverdue = function() {
  const today = new Date();
  return this.find({
    dueDate: { $lt: today },
    status: { $nin: ['Completed', 'Archived'] },
    isActive: true
  });
};

module.exports = mongoose.model('DocumentMaster', documentMasterSchema);


