const mongoose = require('mongoose');

const userSubRoleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subRole: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubRole',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
  }
}, {
  timestamps: true
});

// Index for better query performance
userSubRoleSchema.index({ user: 1, isActive: 1 });
userSubRoleSchema.index({ subRole: 1, isActive: 1 });
userSubRoleSchema.index({ user: 1, subRole: 1 }, { unique: true });

// Virtual to check if assignment is expired
userSubRoleSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Static method to find active sub-roles for a user
userSubRoleSchema.statics.findActiveByUser = function(userId) {
  return this.find({ 
    user: userId, 
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).populate('subRole');
};

// Static method to find users with a specific sub-role
userSubRoleSchema.statics.findUsersBySubRole = function(subRoleId) {
  return this.find({ 
    subRole: subRoleId, 
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).populate('user');
};

module.exports = mongoose.model('UserSubRole', userSubRoleSchema);
