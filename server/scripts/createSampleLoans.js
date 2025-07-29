const mongoose = require('mongoose');
const Loan = require('../models/hr/Loan');
const Employee = require('../models/hr/Employee');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const sampleLoans = [
  {
    loanType: 'Personal',
    loanAmount: 50000,
    interestRate: 12,
    loanTerm: 12,
    purpose: 'Home renovation and furniture purchase',
    collateral: 'None',
    guarantor: {
      name: 'Ahmed Khan',
      relationship: 'Brother',
      phone: '0300-1234567',
      idCard: '35202-1234567-1'
    },
    salaryDeduction: {
      enabled: true,
      deductionType: 'Fixed Amount',
      fixedAmount: 5000
    },
    status: 'Pending'
  },
  {
    loanType: 'Vehicle',
    loanAmount: 800000,
    interestRate: 10,
    loanTerm: 36,
    purpose: 'Purchase of new car for work commute',
    collateral: 'Vehicle registration papers',
    collateralValue: 800000,
    guarantor: {
      name: 'Fatima Ali',
      relationship: 'Father',
      phone: '0300-2345678',
      idCard: '35202-2345678-2'
    },
    salaryDeduction: {
      enabled: true,
      deductionType: 'Percentage',
      percentage: 15
    },
    status: 'Approved'
  },
  {
    loanType: 'Education',
    loanAmount: 200000,
    interestRate: 8,
    loanTerm: 24,
    purpose: 'Children education fees and books',
    collateral: 'None',
    guarantor: {
      name: 'Muhammad Hassan',
      relationship: 'Uncle',
      phone: '0300-3456789',
      idCard: '35202-3456789-3'
    },
    salaryDeduction: {
      enabled: true,
      deductionType: 'Fixed Amount',
      fixedAmount: 10000
    },
    status: 'Active'
  },
  {
    loanType: 'Medical',
    loanAmount: 150000,
    interestRate: 6,
    loanTerm: 18,
    purpose: 'Medical treatment and surgery expenses',
    collateral: 'None',
    guarantor: {
      name: 'Ayesha Khan',
      relationship: 'Sister',
      phone: '0300-4567890',
      idCard: '35202-4567890-4'
    },
    salaryDeduction: {
      enabled: true,
      deductionType: 'Fixed Amount',
      fixedAmount: 8000
    },
    status: 'Completed'
  },
  {
    loanType: 'Housing',
    loanAmount: 2000000,
    interestRate: 9,
    loanTerm: 60,
    purpose: 'House construction and renovation',
    collateral: 'Property documents',
    collateralValue: 2500000,
    guarantor: {
      name: 'Abdul Rahman',
      relationship: 'Father-in-law',
      phone: '0300-5678901',
      idCard: '35202-5678901-5'
    },
    salaryDeduction: {
      enabled: true,
      deductionType: 'Percentage',
      percentage: 20
    },
    status: 'Disbursed'
  }
];

const createSampleLoans = async () => {
  try {
    // Get all employees
    const employees = await Employee.find().limit(5);
    
    if (employees.length === 0) {
      console.log('❌ No employees found. Please create employees first.');
      return;
    }

    console.log(`📋 Found ${employees.length} employees`);

    // Create loans for each employee
    for (let i = 0; i < Math.min(employees.length, sampleLoans.length); i++) {
      const employee = employees[i];
      const loanData = sampleLoans[i];

      // Check if employee already has a loan
      const existingLoan = await Loan.findOne({ employee: employee._id });
      if (existingLoan) {
        console.log(`⚠️  Employee ${employee.firstName} ${employee.lastName} already has a loan`);
        continue;
      }

      // Create loan with employee data
      const loan = new Loan({
        ...loanData,
        employee: employee._id,
        createdBy: employee.user || employee._id, // Use employee ID as fallback
        applicationDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
      });

      // Ensure EMI and total payable are calculated
      const principal = loan.loanAmount;
      const rate = loan.interestRate / 100 / 12;
      const time = loan.loanTerm;
      
      if (rate === 0) {
        loan.monthlyInstallment = principal / time;
      } else {
        loan.monthlyInstallment = principal * (rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
      }
      
      loan.totalPayable = loan.monthlyInstallment * loan.loanTerm;
      loan.outstandingBalance = loan.totalPayable;

      // Generate loan schedule
      loan.generateLoanSchedule();

      // Set approval and disbursement dates for non-pending loans
      if (loan.status !== 'Pending') {
        loan.approvalDate = new Date(loan.applicationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        loan.approvedBy = employee.user || employee._id;
        
        if (['Disbursed', 'Active', 'Completed'].includes(loan.status)) {
          loan.disbursementDate = new Date(loan.approvalDate.getTime() + 3 * 24 * 60 * 60 * 1000);
          loan.disbursedBy = employee.user || employee._id;
        }
      }

      // Add some payments for active/completed loans
      if (['Active', 'Completed'].includes(loan.status)) {
        const monthsPaid = loan.status === 'Completed' ? loan.loanTerm : Math.floor(Math.random() * loan.loanTerm);
        
        for (let j = 0; j < monthsPaid; j++) {
          if (j < loan.loanSchedule.length) {
            loan.loanSchedule[j].status = 'Paid';
            loan.loanSchedule[j].paymentDate = new Date(loan.disbursementDate.getTime() + (j + 1) * 30 * 24 * 60 * 60 * 1000);
            loan.loanSchedule[j].paymentMethod = 'Salary Deduction';
          }
        }

        // Update payment totals
        const paidInstallments = loan.loanSchedule.filter(inst => inst.status === 'Paid');
        loan.totalPaid = paidInstallments.reduce((sum, inst) => sum + inst.amount, 0);
        loan.outstandingBalance = loan.totalPayable - loan.totalPaid;

        if (loan.status === 'Completed') {
          loan.totalPaid = loan.totalPayable;
          loan.outstandingBalance = 0;
        }
      }

      await loan.save();
      console.log(`✅ Created loan for ${employee.firstName} ${employee.lastName}: ${loan.loanType} - ${loan.status}`);
    }

    console.log('🎉 Sample loans created successfully!');
    
    // Display summary
    const loanStats = await Loan.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$loanAmount' }
        }
      }
    ]);

    console.log('\n📊 Loan Summary:');
    loanStats.forEach(stat => {
      console.log(`${stat._id}: ${stat.count} loans (${stat.totalAmount.toLocaleString()} PKR)`);
    });

  } catch (error) {
    console.error('❌ Error creating sample loans:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the script
createSampleLoans(); 