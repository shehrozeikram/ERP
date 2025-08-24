const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const testPayrollCalculations = async () => {
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
    
    // Create a test payroll with the values from the image
    const currentDate = new Date();
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    console.log(`📅 Testing payroll for ${month + 1}/${year}`);
    
    // Check if payroll already exists for this month
    let payroll = await Payroll.findOne({
      employee: employee._id,
      month: month + 1,
      year: year
    });
    
    if (payroll) {
      console.log('📊 Existing payroll found, updating with test values...');
      
      // Update existing payroll with test data
      payroll.basicSalary = 253308;
      payroll.houseRentAllowance = 88692;
      payroll.medicalAllowance = 38000;
      payroll.allowances = {
        conveyance: { isActive: false, amount: 0 },
        food: { isActive: false, amount: 0 },
        vehicleFuel: { isActive: true, amount: 35000 },
        medical: { isActive: false, amount: 0 },
        special: { isActive: false, amount: 0 },
        other: { isActive: false, amount: 0 }
      };
      payroll.overtimeAmount = 0;
      payroll.performanceBonus = 0;
      payroll.otherBonus = 0;
      payroll.totalWorkingDays = 26;
      payroll.presentDays = 24;
      payroll.absentDays = 2;
      payroll.leaveDays = 0;
      payroll.incomeTax = 27180;
      payroll.eobi = 370;
      payroll.healthInsurance = 0;
      payroll.otherDeductions = 0;
      
      // Force recalculation
      payroll.dailyRate = undefined;
      payroll.attendanceDeduction = undefined;
      
      await payroll.save();
      console.log('✅ Existing payroll updated successfully');
    } else {
      console.log('📝 Creating new test payroll...');
      
      // Test payroll data based on the image
      const testPayrollData = {
        employee: employee._id,
        month: month + 1,
        year: year,
      basicSalary: 253308, // 66.66% of gross
      houseRentAllowance: 88692, // 23.34% of gross
      medicalAllowance: 38000, // 10% of gross
      allowances: {
        conveyance: { isActive: false, amount: 0 },
        food: { isActive: false, amount: 0 },
        vehicleFuel: { isActive: true, amount: 35000 }, // Vehicle & Fuel Allowance
        medical: { isActive: false, amount: 0 },
        special: { isActive: false, amount: 0 },
        other: { isActive: false, amount: 0 }
      },
      overtimeAmount: 0,
      performanceBonus: 0,
      otherBonus: 0,
      totalWorkingDays: 26,
      presentDays: 24,
      absentDays: 2, // 2 absent days
      leaveDays: 0,
      incomeTax: 27180,
      eobi: 370,
      healthInsurance: 0,
      otherDeductions: 0,
      createdBy: employee._id
    };
    
    console.log('\n🧪 Creating test payroll with specific values...');
    console.log('Expected calculations based on the image:');
    console.log('   Gross Salary (Base): Rs. 380,000 (253,308 + 88,692 + 38,000)');
    console.log('   Total Earnings: Rs. 415,000 (380,000 + 35,000 + 0 + 0 + 0)');
    console.log('   Daily Rate: Rs. 14,615 (380,000 ÷ 26)');
    console.log('   Attendance Deduction: Rs. 29,230 (2 absent days × 14,615)');
    console.log('   Total Deductions: Rs. 56,780 (27,180 + 370 + 29,230)');
    console.log('   Net Salary: Rs. 358,220 (415,000 - 56,780)');
    
          // Create the payroll
      payroll = new Payroll(testPayrollData);
      await payroll.save();
      
      console.log('\n✅ New payroll created successfully');
    }
    
    // Show the actual calculated values
    console.log('\n📊 ACTUAL CALCULATED VALUES:');
    console.log(`   Gross Salary (Base): Rs. ${payroll.grossSalary?.toLocaleString() || 0}`);
    console.log(`   Total Earnings: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    console.log(`   Daily Rate: Rs. ${payroll.dailyRate?.toFixed(2) || 0}`);
    console.log(`   Attendance Deduction: Rs. ${payroll.attendanceDeduction?.toLocaleString() || 0}`);
    console.log(`   Total Deductions: Rs. ${payroll.totalDeductions?.toLocaleString() || 0}`);
    console.log(`   Net Salary: Rs. ${payroll.netSalary?.toLocaleString() || 0}`);
    
    // Verify the calculations
    console.log('\n🔍 VERIFICATION:');
    
    // Check Gross Salary
    const expectedGrossSalary = 253308 + 88692 + 38000;
    if (Math.abs(payroll.grossSalary - expectedGrossSalary) < 1) {
      console.log('✅ Gross Salary calculation: CORRECT');
    } else {
      console.log(`❌ Gross Salary calculation: WRONG`);
      console.log(`   Expected: Rs. ${expectedGrossSalary.toLocaleString()}, Got: Rs. ${payroll.grossSalary?.toLocaleString() || 0}`);
    }
    
    // Check Total Earnings
    const expectedTotalEarnings = expectedGrossSalary + 35000 + 0 + 0 + 0;
    if (Math.abs(payroll.totalEarnings - expectedTotalEarnings) < 1) {
      console.log('✅ Total Earnings calculation: CORRECT');
    } else {
      console.log(`❌ Total Earnings calculation: WRONG`);
      console.log(`   Expected: Rs. ${expectedTotalEarnings.toLocaleString()}, Got: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    }
    
    // Check Daily Rate
    const expectedDailyRate = expectedGrossSalary / 26;
    if (Math.abs(payroll.dailyRate - expectedDailyRate) < 1) {
      console.log('✅ Daily Rate calculation: CORRECT');
    } else {
      console.log(`❌ Daily Rate calculation: WRONG`);
      console.log(`   Expected: Rs. ${expectedDailyRate.toFixed(2)}, Got: Rs. ${payroll.dailyRate?.toFixed(2) || 0}`);
    }
    
    // Check Attendance Deduction
    const expectedAttendanceDeduction = expectedDailyRate * 2; // 2 absent days
    if (Math.abs(payroll.attendanceDeduction - expectedAttendanceDeduction) < 1) {
      console.log('✅ Attendance Deduction calculation: CORRECT');
    } else {
      console.log(`❌ Attendance Deduction calculation: WRONG`);
      console.log(`   Expected: Rs. ${expectedAttendanceDeduction.toFixed(2)}, Got: Rs. ${payroll.attendanceDeduction?.toFixed(2) || 0}`);
    }
    
    // Check Total Deductions
    const expectedTotalDeductions = 27180 + 370 + expectedAttendanceDeduction;
    if (Math.abs(payroll.totalDeductions - expectedTotalDeductions) < 1) {
      console.log('✅ Total Deductions calculation: CORRECT');
    } else {
      console.log(`❌ Total Deductions calculation: WRONG`);
      console.log(`   Expected: Rs. ${expectedTotalDeductions.toFixed(2)}, Got: Rs. ${payroll.totalDeductions?.toFixed(2) || 0}`);
    }
    
    // Check Net Salary
    const expectedNetSalary = expectedTotalEarnings - expectedTotalDeductions;
    if (Math.abs(payroll.netSalary - expectedNetSalary) < 1) {
      console.log('✅ Net Salary calculation: CORRECT');
    } else {
      console.log(`❌ Net Salary calculation: WRONG`);
      console.log(`   Expected: Rs. ${expectedNetSalary.toFixed(2)}, Got: Rs. ${payroll.netSalary?.toFixed(2) || 0}`);
    }
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    const allCorrect = (
      Math.abs(payroll.grossSalary - expectedGrossSalary) < 1 &&
      Math.abs(payroll.totalEarnings - expectedTotalEarnings) < 1 &&
      Math.abs(payroll.dailyRate - expectedDailyRate) < 1 &&
      Math.abs(payroll.attendanceDeduction - expectedAttendanceDeduction) < 1 &&
      Math.abs(payroll.totalDeductions - expectedTotalDeductions) < 1 &&
      Math.abs(payroll.netSalary - expectedNetSalary) < 1
    );
    
    if (allCorrect) {
      console.log('✅ ALL CALCULATIONS ARE CORRECT!');
    } else {
      console.log('❌ SOME CALCULATIONS ARE INCORRECT - Check the details above');
    }
    
  } catch (error) {
    console.error('❌ Error during payroll calculation test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testPayrollCalculations()
    .then(() => {
      console.log('🎯 Payroll calculation test completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Payroll calculation test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPayrollCalculations };
