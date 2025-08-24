const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const testNetSalaryCalculation = async () => {
  try {
    console.log('🔌 Connecting to cloud database...');
    await connectDB();
    
    // Find a sample employee
    const employee = await Employee.findOne({});
    if (!employee) {
      console.log('❌ No employees found in database');
      await disconnectDB();
      return;
    }
    
    console.log(`👤 Testing with employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    
    // Create a test payroll with specific values
    const currentDate = new Date();
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    // Use a different month to avoid conflicts
    const testMonth = month === 11 ? 1 : month + 2;
    const testYear = month === 11 ? year + 1 : year;
    
    console.log(`📅 Creating test payroll for ${testMonth}/${testYear}`);
    
    // Test payroll data with known values
    const testPayrollData = {
      employee: employee._id,
      month: testMonth,
      year: testYear,
      basicSalary: 253308,
      houseRentAllowance: 88692,
      medicalAllowance: 38000,
      allowances: {
        conveyance: { isActive: false, amount: 0 },
        food: { isActive: false, amount: 0 },
        vehicleFuel: { isActive: true, amount: 35000 },
        medical: { isActive: false, amount: 0 },
        special: { isActive: false, amount: 0 },
        other: { isActive: false, amount: 0 }
      },
      overtimeAmount: 0,
      performanceBonus: 0,
      otherBonus: 0,
      totalWorkingDays: 26,
      presentDays: 22, // 4 absent days
      absentDays: 4,
      leaveDays: 0,
      incomeTax: 27180,
      eobi: 370,
      healthInsurance: 0,
      otherDeductions: 0,
      createdBy: employee._id
    };
    
    console.log('\n🧪 Creating test payroll with 4 absent days...');
    console.log('Expected calculations:');
    console.log('   Gross Salary (Base): Rs. 380,000 (253,308 + 88,692 + 38,000)');
    console.log('   Total Earnings: Rs. 415,000 (380,000 + 35,000)');
    console.log('   Daily Rate: Rs. 14,615.38 (380,000 ÷ 26)');
    console.log('   Attendance Deduction: Rs. 58,461.54 (4 × 14,615.38)');
    console.log('   Total Deductions: Rs. 86,011.54 (27,180 + 370 + 58,461.54)');
    console.log('   Net Salary: Rs. 328,988.46 (415,000 - 86,011.54)');
    
    // Create the payroll
    const payroll = new Payroll(testPayrollData);
    await payroll.save();
    
    console.log('\n✅ Test payroll created successfully');
    console.log(`📊 Payroll ID: ${payroll._id}`);
    
    // Display the actual calculated values
    console.log('\n📊 ACTUAL CALCULATED VALUES:');
    console.log(`   Gross Salary (Base): Rs. ${payroll.grossSalary?.toLocaleString() || 0}`);
    console.log(`   Total Earnings: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    console.log(`   Daily Rate: Rs. ${payroll.dailyRate?.toLocaleString() || 0}`);
    console.log(`   Present Days: ${payroll.presentDays}`);
    console.log(`   Absent Days: ${payroll.absentDays}`);
    console.log(`   Attendance Deduction: Rs. ${payroll.attendanceDeduction?.toLocaleString() || 0}`);
    console.log(`   Income Tax: Rs. ${payroll.incomeTax?.toLocaleString() || 0}`);
    console.log(`   EOBI: Rs. ${payroll.eobi?.toLocaleString() || 0}`);
    console.log(`   Total Deductions: Rs. ${payroll.totalDeductions?.toLocaleString() || 0}`);
    console.log(`   Net Salary: Rs. ${payroll.netSalary?.toLocaleString() || 0}`);
    
    // Verify calculations
    console.log('\n🔍 VERIFICATION:');
    
    // Check Gross Salary
    const expectedGrossSalary = 253308 + 88692 + 38000;
    if (Math.abs(payroll.grossSalary - expectedGrossSalary) < 1) {
      console.log('✅ Gross Salary calculation: CORRECT');
    } else {
      console.log('❌ Gross Salary calculation: INCORRECT');
      console.log(`   Expected: Rs. ${expectedGrossSalary.toLocaleString()}, Got: Rs. ${payroll.grossSalary?.toLocaleString() || 0}`);
    }
    
    // Check Total Earnings
    const expectedTotalEarnings = expectedGrossSalary + 35000;
    if (Math.abs(payroll.totalEarnings - expectedTotalEarnings) < 1) {
      console.log('✅ Total Earnings calculation: CORRECT');
    } else {
      console.log('❌ Total Earnings calculation: INCORRECT');
      console.log(`   Expected: Rs. ${expectedTotalEarnings.toLocaleString()}, Got: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    }
    
    // Check Daily Rate
    const expectedDailyRate = expectedGrossSalary / 26;
    if (Math.abs(payroll.dailyRate - expectedDailyRate) < 1) {
      console.log('✅ Daily Rate calculation: CORRECT');
    } else {
      console.log('❌ Daily Rate calculation: INCORRECT');
      console.log(`   Expected: Rs. ${expectedDailyRate.toLocaleString()}, Got: Rs. ${payroll.dailyRate?.toLocaleString() || 0}`);
    }
    
    // Check Attendance Deduction
    const expectedAttendanceDeduction = expectedDailyRate * 4;
    if (Math.abs(payroll.attendanceDeduction - expectedAttendanceDeduction) < 1) {
      console.log('✅ Attendance Deduction calculation: CORRECT');
    } else {
      console.log('❌ Attendance Deduction calculation: INCORRECT');
      console.log(`   Expected: Rs. ${expectedAttendanceDeduction.toLocaleString()}, Got: Rs. ${payroll.attendanceDeduction?.toLocaleString() || 0}`);
    }
    
    // Check Total Deductions
    const expectedTotalDeductions = 27180 + 370 + expectedAttendanceDeduction;
    if (Math.abs(payroll.totalDeductions - expectedTotalDeductions) < 1) {
      console.log('✅ Total Deductions calculation: CORRECT');
    } else {
      console.log('❌ Total Deductions calculation: INCORRECT');
      console.log(`   Expected: Rs. ${expectedTotalDeductions.toLocaleString()}, Got: Rs. ${payroll.totalDeductions?.toLocaleString() || 0}`);
    }
    
    // Check Net Salary
    const expectedNetSalary = expectedTotalEarnings - expectedTotalDeductions;
    if (Math.abs(payroll.netSalary - expectedNetSalary) < 1) {
      console.log('✅ Net Salary calculation: CORRECT');
    } else {
      console.log('❌ Net Salary calculation: INCORRECT');
      console.log(`   Expected: Rs. ${expectedNetSalary.toLocaleString()}, Got: Rs. ${payroll.netSalary?.toLocaleString() || 0}`);
    }
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    console.log(`   Expected Net Salary: Rs. ${expectedNetSalary.toLocaleString()}`);
    console.log(`   Actual Net Salary: Rs. ${payroll.netSalary?.toLocaleString() || 0}`);
    console.log(`   Difference: Rs. ${Math.abs(payroll.netSalary - expectedNetSalary).toLocaleString()}`);
    
    if (Math.abs(payroll.netSalary - expectedNetSalary) < 1) {
      console.log('✅ SUCCESS: All calculations are correct!');
    } else {
      console.log('❌ FAILED: Some calculations are incorrect');
    }
    
    // Clean up - delete the test payroll
    console.log('\n🧹 Cleaning up test payroll...');
    await Payroll.findByIdAndDelete(payroll._id);
    console.log('✅ Test payroll deleted');
    
  } catch (error) {
    console.error('❌ Error during net salary calculation test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testNetSalaryCalculation()
    .then(() => {
      console.log('🎯 Net salary calculation test completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Net salary calculation test failed:', error);
      process.exit(1);
    });
}

module.exports = { testNetSalaryCalculation };
