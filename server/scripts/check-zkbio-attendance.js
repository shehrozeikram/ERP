const mongoose = require('mongoose');
require('../services/zkbioTimeDatabaseService');
require('dotenv').config();

async function checkZKBioAttendance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const ZKBioTimeAttendance = mongoose.model('ZKBioTimeAttendance');
    
    // Get August 2025 records for employee 6035
    const records = await ZKBioTimeAttendance.find({
      empCode: '6035',
      date: { $regex: '^2025-08' }
    }).sort({ date: 1, punchTime: 1 });
    
    console.log('ZKBio attendance records for employee 6035 in August 2025:');
    console.log('Total records:', records.length);
    
    // Group by date
    const dateGroups = {};
    records.forEach(r => {
      if (!dateGroups[r.date]) {
        dateGroups[r.date] = [];
      }
      dateGroups[r.date].push({
        punchTime: r.punchTime,
        punchState: r.punchState
      });
    });
    
    console.log('\nRecords by date:');
    Object.entries(dateGroups).forEach(([date, punches]) => {
      console.log(`${date}: ${punches.length} punches`);
      punches.forEach(p => {
        console.log(`  ${p.punchTime} - ${p.punchState}`);
      });
    });
    
    // Count unique dates
    const uniqueDates = Object.keys(dateGroups);
    console.log('\nUnique dates with records:', uniqueDates.length);
    
    // Calculate working days in August 2025
    let workingDays = 0;
    for (let day = 1; day <= 31; day++) {
      const date = new Date(2025, 7, day);
      if (date.getDay() !== 0) { // Not Sunday
        workingDays++;
      }
    }
    console.log('Working days in August 2025:', workingDays);
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkZKBioAttendance();
