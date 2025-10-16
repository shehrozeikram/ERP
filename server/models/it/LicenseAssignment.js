const mongoose = require('mongoose');

const licenseAssignmentSchema = new mongoose.Schema({
  software: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SoftwareInventory',
    required: [true, 'Software is required']
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  assignedDate: {
    type: Date,
    required: [true, 'Assigned date is required'],
    default: Date.now
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned by is required']
  },
  status: {
    type: String,
    enum: ['Active', 'Revoked', 'Expired', 'Transferred'],
    default: 'Active'
  },
  installationDate: Date,
  installedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deviceInfo: {
    deviceName: String,
    deviceType: String,
    operatingSystem: String,
    macAddress: String,
    serialNumber: String
  },
  licenseKey: String,
  notes: String,
  revokedDate: Date,
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revocationReason: String,
  transferredTo: {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    transferDate: Date,
    transferNotes: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
licenseAssignmentSchema.index({ software: 1 });
licenseAssignmentSchema.index({ employee: 1 });
licenseAssignmentSchema.index({ status: 1 });
licenseAssignmentSchema.index({ assignedDate: 1 });
licenseAssignmentSchema.index({ isActive: 1 });

// Virtual for assignment duration
licenseAssignmentSchema.virtual('duration').get(function() {
  const endDate = this.revokedDate || new Date();
  const startDate = this.assignedDate;
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save middleware
licenseAssignmentSchema.pre('save', async function(next) {
  // Update software license count when assignment status changes
  if (this.isModified('status')) {
    const SoftwareInventory = mongoose.model('SoftwareInventory');
    const software = await SoftwareInventory.findById(this.software);
    
    if (software) {
      if (this.status === 'Active' && this.isNew) {
        // New active assignment - increment used count
        software.licenseCount.used += 1;
      } else if (this.status === 'Revoked' && this.status !== this.originalStatus) {
        // License revoked - decrement used count
        software.licenseCount.used = Math.max(0, software.licenseCount.used - 1);
      } else if (this.status === 'Transferred' && this.status !== this.originalStatus) {
        // License transferred - no change in count
      }
      
      await software.save();
    }
  }
  
  next();
});

// Static methods
licenseAssignmentSchema.statics.findActiveAssignments = function() {
  return this.find({ 
    status: 'Active',
    isActive: true 
  }).populate('software employee assignedBy');
};

licenseAssignmentSchema.statics.findByEmployee = function(employeeId) {
  return this.find({ 
    employee: employeeId,
    isActive: true 
  }).populate('software').sort({ assignedDate: -1 });
};

licenseAssignmentSchema.statics.findBySoftware = function(softwareId) {
  return this.find({ 
    software: softwareId,
    isActive: true 
  }).populate('employee assignedBy');
};

licenseAssignmentSchema.statics.getAssignmentStatistics = async function() {
  const stats = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalAssignments: { $sum: 1 },
        activeAssignments: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Active'] }, 1, 0]
          }
        },
        revokedAssignments: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Revoked'] }, 1, 0]
          }
        },
        transferredAssignments: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Transferred'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  const softwareStats = await this.aggregate([
    { $match: { isActive: true, status: 'Active' } },
    {
      $group: {
        _id: '$software',
        assignmentCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'softwareinventories',
        localField: '_id',
        foreignField: '_id',
        as: 'software'
      }
    },
    {
      $unwind: '$software'
    },
    {
      $group: {
        _id: '$software.category',
        totalAssignments: { $sum: '$assignmentCount' },
        uniqueSoftware: { $sum: 1 }
      }
    },
    { $sort: { totalAssignments: -1 } }
  ]);
  
  return {
    overview: stats[0] || {
      totalAssignments: 0,
      activeAssignments: 0,
      revokedAssignments: 0,
      transferredAssignments: 0
    },
    bySoftwareCategory: softwareStats
  };
};

module.exports = mongoose.model('LicenseAssignment', licenseAssignmentSchema);
