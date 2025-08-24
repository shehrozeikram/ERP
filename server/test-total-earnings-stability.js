const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const testTotalEarningsStability = async () => {
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
    
    // Create a test payroll with initial values
    const currentDate = new Date();
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    console.log(`📅 Creating test payroll for ${month + 1}/${year}`);
    
    // Initial test payroll data
    const initialPayrollData = {
      employee: employee._id,
      month: month + 1,
      year: year,
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
      presentDays: 26, // Initially 26 present days (0 absent)
      absentDays: 0,
      leaveDays: 0,
      incomeTax: 27180,
      eobi: 370,
      healthInsurance: 0,
      otherDeductions: 0,
      createdBy: employee._id
    };
    
    console.log('\n🧪 Creating initial payroll with 0 absent days...');
    console.log('Expected Total Earnings: Rs. 415,000 (380,000 + 35,000)');
    
    // Create the payroll
    const payroll = new Payroll(initialPayrollData);
    await payroll.save();
    
    console.log('\n✅ Initial payroll created successfully');
    console.log(`📊 Payroll ID: ${payroll._id}`);
    console.log(`💰 Initial Total Earnings: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    console.log(`📅 Initial Present Days: ${payroll.presentDays}, Absent Days: ${payroll.absentDays}`);
    
    // Store the initial Total Earnings
    const initialTotalEarnings = payroll.totalEarnings;
    
    // Test 1: Update ONLY attendance info (should NOT change Total Earnings)
    console.log('\n🧪 TEST 1: Updating ONLY attendance info...');
    console.log('   Changing present days from 26 to 22 (4 absent days)');
    console.log('   Expected: Total Earnings should remain Rs. 415,000');
    
    payroll.presentDays = 22; // 4 absent days
    payroll.absentDays = 4;
    
    await payroll.save();
    
    console.log(`   Result: Total Earnings = Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    
    if (Math.abs(payroll.totalEarnings - initialTotalEarnings) < 1) {
      console.log('✅ SUCCESS: Total Earnings remained unchanged when only attendance was updated');
    } else {
      console.log('❌ FAILED: Total Earnings changed when it should have remained the same');
      console.log(`   Initial: Rs. ${initialTotalEarnings?.toLocaleString() || 0}`);
      console.log(`   After: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    }
    
    // Test 2: Update salary structure (SHOULD change Total Earnings)
    console.log('\n🧪 TEST 2: Updating salary structure...');
    console.log('   Adding overtime amount of Rs. 10,000');
    console.log('   Expected: Total Earnings should increase to Rs. 425,000');
    
    const totalEarningsBeforeOvertime = payroll.totalEarnings;
    payroll.overtimeAmount = 10000;
    
    await payroll.save();
    
    console.log(`   Result: Total Earnings = Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    
    if (payroll.totalEarnings > totalEarningsBeforeOvertime) {
      console.log('✅ SUCCESS: Total Earnings increased when salary structure was updated');
      console.log(`   Before: Rs. ${totalEarningsBeforeOvertime?.toLocaleString() || 0}`);
      console.log(`   After: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    } else {
      console.log('❌ FAILED: Total Earnings did not change when salary structure was updated');
    }
    
    // Test 3: Update attendance again (should NOT change Total Earnings)
    console.log('\n🧪 TEST 3: Updating attendance again...');
    console.log('   Changing present days from 22 to 20 (6 absent days)');
    console.log('   Expected: Total Earnings should remain unchanged');
    
    const totalEarningsBeforeAttendance = payroll.totalEarnings;
    payroll.presentDays = 20; // 6 absent days
    payroll.absentDays = 6;
    
    await payroll.save();
    
    console.log(`   Result: Total Earnings = Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    
    if (Math.abs(payroll.totalEarnings - totalEarningsBeforeAttendance) < 1) {
      console.log('✅ SUCCESS: Total Earnings remained unchanged when only attendance was updated');
    } else {
      console.log('❌ FAILED: Total Earnings changed when it should have remained the same');
      console.log(`   Before: Rs. ${totalEarningsBeforeAttendance?.toLocaleString() || 0}`);
      console.log(`   After: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    }
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    console.log(`   Initial Total Earnings: Rs. ${initialTotalEarnings?.toLocaleString() || 0}`);
    console.log(`   Final Total Earnings: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    console.log(`   Attendance Changes: 0 → 4 → 6 absent days`);
    console.log(`   Salary Changes: Added Rs. 10,000 overtime`);
    
    // Verify the final calculations
    const expectedFinalTotalEarnings = 380000 + 35000 + 10000; // Gross + Vehicle Allowance + Overtime
    
    if (Math.abs(payroll.totalEarnings - expectedFinalTotalEarnings) < 1) {
      console.log('✅ FINAL VERIFICATION: Total Earnings calculation is correct');
      console.log(`   Expected: Rs. ${expectedFinalTotalEarnings.toLocaleString()}`);
      console.log(`   Actual: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    } else {
      console.log('❌ FINAL VERIFICATION: Total Earnings calculation is incorrect');
      console.log(`   Expected: Rs. ${expectedFinalTotalEarnings.toLocaleString()}`);
      console.log(`   Actual: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    }
    
    // Clean up - delete the test payroll
    console.log('\n🧹 Cleaning up test payroll...');
    await Payroll.findByIdAndDelete(payroll._id);
    console.log('✅ Test payroll deleted');
    
  } catch (error) {
    console.error('❌ Error during Total Earnings stability test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testTotalEarningsStability()
    .then(() => {
      console.log('🎯 Total Earnings stability test completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Total Earnings stability test failed:', error);
      process.exit(1);
    });
}

module.exports = { testTotalEarningsStability };
