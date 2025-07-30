const mongoose = require('mongoose');
const FinalSettlement = require('../models/hr/FinalSettlement');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected for creating sample final settlements'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const settlementTypes = ['resignation', 'termination', 'retirement', 'contract_end', 'death', 'other'];
const statuses = ['pending', 'approved', 'processed', 'paid', 'cancelled'];
const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations'];
const paymentMethods = ['bank_transfer', 'cash', 'cheque', 'online'];

const reasons = [
  'Career advancement opportunity',
  'Personal reasons',
  'Health issues',
  'Family relocation',
  'Contract completion',
  'Company restructuring',
  'Retirement',
  'Better job offer',
  'Work-life balance',
  'Professional development'
];

const createSampleFinalSettlements = async () => {
  try {
    // Get existing employees
    const employees = await Employee.find().limit(10);
    const users = await User.find().limit(5);

    if (employees.length === 0) {
      console.log('❌ No employees found. Please create employees first.');
      return;
    }

    if (users.length === 0) {
      console.log('❌ No users found. Please create users first.');
      return;
    }

    console.log(`📋 Creating sample final settlements for ${employees.length} employees...`);

    const settlements = [];

    for (let i = 0; i < Math.min(employees.length, 8); i++) {
      const employee = employees[i];
      const user = users[Math.floor(Math.random() * users.length)];
      
      const settlementType = settlementTypes[Math.floor(Math.random() * settlementTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      
      const lastWorkingDate = new Date();
      lastWorkingDate.setDate(lastWorkingDate.getDate() - Math.floor(Math.random() * 30));
      
      const settlementDate = new Date(lastWorkingDate);
      settlementDate.setDate(settlementDate.getDate() + Math.floor(Math.random() * 15));
      
      const noticePeriod = [30, 60, 90][Math.floor(Math.random() * 3)];
      const noticePeriodServed = Math.floor(Math.random() * (noticePeriod + 1));
      const noticePeriodShortfall = Math.max(0, noticePeriod - noticePeriodServed);

      // Calculate salary components
      const basicSalary = employee.salary?.basic || 50000;
      const grossSalary = employee.salary?.gross || 70000;
      const netSalary = employee.salary?.net || 60000;

      // Calculate earnings
      const earnings = {
        basicSalary: basicSalary,
        houseRent: employee.salary?.houseRent || 15000,
        medicalAllowance: employee.salary?.medicalAllowance || 5000,
        conveyanceAllowance: employee.salary?.conveyanceAllowance || 3000,
        otherAllowances: employee.salary?.otherAllowances || 2000,
        overtime: Math.floor(Math.random() * 10000),
        bonus: Math.floor(Math.random() * 20000),
        gratuity: Math.floor(Math.random() * 50000),
        leaveEncashment: Math.floor(Math.random() * 30000),
        providentFund: Math.floor(Math.random() * 15000),
        eobi: Math.floor(Math.random() * 5000),
        totalEarnings: 0
      };

      // Calculate deductions
      const deductions = {
        incomeTax: Math.floor(Math.random() * 10000),
        providentFund: Math.floor(Math.random() * 8000),
        eobi: Math.floor(Math.random() * 3000),
        loanDeductions: Math.floor(Math.random() * 20000),
        noticePeriodDeduction: noticePeriodShortfall > 0 ? (basicSalary / 30) * noticePeriodShortfall : 0,
        otherDeductions: Math.floor(Math.random() * 5000),
        totalDeductions: 0
      };

      // Calculate totals
      earnings.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);
      deductions.totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);

      const grossSettlementAmount = earnings.totalEarnings;
      const netSettlementAmount = grossSettlementAmount - deductions.totalDeductions;

      // Create loan settlements
      const loans = [];
      const numLoans = Math.floor(Math.random() * 3);
      for (let j = 0; j < numLoans; j++) {
        const loanAmount = Math.floor(Math.random() * 100000) + 50000;
        const outstandingBalance = Math.floor(Math.random() * loanAmount);
        const settledAmount = status === 'paid' ? outstandingBalance : 0;
        
        loans.push({
          loanId: new mongoose.Types.ObjectId(),
          loanType: ['personal', 'home', 'vehicle', 'education'][Math.floor(Math.random() * 4)],
          originalAmount: loanAmount,
          outstandingBalance: outstandingBalance,
          settledAmount: settledAmount,
          settlementType: status === 'paid' ? 'full_settlement' : 'pending'
        });
      }

      const settlement = new FinalSettlement({
        employee: employee._id,
        employeeId: employee.employeeId,
        employeeName: employee.name,
        department: employee.department,
        designation: employee.designation,
        settlementType,
        reason,
        noticePeriod,
        noticePeriodServed,
        noticePeriodShortfall,
        lastWorkingDate,
        settlementDate,
        basicSalary,
        grossSalary,
        netSalary,
        earnings,
        deductions,
        loans,
        grossSettlementAmount,
        netSettlementAmount,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        bankDetails: {
          bankName: ['HBL', 'UBL', 'MCB', 'ABL', 'JS Bank'][Math.floor(Math.random() * 5)],
          accountNumber: Math.floor(Math.random() * 1000000000).toString(),
          accountTitle: employee.name
        },
        status,
        approvalLevel: ['hr_manager', 'finance_manager', 'general_manager', 'ceo'][Math.floor(Math.random() * 4)],
        currentApprover: status === 'pending' ? user._id : null,
        approvedBy: ['approved', 'processed', 'paid'].includes(status) ? user._id : null,
        processedBy: ['processed', 'paid'].includes(status) ? user._id : null,
        leaveBalance: {
          annual: Math.floor(Math.random() * 30),
          sick: Math.floor(Math.random() * 15),
          casual: Math.floor(Math.random() * 10),
          other: Math.floor(Math.random() * 5),
          total: 0
        },
        leaveEncashmentAmount: Math.floor(Math.random() * 30000),
        totalLoanSettlement: loans.reduce((sum, loan) => sum + (loan.settledAmount || 0), 0),
        documents: [
          {
            name: 'Resignation Letter',
            type: 'pdf',
            url: '/uploads/documents/resignation.pdf'
          },
          {
            name: 'Exit Interview Form',
            type: 'pdf',
            url: '/uploads/documents/exit-interview.pdf'
          }
        ],
        comments: [
          {
            user: user._id,
            comment: 'Settlement application submitted',
            timestamp: new Date()
          }
        ],
        notes: `Sample settlement for ${employee.name}`,
        createdBy: user._id,
        updatedBy: user._id
      });

      // Calculate leave balance total
      settlement.leaveBalance.total = 
        settlement.leaveBalance.annual + 
        settlement.leaveBalance.sick + 
        settlement.leaveBalance.casual + 
        settlement.leaveBalance.other;

      settlements.push(settlement);
    }

    // Save all settlements
    await FinalSettlement.insertMany(settlements);

    console.log(`✅ Successfully created ${settlements.length} sample final settlements`);
    
    // Display summary
    const stats = await FinalSettlement.aggregate([
      {
        $group: {
          _id: null,
          totalSettlements: { $sum: 1 },
          totalAmount: { $sum: '$netSettlementAmount' },
          avgAmount: { $avg: '$netSettlementAmount' }
        }
      }
    ]);

    if (stats.length > 0) {
      console.log('\n📊 Final Settlement Summary:');
      console.log(`Total Settlements: ${stats[0].totalSettlements}`);
      console.log(`Total Amount: ₨${stats[0].totalAmount.toLocaleString()}`);
      console.log(`Average Amount: ₨${Math.round(stats[0].avgAmount).toLocaleString()}`);
    }

    // Status breakdown
    const statusBreakdown = await FinalSettlement.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📈 Status Breakdown:');
    statusBreakdown.forEach(status => {
      console.log(`${status._id}: ${status.count}`);
    });

    // Type breakdown
    const typeBreakdown = await FinalSettlement.aggregate([
      {
        $group: {
          _id: '$settlementType',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📋 Type Breakdown:');
    typeBreakdown.forEach(type => {
      console.log(`${type._id}: ${type.count}`);
    });

  } catch (error) {
    console.error('❌ Error creating sample final settlements:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the script
createSampleFinalSettlements(); 