const mongoose = require('mongoose');
require('../models/hr/Attendance');
require('dotenv').config();

async function analyze() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const startDate = new Date(2025, 7, 1);
    const endDate = new Date(2025, 8, 0, 23, 59, 59, 999);
    
    const allRecords = await mongoose.model('Attendance').find({
      employee: '68931fa2e82767d5e239516d',
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    console.log('Total records found:', allRecords.length);
    
    const activeCount = allRecords.filter(r => r.isActive).length;
    console.log('Active records:', activeCount);
    console.log('Inactive records:', allRecords.length - activeCount);
    
    const activeRecords = allRecords.filter(r => r.isActive);
    
    console.log('\nActive records by date:');
    const dateGroups = {};
    activeRecords.forEach(r => {
      const dateStr = r.date.toDateString();
      if (!dateGroups[dateStr]) {
        dateGroups[dateStr] = [];
      }
      dateGroups[dateStr].push(r.status);
    });
    
    Object.entries(dateGroups).forEach(([date, statuses]) => {
      console.log(date + ': ' + statuses.length + ' records - ' + statuses.join(', '));
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

analyze();
