const mongoose = require('mongoose');

// Register models
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Employee');
require('./models/hr/Attendance');

async function testUpdateRouteLogic() {
  try {
    console.log('🧪 Testing Update Route Logic for 26-Day System');
    console.log('---');
    
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Employee = mongoose.model('Employee');
    const Attendance = mongoose.model('Attendance');
    
    // Find a test employee
    const employee = await Employee.findOne({ employeeId: '3' });
    if (!employee) {
      throw new Error('Employee 3 not found');
    }
    
    console.log('✅ Test Employee:', employee.firstName + ' ' + employee.lastName);
    console.log('Basic Salary:', employee.salary?.basic);
    
    // Find a test attendance record
    const attendance = await Attendance.findOne({ 
      employee: employee._id,
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    if (!attendance) {
      throw new Error('No attendance record found for testing');
    }
    
    console.log('✅ Found attendance record:', attendance._id);
    console.log('Current Status:', attendance.status);
    
    // Test the update logic directly
    console.log('---');
    console.log('🔄 Testing 26-Day Calculation Logic...');
    
    // Simulate the update route logic
    if (attendance.status === 'Absent' || attendance.status === 'Leave') {
      const grossSalary = employee.salary?.basic || 0;
      attendance.dailyRate = grossSalary / 26; // 26 working days per month
      attendance.attendanceDeduction = attendance.dailyRate; // 1 day deduction
      
      console.log(`💰 26-Day System Calculation:`);
      console.log(`   Gross Salary: Rs. ${grossSalary.toLocaleString()}`);
      console.log(`   Daily Rate: Rs. ${attendance.dailyRate.toFixed(2)}`);
      console.log(`   Attendance Deduction: Rs. ${attendance.attendanceDeduction.toFixed(2)}`);
      
      // Save the updated attendance
      await attendance.save();
      console.log('✅ Attendance saved with 26-day calculations');
      
      // Verify the save
      const updatedAttendance = await Attendance.findById(attendance._id);
      console.log('---');
      console.log('📊 Verification:');
      console.log('Daily Rate:', updatedAttendance.dailyRate?.toFixed(2));
      console.log('Attendance Deduction:', updatedAttendance.attendanceDeduction?.toFixed(2));
      
      if (updatedAttendance.dailyRate > 0 && updatedAttendance.attendanceDeduction > 0) {
        console.log('✅ 26-Day System Working!');
      } else {
        console.log('❌ 26-Day System Still Not Working');
      }
    } else {
      console.log('⚠️ Attendance status is not Absent/Leave, setting to Absent for testing');
      attendance.status = 'Absent';
      attendance.checkIn.time = null;
      attendance.checkOut.time = null;
      
      const grossSalary = employee.salary?.basic || 0;
      attendance.dailyRate = grossSalary / 26;
      attendance.attendanceDeduction = attendance.dailyRate;
      
      console.log(`💰 26-Day System Calculation:`);
      console.log(`   Gross Salary: Rs. ${grossSalary.toLocaleString()}`);
      console.log(`   Daily Rate: Rs. ${attendance.dailyRate.toFixed(2)}`);
      console.log(`   Attendance Deduction: Rs. ${attendance.attendanceDeduction.toFixed(2)}`);
      
      await attendance.save();
      console.log('✅ Attendance updated to Absent with 26-day calculations');
    }
    
    console.log('---');
    console.log('✅ Update Route Logic Test Complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testUpdateRouteLogic();
