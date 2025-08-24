const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const testAutomaticAbsentCalculation = async () => {
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
    
    // Create a test payroll for current month
    const currentDate = new Date();
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    console.log(`📅 Testing payroll for ${month + 1}/${year}`);
    
    // Check if payroll already exists
    let payroll = await Payroll.findOne({
      employee: employee._id,
      month: month + 1,
      year: year
    });
    
    if (payroll) {
      console.log('📊 Existing payroll found, testing automatic absent calculation...');
      
      // Show current values
      console.log('\n📊 Current Payroll Values:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      
      // Test 1: Update present days to 24 (should auto-calculate absent days to 2)
      console.log('\n🧪 Test 1: Update present days to 24 (26 total working days)');
      console.log('Expected: Absent days should automatically calculate to 2');
      
      payroll.totalWorkingDays = 26;
      payroll.presentDays = 24;
      payroll.leaveDays = 0;
      
      // Force recalculation
      payroll.dailyRate = undefined;
      payroll.attendanceDeduction = undefined;
      
      await payroll.save();
      
      console.log('✅ Test 1 Results:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      
      if (payroll.absentDays === 2) {
        console.log('✅ Test 1 PASSED: Absent days correctly calculated to 2');
      } else {
        console.log('❌ Test 1 FAILED: Absent days should be 2, but got', payroll.absentDays);
      }
      
      // Test 2: Update present days to 22 with 2 leave days (should auto-calculate absent days to 2)
      console.log('\n🧪 Test 2: Update present days to 22 with 2 leave days (26 total working days)');
      console.log('Expected: Absent days should automatically calculate to 2 (26 - 22 - 2 = 2)');
      
      payroll.presentDays = 22;
      payroll.leaveDays = 2;
      
      // Force recalculation
      payroll.dailyRate = undefined;
      payroll.attendanceDeduction = undefined;
      
      await payroll.save();
      
      console.log('✅ Test 2 Results:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      
      if (payroll.absentDays === 2) {
        console.log('✅ Test 2 PASSED: Absent days correctly calculated to 2');
      } else {
        console.log('❌ Test 2 FAILED: Absent days should be 2, but got', payroll.absentDays);
      }
      
      // Test 3: Update present days to 20 with 1 leave day (should auto-calculate absent days to 5)
      console.log('\n🧪 Test 3: Update present days to 20 with 1 leave day (26 total working days)');
      console.log('Expected: Absent days should automatically calculate to 5 (26 - 20 - 1 = 5)');
      
      payroll.presentDays = 20;
      payroll.leaveDays = 1;
      
      // Force recalculation
      payroll.dailyRate = undefined;
      payroll.attendanceDeduction = undefined;
      
      await payroll.save();
      
      console.log('✅ Test 3 Results:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      
      if (payroll.absentDays === 5) {
        console.log('✅ Test 3 PASSED: Absent days correctly calculated to 5');
      } else {
        console.log('❌ Test 3 FAILED: Absent days should be 5, but got', payroll.absentDays);
      }
      
      // Test 4: Edge case - present days equal to total working days (should auto-calculate absent days to 0)
      console.log('\n🧪 Test 4: Edge case - present days equal to total working days (26 present, 0 leave)');
      console.log('Expected: Absent days should automatically calculate to 0 (26 - 26 - 0 = 0)');
      
      payroll.presentDays = 26;
      payroll.leaveDays = 0;
      
      // Force recalculation
      payroll.dailyRate = undefined;
      payroll.attendanceDeduction = undefined;
      
      await payroll.save();
      
      console.log('✅ Test 4 Results:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      
      if (payroll.absentDays === 0) {
        console.log('✅ Test 4 PASSED: Absent days correctly calculated to 0');
      } else {
        console.log('❌ Test 4 FAILED: Absent days should be 0, but got', payroll.absentDays);
      }
      
    } else {
      console.log('📝 Creating new test payroll...');
      
      // Create new payroll with automatic absent calculation
      const payrollData = {
        employee: employee._id,
        month: month + 1,
        year: year,
        basicSalary: employee.salary?.basic || 50000,
        totalWorkingDays: 26,
        presentDays: 24,
        leaveDays: 0,
        createdBy: employee._id
        // Note: absentDays will be calculated automatically
      };
      
      payroll = new Payroll(payrollData);
      await payroll.save();
      
      console.log('✅ New payroll created successfully');
      
      // Show values
      console.log('\n📊 New Payroll Values:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      
      if (payroll.absentDays === 2) {
        console.log('✅ Automatic absent calculation working: 26 - 24 - 0 = 2 absent days');
      } else {
        console.log('❌ Automatic absent calculation failed');
      }
    }
    
    // Final summary
    console.log('\n🎯 AUTOMATIC ABSENT DAYS CALCULATION SUMMARY:');
    console.log('✅ Formula: Absent Days = Total Working Days - Present Days - Leave Days');
    console.log('✅ Benefits:');
    console.log('   - No more manual absent days entry needed');
    console.log('   - Eliminates calculation errors');
    console.log('   - Prevents conflicts with auto-update service');
    console.log('   - More reliable and consistent');
    
  } catch (error) {
    console.error('❌ Error during automatic absent calculation test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testAutomaticAbsentCalculation()
    .then(() => {
      console.log('🎯 Automatic absent calculation test completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Automatic absent calculation test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAutomaticAbsentCalculation };
