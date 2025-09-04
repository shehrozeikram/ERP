const mongoose = require('mongoose');
require('./server/models/hr/Attendance');
require('dotenv').config();

const analyzeAttendance = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const startDate = new Date(2025, 7, 1);
    const endDate = new Date(2025, 8, 0, 23, 59, 59, 999);
    
    // Get all records (including inactive)
    const allRecords = await mongoose.model('Attendance').find({
      employee: '68931fa2e82767d5e239516d',
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    console.log(`\n📊 Total records found: ${allRecords.length}`);
    
    // Group by date
    const recordsByDate = {};
    allRecords.forEach(record => {
      const dateStr = record.date.toDateString();
      if (!recordsByDate[dateStr]) {
        recordsByDate[dateStr] = [];
      }
      recordsByDate[dateStr].push({
        id: record._id,
        status: record.status,
        isActive: record.isActive,
        checkIn: !!record.checkIn?.time,
        checkOut: !!record.checkOut?.time,
        checkInTime: record.checkIn?.time,
        checkOutTime: record.checkOut?.time
      });
    });
    
    console.log('\n📅 Records by date:');
    Object.entries(recordsByDate).forEach(([date, dayRecords]) => {
      console.log(`\n${date}: ${dayRecords.length} records`);
      dayRecords.forEach((r, i) => {
        console.log(`  ${i+1}. Status: '${r.status}' (Active: ${r.isActive})`);
        console.log(`     CheckIn: ${r.checkIn} ${r.checkInTime ? `(${r.checkInTime.toTimeString()})` : ''}`);
        console.log(`     CheckOut: ${r.checkOut} ${r.checkOutTime ? `(${r.checkOutTime.toTimeString()})` : ''}`);
      });
    });
    
    // Count active records only
    const activeRecords = allRecords.filter(r => r.isActive);
    console.log(`\n📊 Active records: ${activeRecords.length}`);
    
    // Status breakdown for active records
    const statusCount = {};
    activeRecords.forEach(record => {
      statusCount[record.status] = (statusCount[record.status] || 0) + 1;
    });
    
    console.log('\n📈 Status breakdown (active records only):');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} records`);
    });
    
    // Calculate working days in August 2025
    const workingDaysInAugust = calculateWorkingDaysInMonth(2025, 7);
    console.log(`\n📅 Working days in August 2025: ${workingDaysInAugust} (excluding Sundays)`);
    
    // Show which dates should have attendance
    console.log('\n📋 Expected attendance dates in August 2025:');
    for (let day = 1; day <= 31; day++) {
      const date = new Date(2025, 7, day);
      if (date.getDay() !== 0) { // Not Sunday
        console.log(`  ${date.toDateString()}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

const calculateWorkingDaysInMonth = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek !== 0) { // 0 = Sunday
      workingDays++;
    }
  }
  
  return workingDays;
};

analyzeAttendance();
