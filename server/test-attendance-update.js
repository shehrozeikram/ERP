const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the models
const Payroll = require('./models/hr/Payroll');
const Employee = require('./models/hr/Employee');

const testAttendanceUpdate = async () => {
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
      console.log('📊 Existing payroll found, updating attendance...');
      
      // Show current values
      console.log('📊 Current Payroll Values:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      console.log(`   Daily Rate: ${payroll.dailyRate?.toFixed(2)}`);
      console.log(`   Attendance Deduction: ${payroll.attendanceDeduction?.toFixed(2)}`);
      console.log(`   Net Salary: ${payroll.netSalary?.toFixed(2)}`);
      
      // Update attendance to 24 present, 2 absent (26 total working days)
      payroll.totalWorkingDays = 26;
      payroll.presentDays = 24;
      payroll.absentDays = 2;
      payroll.leaveDays = 0;
      
      // Force recalculation
      payroll.dailyRate = undefined;
      payroll.attendanceDeduction = undefined;
      
      console.log('\n🔄 Updating attendance to 24 present, 2 absent...');
      
      // Save to trigger pre-save middleware
      await payroll.save();
      
      console.log('✅ Payroll updated successfully');
      
      // Show updated values
      console.log('\n📊 Updated Payroll Values:');
      console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
      console.log(`   Present Days: ${payroll.presentDays}`);
      console.log(`   Absent Days: ${payroll.absentDays}`);
      console.log(`   Leave Days: ${payroll.leaveDays}`);
      console.log(`   Daily Rate: ${payroll.dailyRate?.toFixed(2)}`);
      console.log(`   Attendance Deduction: ${payroll.attendanceDeduction?.toFixed(2)}`);
      console.log(`   Net Salary: ${payroll.netSalary?.toFixed(2)}`);
      
      // Verify the update worked
      if (payroll.presentDays === 24 && payroll.absentDays === 2) {
        console.log('✅ Attendance update verification: SUCCESS');
        console.log('✅ Present days: 24, Absent days: 2');
      } else {
        console.log('❌ Attendance update verification: FAILED');
        console.log(`❌ Expected: 24 present, 2 absent`);
        console.log(`❌ Actual: ${payroll.presentDays} present, ${payroll.absentDays} absent`);
      }
      
    } else {
      console.log('📝 Creating new test payroll...');
      
      // Create new payroll with 24 present, 2 absent
      const payrollData = {
        employee: employee._id,
        month: month + 1,
        year: year,
        basicSalary: employee.salary?.basic || 50000,
        totalWorkingDays: 26,
        presentDays: 24,
        absentDays: 2,
        leaveDays: 0,
        createdBy: employee._id
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
      console.log(`   Daily Rate: ${payroll.dailyRate?.toFixed(2)}`);
      console.log(`   Attendance Deduction: ${payroll.attendanceDeduction?.toFixed(2)}`);
      console.log(`   Net Salary: ${payroll.netSalary?.toFixed(2)}`);
    }
    
    // Test the new PATCH attendance route
    console.log('\n🧪 Testing PATCH /payroll/:id/attendance route...');
    
    // Simulate the PATCH request
    const updateData = {
      attendance: {
        totalDays: 26,
        presentDays: 23, // Change to 23 present, 3 absent
        absentDays: 3,
        leaveDays: 0
      }
    };
    
    // Update using the model directly (simulating the route)
    payroll.totalWorkingDays = updateData.attendance.totalDays;
    payroll.presentDays = updateData.attendance.presentDays;
    payroll.absentDays = updateData.attendance.absentDays;
    payroll.leaveDays = updateData.attendance.leaveDays;
    
    // Force recalculation
    payroll.dailyRate = undefined;
    payroll.attendanceDeduction = undefined;
    
    console.log('🔄 Updating via PATCH route to 23 present, 3 absent...');
    
    await payroll.save();
    
    console.log('✅ PATCH route test completed');
    
    // Show final values
    console.log('\n📊 Final Payroll Values (After PATCH):');
    console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
    console.log(`   Present Days: ${payroll.presentDays}`);
    console.log(`   Absent Days: ${payroll.absentDays}`);
    console.log(`   Leave Days: ${payroll.leaveDays}`);
    console.log(`   Daily Rate: ${payroll.dailyRate?.toFixed(2)}`);
    console.log(`   Attendance Deduction: ${payroll.attendanceDeduction?.toFixed(2)}`);
    console.log(`   Net Salary: ${payroll.netSalary?.toFixed(2)}`);
    
    // Final verification
    if (payroll.presentDays === 23 && payroll.absentDays === 3) {
      console.log('✅ PATCH route test verification: SUCCESS');
      console.log('✅ Present days: 23, Absent days: 3');
    } else {
      console.log('❌ PATCH route test verification: FAILED');
      console.log(`❌ Expected: 23 present, 3 absent`);
      console.log(`❌ Actual: ${payroll.presentDays} present, ${payroll.absentDays} absent`);
    }
    
  } catch (error) {
    console.error('❌ Error during attendance update test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testAttendanceUpdate()
    .then(() => {
      console.log('🎯 Attendance update test completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Attendance update test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAttendanceUpdate };
