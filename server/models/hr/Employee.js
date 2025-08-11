const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  employeeId: {
    type: String,
    unique: true,
    trim: true,
    auto: true
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
  idCard: {
    type: String,
    required: [true, 'ID Card number is required'],
    trim: true,
    unique: true
  },
  nationality: {
    type: String,
    required: [true, 'Nationality is required'],
    trim: true
  },
  profileImage: {
    type: String,
    trim: true
  },
  religion: {
    type: String,
    enum: ['Islam', 'Christianity', 'Hinduism', 'Sikhism', 'Buddhism', 'Judaism', 'Other', 'None'],
    default: 'Islam'
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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'City',
      required: [true, 'City is required']
    },
    state: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Province',
      required: [true, 'State/Province is required']
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Country',
      required: [true, 'Country is required']
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

  qualification: {
    type: String,
    required: [true, 'Qualification is required'],
    trim: true
  },
  bankName: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: [true, 'Bank is required']
  },
  foreignBankAccount: {
    type: String,
    required: false,
    trim: true
  },
  spouseName: {
    type: String,
    required: function() {
      return this.maritalStatus === 'Married';
    },
    trim: true
  },
  appointmentDate: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  probationPeriodMonths: {
    type: Number,
    required: [true, 'Probation period is required'],
    min: [0, 'Probation period cannot be negative'],
    max: [24, 'Probation period cannot exceed 24 months']
  },
  endOfProbationDate: {
    type: Date,
    required: false
  },
  confirmationDate: {
    type: Date,
    required: false
  },
  // Placement fields
  placementCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlacementCompany',
    required: false
  },
  placementSector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sector',
    required: false
  },
  placementProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  placementDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false
  },
  placementSection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: false
  },
  placementDesignation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation',
    required: false
  },
  oldDesignation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation',
    required: false,
    default: undefined
  },
  placementLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: false
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false
  },
  position: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position',
    required: false
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
  // Flexible Allowance Structure (House Rent removed as it's part of distributed salary)
  allowances: {
    conveyance: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Conveyance allowance cannot be negative']
      }
    },
    food: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Food allowance cannot be negative']
      }
    },
    vehicleFuel: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Vehicle & fuel allowance cannot be negative']
      }
    },
    medical: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Medical allowance cannot be negative']
      }
    },
    special: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Special allowance cannot be negative']
      }
    },
    other: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Other allowance cannot be negative']
      }
    }
  },
  // Basic Salary Structure (for backward compatibility)
  salary: {
    gross: {
      type: Number,
      required: false, // Made optional for updates
      min: [0, 'Gross salary cannot be negative']
    },
    basic: {
      type: Number,
      default: 0,
      min: [0, 'Basic salary cannot be negative']
    }
  },
  // EOBI (Employees' Old-Age Benefits Institution) - Pakistan
  eobi: {
    isActive: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'EOBI amount cannot be negative']
    },
    percentage: {
      type: Number,
      default: 1, // 1% of minimum wage
      min: [0, 'EOBI percentage cannot be negative']
    }
  },
  // Provident Fund (PF) - Pakistan
  providentFund: {
    isActive: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Provident Fund amount cannot be negative']
    },
    percentage: {
      type: Number,
      default: 8.34, // 8.34% of basic salary for employees
      min: [0, 'Provident Fund percentage cannot be negative']
    }
  },
  currency: {
    type: String,
    default: 'PKR',
    enum: ['PKR', 'USD', 'EUR']
  },
  // Salary calculation helpers
  salaryStructure: {
    type: String,
    enum: ['Basic', 'Gross', 'Net'],
    default: 'Gross'
  },
  // Tax and deductions
  taxExemption: {
    type: Boolean,
    default: false
  },
  taxExemptionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax exemption amount cannot be negative']
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
  // Loan Information
  loans: {
    vehicleLoan: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Vehicle loan amount cannot be negative']
      },
      monthlyInstallment: {
        type: Number,
        default: 0,
        min: [0, 'Monthly installment cannot be negative']
      },
      outstandingBalance: {
        type: Number,
        default: 0,
        min: [0, 'Outstanding balance cannot be negative']
      },
      startDate: {
        type: Date
      },
      endDate: {
        type: Date
      }
    },
    companyLoan: {
      isActive: {
        type: Boolean,
        default: false
      },
      amount: {
        type: Number,
        default: 0,
        min: [0, 'Company loan amount cannot be negative']
      },
      monthlyInstallment: {
        type: Number,
        default: 0,
        min: [0, 'Monthly installment cannot be negative']
      },
      outstandingBalance: {
        type: Number,
        default: 0,
        min: [0, 'Outstanding balance cannot be negative']
      },
      startDate: {
        type: Date
      },
      endDate: {
        type: Date
      }
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
  isDeleted: {
    type: Boolean,
    default: false
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
employeeSchema.index({ isDeleted: 1 });
employeeSchema.index({ isActive: 1 });

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

// Auto-calculate salary components based on gross salary
employeeSchema.virtual('calculatedBasic').get(function() {
  if (!this.salary?.gross) return 0;
      return Math.round(this.salary.gross * 0.6666); // 66.66% of gross
});

employeeSchema.virtual('calculatedHouseRent').get(function() {
  if (!this.salary?.gross) return 0;
  return Math.round(this.salary.gross * 0.3); // 30% of gross
});

employeeSchema.virtual('calculatedMedical').get(function() {
  if (!this.salary?.gross) return 0;
  return Math.round(this.salary.gross * 0.1); // 10% of gross
});

// Salary calculation virtuals
employeeSchema.virtual('totalAllowances').get(function() {
  if (!this.salary) return 0;
  return (
    (this.salary.houseRent || this.calculatedHouseRent) +
    (this.salary.medical || this.calculatedMedical)
  );
});

employeeSchema.virtual('grossSalary').get(function() {
  if (!this.salary) return 0;
  return this.salary.gross || 0;
});

employeeSchema.virtual('basicSalary').get(function() {
  return this.salary?.basic || 0;
});

employeeSchema.virtual('houseRentAllowance').get(function() {
  return this.salary?.houseRent || 0;
});

employeeSchema.virtual('medicalAllowance').get(function() {
  return this.salary?.medical || 0;
});

employeeSchema.virtual('conveyanceAllowance').get(function() {
  return this.salary?.conveyance || 0;
});

employeeSchema.virtual('specialAllowance').get(function() {
  return this.salary?.special || 0;
});

employeeSchema.virtual('otherAllowance').get(function() {
  return this.salary?.other || 0;
});

// Pre-save middleware to auto-generate Employee ID, calculate probation dates, salary components, and update user reference
employeeSchema.pre('save', async function(next) {
  // Auto-generate Employee ID if not provided
  if (!this.employeeId || this.isNew) {
    try {
      const lastEmployee = await this.constructor.findOne({}, {}, { sort: { 'employeeId': -1 } });
      let nextId = 1;
      
      if (lastEmployee && lastEmployee.employeeId) {
        // Extract number from existing employee ID (assuming format like "EMP001", "EMP002", etc.)
        const match = lastEmployee.employeeId.match(/(\d+)$/);
        if (match) {
          nextId = parseInt(match[1]) + 1;
        }
      }
      
      // Format: 1, 2, 3, etc.
      this.employeeId = nextId.toString();
    } catch (error) {
      console.error('Error generating Employee ID:', error);
      // Fallback to timestamp-based ID
      this.employeeId = Date.now().toString().slice(-6);
    }
  }

  // Auto-calculate salary components if gross salary is provided
  if (this.salary?.gross && this.isModified('salary.gross')) {
    this.salary.basic = Math.round(this.salary.gross * 0.6666); // 66.66% of gross
          this.salary.houseRent = Math.round(this.salary.gross * 0.2334); // 23.34% of gross
    this.salary.medical = Math.round(this.salary.gross * 0.1); // 10% of gross
    
    // Calculate EOBI amount if EOBI is active
    if (this.eobi?.isActive) {
      // Pakistan EOBI: Fixed amount of Rs 370 (1% of minimum wage Rs 37,000)
      // This is the standard contribution for all employees
      this.eobi.amount = 370; // Fixed EOBI amount
      this.eobi.percentage = 1; // 1% of minimum wage
    } else {
      this.eobi.amount = 0;
    }
    
    // Calculate Provident Fund amount if PF is active
    if (this.providentFund?.isActive) {
      // Pakistan Provident Fund: 8.34% of basic salary
      const basicSalary = this.salary.basic;
              const pfPercentage = this.providentFund.percentage || 8.34;
      
              // Calculate PF amount (8.34% of basic salary)
      const pfAmount = Math.round((basicSalary * pfPercentage) / 100);
      
      this.providentFund.amount = pfAmount;
    } else {
      this.providentFund.amount = 0;
    }
    
    // Update related payrolls if this is an update (not a new employee)
    if (!this.isNew) {
      try {
        const Payroll = this.constructor.model('Payroll');
        const { calculateMonthlyTax, calculateTaxableIncome } = require('../../utils/taxCalculator');
        const FBRTaxSlab = require('./FBRTaxSlab');
        
        // Find all payrolls for this employee
        const relatedPayrolls = await Payroll.find({ 
          employee: this._id,
          status: { $in: ['Draft', 'Approved'] } // Only update draft and approved payrolls
        });
        
        // Update each payroll with new salary structure
        for (const payroll of relatedPayrolls) {
          // Update basic salary and allowances
          payroll.basicSalary = this.salary.basic;
          payroll.houseRentAllowance = this.salary.houseRent;
          payroll.medicalAllowance = this.salary.medical;
          
          // Recalculate gross salary
          payroll.grossSalary = payroll.basicSalary + 
            payroll.houseRentAllowance + 
            payroll.medicalAllowance + 
            payroll.conveyanceAllowance + 
            payroll.specialAllowance + 
            payroll.otherAllowance + 
            payroll.overtimeAmount + 
            payroll.performanceBonus + 
            payroll.otherBonus;
          
          // Recalculate tax
          try {
            const taxableIncome = calculateTaxableIncome({
              basic: payroll.basicSalary,
              allowances: {
                housing: payroll.houseRentAllowance,
                transport: payroll.conveyanceAllowance,
                meal: payroll.specialAllowance,
                other: payroll.otherAllowance,
                medical: payroll.medicalAllowance
              }
            });
            
            const annualTaxableIncome = taxableIncome * 12;
            const taxAmount = await FBRTaxSlab.calculateTax(annualTaxableIncome);
            payroll.incomeTax = Math.round(taxAmount / 12);
          } catch (error) {
            console.error('Error recalculating tax for payroll:', payroll._id, error);
            // Fallback to old calculation
            const taxableIncome = calculateTaxableIncome({
              basic: payroll.basicSalary,
              allowances: {
                housing: payroll.houseRentAllowance,
                transport: payroll.conveyanceAllowance,
                meal: payroll.specialAllowance,
                other: payroll.otherAllowance,
                medical: payroll.medicalAllowance
              }
            });
            payroll.incomeTax = calculateMonthlyTax(taxableIncome);
          }
          
          // Recalculate total deductions
          payroll.totalDeductions = payroll.providentFund + 
            payroll.incomeTax + 
            payroll.healthInsurance + 
            payroll.otherDeductions;
          
          // Recalculate net salary
          payroll.netSalary = payroll.grossSalary - payroll.totalDeductions;
          
          // Save the updated payroll
          await payroll.save();
        }
        
        console.log(`Updated ${relatedPayrolls.length} payrolls for employee ${this.employeeId}`);
      } catch (error) {
        console.error('Error updating related payrolls:', error);
        // Don't fail the employee save if payroll update fails
      }
    }
  }

  // Calculate end of probation date and confirmation date if appointment date or probation period changes
  if (this.appointmentDate && this.probationPeriodMonths) {
    const endDate = new Date(this.appointmentDate);
    endDate.setMonth(endDate.getMonth() + this.probationPeriodMonths);
    this.endOfProbationDate = endDate;
    this.confirmationDate = new Date(endDate); // Confirmation date is the same as end of probation date
  }
  
  // Update corresponding user document
  if (this.isModified('firstName') || this.isModified('lastName') || this.isModified('email')) {
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
        averageBasicSalary: { $avg: '$salary.basic' },
        totalBasicSalary: { $sum: '$salary.basic' },
        averageGrossSalary: { $avg: '$salary.gross' },
        totalGrossSalary: { $sum: '$salary.gross' }
      }
    }
  ]);
  
  return stats[0] || {
    totalEmployees: 0,
    activeEmployees: 0,
    averageBasicSalary: 0,
    totalBasicSalary: 0,
    averageGrossSalary: 0,
    totalGrossSalary: 0
  };
};

// Static method to update all payrolls for an employee
employeeSchema.statics.updateEmployeePayrolls = async function(employeeId) {
  const employee = await this.findOne({ _id: employeeId, isDeleted: false });
  if (!employee) {
    throw new Error('Employee not found or has been deleted');
  }

  const Payroll = this.model('Payroll');
  const { calculateMonthlyTax, calculateTaxableIncome } = require('../../utils/taxCalculator');
  const FBRTaxSlab = require('./FBRTaxSlab');
  
  // Find all payrolls for this employee
  const relatedPayrolls = await Payroll.find({ 
    employee: employeeId,
    status: { $in: ['Draft', 'Approved'] } // Only update draft and approved payrolls
  });
  
  let updatedCount = 0;
  
  // Update each payroll with new salary structure
  for (const payroll of relatedPayrolls) {
    // Update basic salary and allowances
    payroll.basicSalary = employee.salary.basic;
    payroll.houseRentAllowance = employee.salary.houseRent;
    payroll.medicalAllowance = employee.salary.medical;
    
    // Recalculate gross salary
    payroll.grossSalary = payroll.basicSalary + 
      payroll.houseRentAllowance + 
      payroll.medicalAllowance + 
      payroll.conveyanceAllowance + 
      payroll.specialAllowance + 
      payroll.otherAllowance + 
      payroll.overtimeAmount + 
      payroll.performanceBonus + 
      payroll.otherBonus;
    
    // Recalculate tax
    try {
      const taxableIncome = calculateTaxableIncome({
        basic: payroll.basicSalary,
        allowances: {
          housing: payroll.houseRentAllowance,
          transport: payroll.conveyanceAllowance,
          meal: payroll.specialAllowance,
          other: payroll.otherAllowance,
          medical: payroll.medicalAllowance
        }
      });
      
      const annualTaxableIncome = taxableIncome * 12;
      const taxAmount = await FBRTaxSlab.calculateTax(annualTaxableIncome);
      payroll.incomeTax = Math.round(taxAmount / 12);
    } catch (error) {
      console.error('Error recalculating tax for payroll:', payroll._id, error);
      // Fallback to old calculation
      const taxableIncome = calculateTaxableIncome({
        basic: payroll.basicSalary,
        allowances: {
          housing: payroll.houseRentAllowance,
          transport: payroll.conveyanceAllowance,
          meal: payroll.specialAllowance,
          other: payroll.otherAllowance,
          medical: payroll.medicalAllowance
        }
      });
      payroll.incomeTax = calculateMonthlyTax(taxableIncome);
    }
    
    // Recalculate total deductions
    payroll.totalDeductions = payroll.providentFund + 
      payroll.incomeTax + 
      payroll.healthInsurance + 
      payroll.otherDeductions;
    
    // Recalculate net salary
    payroll.netSalary = payroll.grossSalary - payroll.totalDeductions;
    
    // Save the updated payroll
    await payroll.save();
    updatedCount++;
  }
  
  return {
    employeeId: employee.employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    updatedPayrolls: updatedCount,
    totalPayrolls: relatedPayrolls.length
  };
};

module.exports = mongoose.model('Employee', employeeSchema); 