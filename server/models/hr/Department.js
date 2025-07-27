const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Department code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  location: {
    building: String,
    floor: String,
    room: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  budget: {
    annual: {
      type: Number,
      min: [0, 'Budget cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD'
    },
    fiscalYear: {
      type: Number,
      default: new Date().getFullYear()
    }
  },
  contactInfo: {
    phone: String,
    email: String,
    extension: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedDate: {
    type: Date,
    default: Date.now
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
departmentSchema.index({ name: 1 });
departmentSchema.index({ code: 1 });
departmentSchema.index({ isActive: 1 });

// Virtual for employee count
departmentSchema.virtual('employeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'department',
  count: true
});

// Static method to find active departments
departmentSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to get department hierarchy
departmentSchema.statics.getHierarchy = async function() {
  const departments = await this.find({ isActive: true })
    .populate('manager', 'firstName lastName employeeId')
    .populate('parentDepartment', 'name code')
    .lean();

  const buildHierarchy = (parentId = null) => {
    return departments
      .filter(dept => 
        parentId === null 
          ? !dept.parentDepartment 
          : dept.parentDepartment && dept.parentDepartment._id.toString() === parentId.toString()
      )
      .map(dept => ({
        ...dept,
        children: buildHierarchy(dept._id)
      }));
  };

  return buildHierarchy();
};

module.exports = mongoose.model('Department', departmentSchema); 