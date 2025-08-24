const mongoose = require('mongoose');

// Register models
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Employee');
require('./models/hr/Attendance');

async function testAttendance26DayUpdate() {
  try {
    console.log('🧪 Testing 26-Day Attendance System in Attendance Updates');
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
    
    // Find or create a test attendance record
    let attendance = await Attendance.findOne({ 
      employee: employee._id,
      date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    if (!attendance) {
      console.log('📝 Creating test attendance record...');
      attendance = new Attendance({
        employee: employee._id,
        date: new Date(),
        status: 'Present',
        checkIn: {
          time: new Date(),
          location: 'Office',
          method: 'Manual'
        },
        createdBy: employee._id
      });
      await attendance.save();
      console.log('✅ Test attendance record created');
    } else {
      console.log('✅ Found existing attendance record');
    }
    
    console.log('---');
    console.log('📊 Current Attendance Status:', attendance.status);
    console.log('Daily Rate:', attendance.dailyRate || 'Not set');
    console.log('Attendance Deduction:', attendance.attendanceDeduction || 'Not set');
    
    console.log('---');
    console.log('🔄 Testing Status Update to Absent...');
    
    // Update status to Absent to trigger 26-day calculation
    attendance.status = 'Absent';
    attendance.checkIn.time = null;
    attendance.checkOut.time = null;
    
    await attendance.save();
    console.log('✅ Attendance updated to Absent');
    
    // Fetch the updated record
    const updatedAttendance = await Attendance.findById(attendance._id);
    
    console.log('---');
    console.log('📊 Updated Attendance Details:');
    console.log('Status:', updatedAttendance.status);
    console.log('Daily Rate:', updatedAttendance.dailyRate?.toFixed(2) || 'Not calculated');
    console.log('Attendance Deduction:', updatedAttendance.attendanceDeduction?.toFixed(2) || 'Not calculated');
    
    if (updatedAttendance.dailyRate && updatedAttendance.attendanceDeduction) {
      console.log('✅ 26-Day System Working!');
      console.log('💰 Daily Rate: Rs.', updatedAttendance.dailyRate.toFixed(2));
      console.log('💰 Deduction: Rs.', updatedAttendance.attendanceDeduction.toFixed(2));
    } else {
      console.log('❌ 26-Day System Not Working');
    }
    
    console.log('---');
    console.log('🔄 Testing Status Update back to Present...');
    
    // Update status back to Present
    updatedAttendance.status = 'Present';
    updatedAttendance.checkIn.time = new Date();
    
    await updatedAttendance.save();
    
    const finalAttendance = await Attendance.findById(attendance._id);
    console.log('✅ Attendance updated to Present');
    console.log('📊 Final Status:', finalAttendance.status);
    console.log('Daily Rate:', finalAttendance.dailyRate || 'Reset');
    console.log('Attendance Deduction:', finalAttendance.attendanceDeduction || 'Reset');
    
    console.log('---');
    console.log('✅ 26-Day Attendance Update Test Complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testAttendance26DayUpdate();
