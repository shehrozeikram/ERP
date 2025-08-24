const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');
const User = require('./models/User'); // Add User model import

const testPayrollFetchAfterAttendance = async () => {
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
    
    // Use a different month to avoid conflicts
    const testMonth = month === 11 ? 1 : month + 2; // Use next month or January if December
    const testYear = month === 11 ? year + 1 : year;
    
    console.log(`📅 Creating test payroll for ${testMonth}/${testYear}`);
    
    // Initial test payroll data
    const initialPayrollData = {
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
    
    // Test 1: Update attendance info
    console.log('\n🧪 TEST 1: Updating attendance info...');
    console.log('   Changing present days from 26 to 22 (4 absent days)');
    
    payroll.presentDays = 22; // 4 absent days
    payroll.absentDays = 4;
    
    await payroll.save();
    
    console.log(`   Result after save: Total Earnings = Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
    
    // Test 2: Fetch the payroll again (simulating what happens in the frontend)
    console.log('\n🧪 TEST 2: Fetching payroll after attendance update...');
    
    const fetchedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department position salary')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');
    
    if (!fetchedPayroll) {
      console.log('❌ Failed to fetch payroll after update');
      return;
    }
    
    console.log(`   Fetched payroll Total Earnings: Rs. ${fetchedPayroll.totalEarnings?.toLocaleString() || 0}`);
    console.log(`   Fetched payroll Present Days: ${fetchedPayroll.presentDays}, Absent Days: ${fetchedPayroll.absentDays}`);
    
    // Test 3: Call calculateAttendanceDeduction (what the GET route does)
    console.log('\n🧪 TEST 3: Calling calculateAttendanceDeduction...');
    
    fetchedPayroll.calculateAttendanceDeduction();
    
    console.log(`   After calculateAttendanceDeduction: Total Earnings = Rs. ${fetchedPayroll.totalEarnings?.toLocaleString() || 0}`);
    console.log(`   Attendance Deduction: Rs. ${fetchedPayroll.attendanceDeduction?.toLocaleString() || 0}`);
    
    // Test 4: Check if totalEarnings was modified
    if (Math.abs(fetchedPayroll.totalEarnings - initialTotalEarnings) < 1) {
      console.log('✅ SUCCESS: Total Earnings remained unchanged after attendance update and fetch');
    } else {
      console.log('❌ FAILED: Total Earnings changed after attendance update and fetch');
      console.log(`   Initial: Rs. ${initialTotalEarnings?.toLocaleString() || 0}`);
      console.log(`   After fetch: Rs. ${fetchedPayroll.totalEarnings?.toLocaleString() || 0}`);
    }
    
    // Test 5: Simulate the exact GET route logic
    console.log('\n🧪 TEST 4: Simulating exact GET route logic...');
    
    const routePayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department position salary')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');
    
    if (routePayroll) {
      // 🔧 CALCULATE ATTENDANCE DEDUCTION FOR DISPLAY (exact code from route)
      routePayroll.calculateAttendanceDeduction();
      
      console.log(`   After route logic: Total Earnings = Rs. ${routePayroll.totalEarnings?.toLocaleString() || 0}`);
      console.log(`   Attendance Deduction: Rs. ${routePayroll.attendanceDeduction?.toLocaleString() || 0}`);
      
      // Check if totalEarnings was modified by the route logic
      if (Math.abs(routePayroll.totalEarnings - initialTotalEarnings) < 1) {
        console.log('✅ SUCCESS: Total Earnings remained unchanged after route logic');
      } else {
        console.log('❌ FAILED: Total Earnings changed after route logic');
        console.log(`   Initial: Rs. ${initialTotalEarnings?.toLocaleString() || 0}`);
        console.log(`   After route: Rs. ${routePayroll.totalEarnings?.toLocaleString() || 0}`);
      }
    }
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    console.log(`   Initial Total Earnings: Rs. ${initialTotalEarnings?.toLocaleString() || 0}`);
    console.log(`   Final Total Earnings: Rs. ${fetchedPayroll.totalEarnings?.toLocaleString() || 0}`);
    console.log(`   Attendance Changes: 0 → 4 absent days`);
    console.log(`   Expected: Total Earnings should remain Rs. 415,000`);
    
    // Clean up - delete the test payroll
    console.log('\n🧹 Cleaning up test payroll...');
    await Payroll.findByIdAndDelete(payroll._id);
    console.log('✅ Test payroll deleted');
    
  } catch (error) {
    console.error('❌ Error during payroll fetch test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testPayrollFetchAfterAttendance()
    .then(() => {
      console.log('🎯 Payroll fetch after attendance test completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Payroll fetch after attendance test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPayrollFetchAfterAttendance };
