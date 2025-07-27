const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required']
  },
  maritalStatus: {
    type: String,
    enum: ['Single', 'Married', 'Divorced', 'Widowed'],
    default: 'Single'
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'USA'
    }
  },
  emergencyContact: {
    name: {
      type: String,
      required: [true, 'Emergency contact name is required']
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required']
    },
    phone: {
      type: String,
      required: [true, 'Emergency contact phone is required']
    },
    email: String
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  position: {
    type: String,
    required: [true, 'Position is required']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  hireDate: {
    type: Date,
    required: [true, 'Hire date is required'],
    default: Date.now
  },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Intern', 'Temporary'],
    default: 'Full-time'
  },
  employmentStatus: {
    type: String,
    enum: ['Active', 'Inactive', 'Terminated', 'Resigned', 'Retired'],
    default: 'Active'
  },
  salary: {
    type: Number,
    required: [true, 'Base salary is required'],
    min: [0, 'Salary cannot be negative']
  },
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR']
  },
  benefits: {
    healthInsurance: {
      type: Boolean,
      default: false
    },
    dentalInsurance: {
      type: Boolean,
      default: false
    },
    visionInsurance: {
      type: Boolean,
      default: false
    },
    lifeInsurance: {
      type: Boolean,
      default: false
    },
    retirementPlan: {
      type: Boolean,
      default: false
    }
  },
  documents: [{
    type: {
      type: String,
      enum: ['ID', 'Passport', 'Visa', 'WorkPermit', 'Contract', 'Resume', 'Other'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: Date
  }],
  skills: [{
    name: String,
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert']
    },
    certified: {
      type: Boolean,
      default: false
    }
  }],
  education: [{
    degree: String,
    institution: String,
    field: String,
    graduationYear: Number,
    gpa: Number,
    certificate: String
  }],
  workExperience: [{
    company: String,
    position: String,
    startDate: Date,
    endDate: Date,
    description: String,
    achievements: [String]
  }],
  performance: {
    lastReviewDate: Date,
    nextReviewDate: Date,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String
  },
  attendance: {
    totalDays: {
      type: Number,
      default: 0
    },
    presentDays: {
      type: Number,
      default: 0
    },
    absentDays: {
      type: Number,
      default: 0
    },
    leaveDays: {
      type: Number,
      default: 0
    }
  },
  leaveBalance: {
    annual: {
      type: Number,
      default: 20
    },
    sick: {
      type: Number,
      default: 10
    },
    personal: {
      type: Number,
      default: 5
    },
    maternity: {
      type: Number,
      default: 0
    },
    paternity: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  terminationDate: Date,
  terminationReason: String,
  notes: String
}, {
  timestamps: true
});

// Indexes for better query performance
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ email: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ position: 1 });
employeeSchema.index({ employmentStatus: 1 });
employeeSchema.index({ hireDate: 1 });

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
employeeSchema.virtual('age').get(function() {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for years of service
employeeSchema.virtual('yearsOfService').get(function() {
  const today = new Date();
  const hireDate = new Date(this.hireDate);
  let years = today.getFullYear() - hireDate.getFullYear();
  const monthDiff = today.getMonth() - hireDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < hireDate.getDate())) {
    years--;
  }
  
  return years;
});

// Virtual for attendance percentage
employeeSchema.virtual('attendancePercentage').get(function() {
  if (this.attendance.totalDays === 0) return 0;
  return ((this.attendance.presentDays / this.attendance.totalDays) * 100).toFixed(2);
});

// Pre-save middleware to update user reference
employeeSchema.pre('save', function(next) {
  if (this.isModified('firstName') || this.isModified('lastName') || this.isModified('email')) {
    // Update corresponding user document
    this.constructor.model('User').findByIdAndUpdate(
      this.user,
      {
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email
      },
      { new: true }
    ).catch(err => console.error('Error updating user:', err));
  }
  next();
});

// Static method to find active employees
employeeSchema.statics.findActive = function() {
  return this.find({ isActive: true, employmentStatus: 'Active' });
};

// Static method to find employees by department
employeeSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId, isActive: true });
};

// Static method to find employees by position
employeeSchema.statics.findByPosition = function(positionId) {
  return this.find({ position: positionId, isActive: true });
};

// Static method to get employee statistics
employeeSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        activeEmployees: {
          $sum: {
            $cond: [{ $and: [{ $eq: ['$isActive', true] }, { $eq: ['$employmentStatus', 'Active'] }] }, 1, 0]
          }
        },
        averageSalary: { $avg: '$salary' },
        totalSalary: { $sum: '$salary' }
      }
    }
  ]);
  
  return stats[0] || {
    totalEmployees: 0,
    activeEmployees: 0,
    averageSalary: 0,
    totalSalary: 0
  };
};

module.exports = mongoose.model('Employee', employeeSchema); 