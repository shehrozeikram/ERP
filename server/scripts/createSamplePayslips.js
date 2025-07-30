const mongoose = require('mongoose');
const Payslip = require('../models/hr/Payslip');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const generateSamplePayslips = async () => {
  try {
    console.log('🚀 Starting sample payslip generation...');

    // Get existing employees and users
    const employees = await Employee.find({ isActive: true }).limit(10);
    const users = await User.find().limit(1);

    if (employees.length === 0) {
      console.log('❌ No active employees found. Please create employees first.');
      return;
    }

    if (users.length === 0) {
      console.log('❌ No users found. Please create users first.');
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const samplePayslips = [];

    for (const employee of employees) {
      // Generate payslip for current month
      const basicSalary = employee.salary?.basic || 50000;
      const houseRent = employee.salary?.houseRent || 15000;
      const medicalAllowance = employee.salary?.medical || 5000;
      const conveyanceAllowance = employee.salary?.conveyance || 3000;
      const specialAllowance = employee.salary?.special || 10000;
      const otherAllowances = employee.salary?.other || 0;

      const grossSalary = basicSalary + houseRent + medicalAllowance + conveyanceAllowance + specialAllowance + otherAllowances;

      // Calculate tax (simplified)
      const monthlyTax = Math.max(0, (grossSalary - 50000) * 0.05);

      // Random attendance data
      const totalDays = 30;
      const presentDays = Math.floor(Math.random() * 5) + 25; // 25-30 days
      const absentDays = totalDays - presentDays;
      const lateDays = Math.floor(Math.random() * 3);
      const overtimeHours = Math.floor(Math.random() * 20);

      // Calculate overtime pay
      const hourlyRate = basicSalary / 176;
      const overtimePay = overtimeHours * hourlyRate * 1.5;

      // Random deductions
      const providentFund = basicSalary * 0.05;
      const eobi = basicSalary * 0.01;
      const loanDeduction = Math.random() > 0.7 ? Math.floor(Math.random() * 5000) + 1000 : 0;
      const lateDeduction = lateDays * 500;
      const absentDeduction = absentDays * 1000;

      const totalEarnings = grossSalary + overtimePay;
      const totalDeductions = monthlyTax + providentFund + eobi + loanDeduction + lateDeduction + absentDeduction;
      const netSalary = totalEarnings - totalDeductions;

      // Random status
      const statuses = ['draft', 'generated', 'approved', 'paid'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const payslip = new Payslip({
        employee: employee._id,
        employeeId: employee.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department?.name || 'Unknown',
        designation: employee.position?.title || 'Unknown',
        month: currentMonth,
        year: currentYear,
        payslipNumber: `PS${currentYear}${currentMonth.toString().padStart(2, '0')}${employee.employeeId}`,
        basicSalary,
        houseRent,
        medicalAllowance,
        conveyanceAllowance,
        specialAllowance,
        otherAllowances,
        earnings: {
          basicSalary,
          houseRent,
          medicalAllowance,
          conveyanceAllowance,
          specialAllowance,
          otherAllowances,
          overtime: overtimePay,
          bonus: Math.random() > 0.8 ? Math.floor(Math.random() * 10000) + 5000 : 0,
          incentives: Math.random() > 0.9 ? Math.floor(Math.random() * 5000) + 1000 : 0,
          arrears: 0,
          otherEarnings: 0
        },
        deductions: {
          providentFund,
          eobi,
          incomeTax: monthlyTax,
          loanDeduction,
          advanceDeduction: 0,
          lateDeduction,
          absentDeduction,
          otherDeductions: 0
        },
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        overtimeHours,
        grossSalary,
        totalEarnings,
        totalDeductions,
        netSalary,
        status,
        notes: `Sample payslip for ${employee.firstName} ${employee.lastName}`,
        createdBy: users[0]._id,
        ...(status === 'approved' && {
          approvedBy: users[0]._id,
          approvedAt: new Date()
        }),
        ...(status === 'paid' && {
          approvedBy: users[0]._id,
          approvedAt: new Date(),
          paymentDate: new Date(),
          paymentMethod: 'bank_transfer'
        })
      });

      samplePayslips.push(payslip);
    }

    // Save all payslips
    await Payslip.insertMany(samplePayslips);

    console.log(`✅ Successfully generated ${samplePayslips.length} sample payslips`);
    console.log('📊 Payslip Status Distribution:');
    
    const statusCounts = {};
    samplePayslips.forEach(payslip => {
      statusCounts[payslip.status] = (statusCounts[payslip.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('💰 Total Net Salary:', formatPKR(samplePayslips.reduce((sum, p) => sum + p.netSalary, 0)));
    console.log('📈 Average Net Salary:', formatPKR(samplePayslips.reduce((sum, p) => sum + p.netSalary, 0) / samplePayslips.length));

  } catch (error) {
    console.error('❌ Error generating sample payslips:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Helper function to format currency
const formatPKR = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Run the script
generateSamplePayslips(); 