const mongoose = require('mongoose');

// Register models
require('./models/hr/Attendance');

async function verifyAttendanceSave() {
  try {
    console.log('🔍 Verifying Attendance Save with 26-Day Calculations');
    console.log('---');
    
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const Attendance = mongoose.model('Attendance');
    
    // Find the attendance record we just updated
    const attendance = await Attendance.findById('68aa241c8f0f6e1ff1cc7f9c');
    
    if (!attendance) {
      throw new Error('Attendance record not found');
    }
    
    console.log('✅ Found Attendance Record:');
    console.log('ID:', attendance._id);
    console.log('Status:', attendance.status);
    console.log('Date:', attendance.date);
    console.log('---');
    console.log('📊 26-Day System Fields:');
    console.log('Daily Rate:', attendance.dailyRate?.toFixed(2) || 'Not set');
    console.log('Attendance Deduction:', attendance.attendanceDeduction?.toFixed(2) || 'Not set');
    console.log('Total Working Days:', attendance.totalWorkingDays || 'Not set');
    
    if (attendance.dailyRate > 0 && attendance.attendanceDeduction > 0) {
      console.log('---');
      console.log('✅ 26-Day System Successfully Implemented!');
      console.log('💰 Daily Rate: Rs.', attendance.dailyRate.toFixed(2));
      console.log('💰 Deduction: Rs.', attendance.attendanceDeduction.toFixed(2));
      console.log('📅 Working Days: 26 (excluding Sundays)');
    } else {
      console.log('---');
      console.log('❌ 26-Day System Not Working');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the verification
verifyAttendanceSave();
