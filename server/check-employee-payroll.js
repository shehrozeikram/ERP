const mongoose = require('mongoose');
const { connectDB } = require('./config/database');
require('dotenv').config();
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const checkEmployeePayroll = async () => {
  try {
    await connectDB();
    console.log('🔌 Connected to database');

    const employeeId = '68931fa2e82767d5e23948bb';
    
    // First, let's check if this employee exists
    const employee = await Employee.findById(employeeId);
    if (employee) {
      console.log(`\n👤 Employee Found:`);
      console.log(`   Name: ${employee.firstName} ${employee.lastName}`);
      console.log(`   Employee ID: ${employee.employeeId}`);
      console.log(`   Department: ${employee.department}`);
      console.log(`   Position: ${employee.position}`);
    } else {
      console.log(`\n❌ Employee with ID ${employeeId} not found`);
      return;
    }

    // Now check for payroll records
    console.log(`\n🔍 Searching for payroll records...`);
    const payrolls = await Payroll.find({ employee: employeeId });
    
    if (payrolls.length === 0) {
      console.log(`✅ No payroll records found for employee ${employeeId}`);
      console.log(`   This is expected since we just cleared all payrolls`);
    } else {
      console.log(`📊 Found ${payrolls.length} payroll record(s):`);
      
      payrolls.forEach((payroll, index) => {
        console.log(`\n📋 Payroll ${index + 1}:`);
        console.log(`   ID: ${payroll._id}`);
        console.log(`   Month/Year: ${payroll.month}/${payroll.year}`);
        console.log(`   Basic Salary: ${payroll.basicSalary?.toLocaleString() || 'N/A'}`);
        console.log(`   Gross Salary: ${payroll.grossSalary?.toLocaleString() || 'N/A'}`);
        console.log(`   Total Earnings: ${payroll.totalEarnings?.toLocaleString() || 'N/A'}`);
        console.log(`   Income Tax: ${payroll.incomeTax?.toLocaleString() || 'N/A'}`);
        console.log(`   Provident Fund: ${payroll.providentFund?.toLocaleString() || 'N/A'}`);
        console.log(`   EOBI: ${payroll.eobi || 'N/A'}`);
        console.log(`   Total Deductions: ${payroll.totalDeductions?.toLocaleString() || 'N/A'}`);
        console.log(`   Net Salary: ${payroll.netSalary?.toLocaleString() || 'N/A'}`);
        console.log(`   Status: ${payroll.status || 'N/A'}`);
        console.log(`   Created: ${payroll.createdAt || 'N/A'}`);
      });
    }

    // Also check if there are any payrolls with this employee ID in the entire collection
    console.log(`\n🔍 Checking entire payroll collection...`);
    const totalPayrolls = await Payroll.countDocuments();
    console.log(`   Total payrolls in database: ${totalPayrolls}`);
    
    if (totalPayrolls > 0) {
      console.log(`   There are still ${totalPayrolls} payroll records in the database`);
      
      // Show a few sample records
      const samplePayrolls = await Payroll.find().limit(5);
      console.log(`\n📋 Sample payroll records:`);
      samplePayrolls.forEach((payroll, index) => {
        console.log(`   ${index + 1}. Employee: ${payroll.employee}, Month: ${payroll.month}/${payroll.year}, Basic: ${payroll.basicSalary?.toLocaleString() || 'N/A'}`);
      });
    } else {
      console.log(`   ✅ Database is completely empty - all payrolls cleared successfully`);
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

// Run the script
checkEmployeePayroll();
