const mongoose = require('mongoose');
require('../services/zkbioTimeDatabaseService');
require('dotenv').config();

async function checkAllZKBioRecords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const ZKBioTimeAttendance = mongoose.model('ZKBioTimeAttendance');
    
    // Get all records for employee 6035
    const records = await ZKBioTimeAttendance.find({
      empCode: '6035'
    }).sort({ date: 1, punchTime: 1 });
    
    console.log('All ZKBio attendance records for employee 6035:');
    console.log('Total records:', records.length);
    
    if (records.length > 0) {
      console.log('Date range:', records[0].date, 'to', records[records.length-1].date);
      
      // Group by date
      const dateGroups = {};
      records.forEach(r => {
        if (!dateGroups[r.date]) {
          dateGroups[r.date] = [];
        }
        dateGroups[r.date].push(r.punchState);
      });
      
      console.log('Unique dates:', Object.keys(dateGroups).length);
      console.log('Sample dates:', Object.keys(dateGroups).slice(0, 5));
      
      // Show some sample records
      console.log('\nSample records:');
      records.slice(0, 10).forEach(r => {
        console.log(`${r.date} ${r.punchTime} - ${r.punchState}`);
      });
    }
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllZKBioRecords();
