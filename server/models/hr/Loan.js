const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const loanSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required']
  },
  loanType: {
    type: String,
    enum: ['Personal', 'Housing', 'Vehicle', 'Education', 'Medical', 'Emergency', 'Other'],
    required: [true, 'Loan type is required']
  },
  loanAmount: {
    type: Number,
    required: [true, 'Loan amount is required'],
    min: [1000, 'Loan amount must be at least 1000'],
    max: [10000000, 'Loan amount cannot exceed 10,000,000']
  },
  interestRate: {
    type: Number,
    required: [true, 'Interest rate is required'],
    min: [0, 'Interest rate cannot be negative'],
    max: [100, 'Interest rate cannot exceed 100%']
  },
  loanTerm: {
    type: Number,
    required: [true, 'Loan term is required'],
    min: [1, 'Loan term must be at least 1 month'],
    max: [120, 'Loan term cannot exceed 120 months']
  },
  monthlyInstallment: {
    type: Number,
    required: [true, 'Monthly installment is required'],
    min: [0, 'Monthly installment cannot be negative']
  },
  totalPayable: {
    type: Number,
    required: [true, 'Total payable amount is required'],
    min: [0, 'Total payable cannot be negative']
  },
  purpose: {
    type: String,
    required: [true, 'Loan purpose is required'],
    trim: true,
    maxlength: [500, 'Purpose cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Disbursed', 'Active', 'Completed', 'Defaulted'],
    default: 'Pending'
  },
  applicationDate: {
    type: Date,
    default: Date.now
  },
  approvalDate: {
    type: Date
  },
  disbursementDate: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  disbursedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  // Loan disbursement details
  disbursementMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Check', 'Direct Deposit'],
    default: 'Bank Transfer'
  },
  bankAccount: {
    type: String,
    trim: true
  },
  // Collateral information
  collateral: {
    type: String,
    trim: true,
    maxlength: [200, 'Collateral description cannot exceed 200 characters']
  },
  collateralValue: {
    type: Number,
    min: [0, 'Collateral value cannot be negative']
  },
  // Guarantor information
  guarantor: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Guarantor name cannot exceed 100 characters']
    },
    relationship: {
      type: String,
      trim: true,
      maxlength: [50, 'Relationship cannot exceed 50 characters']
    },
    phone: {
      type: String,
      trim: true
    },
    idCard: {
      type: String,
      trim: true
    }
  },
  // Loan schedule and payments
  loanSchedule: [{
    installmentNumber: {
      type: Number,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Installment amount cannot be negative']
    },
    principal: {
      type: Number,
      required: true,
      min: [0, 'Principal cannot be negative']
    },
    interest: {
      type: Number,
      required: true,
      min: [0, 'Interest cannot be negative']
    },
    balance: {
      type: Number,
      required: true,
      min: [0, 'Balance cannot be negative']
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Overdue', 'Partial'],
      default: 'Pending'
    },
    paymentDate: {
      type: Date
    },
    paymentMethod: {
      type: String,
      enum: ['Salary Deduction', 'Direct Payment', 'Bank Transfer', 'Cash']
    }
  }],
  // Payment tracking
  totalPaid: {
    type: Number,
    default: 0,
    min: [0, 'Total paid cannot be negative']
  },
  totalPrincipalPaid: {
    type: Number,
    default: 0,
    min: [0, 'Total principal paid cannot be negative']
  },
  totalInterestPaid: {
    type: Number,
    default: 0,
    min: [0, 'Total interest paid cannot be negative']
  },
  outstandingBalance: {
    type: Number,
    default: 0,
    min: [0, 'Outstanding balance cannot be negative']
  },
  overdueAmount: {
    type: Number,
    default: 0,
    min: [0, 'Overdue amount cannot be negative']
  },
  // Salary deduction settings
  salaryDeduction: {
    enabled: {
      type: Boolean,
      default: true
    },
    percentage: {
      type: Number,
      min: [0, 'Deduction percentage cannot be negative'],
      max: [100, 'Deduction percentage cannot exceed 100%']
    },
    fixedAmount: {
      type: Number,
      min: [0, 'Fixed deduction amount cannot be negative']
    },
    deductionType: {
      type: String,
      enum: ['Percentage', 'Fixed Amount'],
      default: 'Fixed Amount'
    }
  },
  // Documents
  documents: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    filePath: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Notes and comments
  notes: [{
    content: {
      type: String,
      required: true,
      trim: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Audit fields
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

// Indexes for better performance
loanSchema.index({ employee: 1, status: 1 });
loanSchema.index({ applicationDate: -1 });
loanSchema.index({ status: 1 });
loanSchema.index({ loanType: 1 });

// Virtual for loan progress percentage
loanSchema.virtual('progressPercentage').get(function() {
  if (this.totalPayable === 0) return 0;
  return Math.round((this.totalPaid / this.totalPayable) * 100);
});

// Virtual for remaining installments
loanSchema.virtual('remainingInstallments').get(function() {
  return this.loanSchedule.filter(installment => 
    ['Pending', 'Overdue', 'Partial'].includes(installment.status)
  ).length;
});

// Virtual for next due date
loanSchema.virtual('nextDueDate').get(function() {
  const nextInstallment = this.loanSchedule.find(installment => 
    ['Pending', 'Overdue', 'Partial'].includes(installment.status)
  );
  return nextInstallment ? nextInstallment.dueDate : null;
});

// Pre-save middleware to calculate loan details
loanSchema.pre('save', function(next) {
  // Always calculate for new documents or when loan details are modified
  if (this.isNew || this.isModified('loanAmount') || this.isModified('interestRate') || this.isModified('loanTerm')) {
    // Calculate monthly installment using EMI formula
    const principal = this.loanAmount;
    const rate = this.interestRate / 100 / 12; // Monthly interest rate
    const time = this.loanTerm;
    
    if (rate === 0) {
      this.monthlyInstallment = principal / time;
    } else {
      this.monthlyInstallment = principal * (rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
    }
    
    // Ensure values are valid numbers
    this.monthlyInstallment = Math.max(0, this.monthlyInstallment || 0);
    this.totalPayable = this.monthlyInstallment * this.loanTerm;
    this.outstandingBalance = this.totalPayable - (this.totalPaid || 0);
  }
  
  next();
});

// Method to generate loan schedule
loanSchema.methods.generateLoanSchedule = function() {
  const schedule = [];
  let remainingBalance = this.loanAmount;
  const monthlyRate = this.interestRate / 100 / 12;
  
  // Ensure monthlyInstallment is calculated and valid
  if (!this.monthlyInstallment || isNaN(this.monthlyInstallment) || this.monthlyInstallment <= 0) {
    // Recalculate EMI
    const principal = this.loanAmount;
    const rate = this.interestRate / 100 / 12;
    const time = this.loanTerm;
    
    if (rate === 0) {
      this.monthlyInstallment = principal / time;
    } else {
      this.monthlyInstallment = principal * (rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
    }
    
    // Update totalPayable and outstandingBalance if they're not set
    if (!this.totalPayable || isNaN(this.totalPayable)) {
      this.totalPayable = this.monthlyInstallment * this.loanTerm;
    }
    if (!this.outstandingBalance || isNaN(this.outstandingBalance)) {
      this.outstandingBalance = this.totalPayable - (this.totalPaid || 0);
    }
  }
  
  for (let i = 1; i <= this.loanTerm; i++) {
    const interest = remainingBalance * monthlyRate;
    const principal = this.monthlyInstallment - interest;
    remainingBalance = Math.max(0, remainingBalance - principal);
    
    const dueDate = new Date(this.applicationDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedule.push({
      installmentNumber: i,
      dueDate: dueDate,
      amount: this.monthlyInstallment,
      principal: Math.max(0, principal),
      interest: Math.max(0, interest),
      balance: Math.max(0, remainingBalance),
      status: 'Pending'
    });
  }
  
  this.loanSchedule = schedule;
  return schedule;
};

// Method to process payment
loanSchema.methods.processPayment = function(amount, paymentMethod = 'Salary Deduction') {
  if (amount <= 0) {
    throw new Error('Payment amount must be positive');
  }
  
  let remainingAmount = amount;
  let updatedInstallments = [];
  
  // Process payments starting from the oldest pending installment
  for (let installment of this.loanSchedule) {
    if (remainingAmount <= 0) break;
    
    if (['Pending', 'Overdue', 'Partial'].includes(installment.status)) {
      const amountToPay = Math.min(remainingAmount, installment.amount);
      const newPaidAmount = (installment.paidAmount || 0) + amountToPay;
      
      if (newPaidAmount >= installment.amount) {
        installment.status = 'Paid';
        installment.paymentDate = new Date();
        installment.paymentMethod = paymentMethod;
        installment.paidAmount = installment.amount;
      } else {
        installment.status = 'Partial';
        installment.paidAmount = newPaidAmount;
      }
      
      remainingAmount -= amountToPay;
    }
    
    updatedInstallments.push(installment);
  }
  
  this.loanSchedule = updatedInstallments;
  this.totalPaid += (amount - remainingAmount);
  this.outstandingBalance = this.totalPayable - this.totalPaid;
  
  // Update status if loan is completed
  if (this.outstandingBalance <= 0) {
    this.status = 'Completed';
  } else if (this.status === 'Disbursed') {
    this.status = 'Active';
  }
  
  return {
    processedAmount: amount - remainingAmount,
    remainingAmount: remainingAmount,
    newOutstandingBalance: this.outstandingBalance
  };
};

// Static method to get loan statistics
loanSchema.statics.getLoanStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalLoans: { $sum: 1 },
        totalAmount: { $sum: '$loanAmount' },
        totalOutstanding: { $sum: '$outstandingBalance' },
        totalPaid: { $sum: '$totalPaid' },
        avgLoanAmount: { $avg: '$loanAmount' }
      }
    }
  ]);
  
  const statusStats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$loanAmount' }
      }
    }
  ]);
  
  return {
    overall: stats[0] || {},
    byStatus: statusStats
  };
};

loanSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Loan', loanSchema); 