const mongoose = require('mongoose');

const assetAssignmentSchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ITAsset',
    required: [true, 'Asset is required']
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
  expectedReturnDate: Date,
  actualReturnDate: Date,
  status: {
    type: String,
    enum: ['Active', 'Returned', 'Lost', 'Damaged', 'Cancelled'],
    default: 'Active'
  },
  assignmentReason: {
    type: String,
    enum: ['New Employee', 'Replacement', 'Upgrade', 'Temporary', 'Project', 'Other'],
    required: [true, 'Assignment reason is required']
  },
  conditionAtAssignment: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor'],
    required: [true, 'Condition at assignment is required']
  },
  conditionAtReturn: {
    type: String,
    enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']
  },
  notes: String,
  returnNotes: String,
  accessories: [{
    name: String,
    condition: String,
    returned: {
      type: Boolean,
      default: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
assetAssignmentSchema.index({ asset: 1 });
assetAssignmentSchema.index({ employee: 1 });
assetAssignmentSchema.index({ status: 1 });
assetAssignmentSchema.index({ assignedDate: 1 });
assetAssignmentSchema.index({ isActive: 1 });

// Virtual for assignment duration
assetAssignmentSchema.virtual('duration').get(function() {
  const endDate = this.actualReturnDate || new Date();
  const startDate = this.assignedDate;
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for overdue status
assetAssignmentSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'Active' || !this.expectedReturnDate) return false;
  return new Date() > new Date(this.expectedReturnDate);
});

// Pre-save middleware
assetAssignmentSchema.pre('save', async function(next) {
  // Update asset assignment status
  if (this.isModified('status') && this.status === 'Returned') {
    this.actualReturnDate = new Date();
    
    // Update the asset's assigned status
    const ITAsset = mongoose.model('ITAsset');
    await ITAsset.findByIdAndUpdate(this.asset, {
      'assignedTo.employee': null,
      'assignedTo.assignedDate': null,
      'assignedTo.assignedBy': null,
      'assignedTo.returnDate': this.actualReturnDate,
      'assignedTo.notes': this.returnNotes,
      condition: this.conditionAtReturn || 'Good'
    });
  }
  
  next();
});

// Static methods
assetAssignmentSchema.statics.findActiveAssignments = function() {
  return this.find({ 
    status: 'Active',
    isActive: true 
  }).populate('asset employee assignedBy');
};

assetAssignmentSchema.statics.findByEmployee = function(employeeId) {
  return this.find({ 
    employee: employeeId,
    isActive: true 
  }).populate('asset').sort({ assignedDate: -1 });
};

assetAssignmentSchema.statics.findOverdueAssignments = function() {
  return this.find({
    status: 'Active',
    expectedReturnDate: { $lt: new Date() },
    isActive: true
  }).populate('asset employee');
};

assetAssignmentSchema.statics.getAssignmentStatistics = async function() {
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
        returnedAssignments: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Returned'] }, 1, 0]
          }
        },
        overdueAssignments: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Active'] },
                  { $lt: ['$expectedReturnDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalAssignments: 0,
    activeAssignments: 0,
    returnedAssignments: 0,
    overdueAssignments: 0
  };
};

module.exports = mongoose.model('AssetAssignment', assetAssignmentSchema);
