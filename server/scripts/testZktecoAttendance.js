const zktecoService = require('../services/zktecoService');

async function testZktecoAttendance() {
  console.log('🔍 Testing ZKTeco attendance from splaza.nayatel.net...\n');
  
  try {
    // Connect to device
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');
    
    // Get attendance data
    console.log('\n📊 Getting attendance data...');
    const attendance = await zktecoService.getAttendanceData();
    
    console.log('\n📋 Attendance response structure:');
    console.log('Success:', attendance.success);
    console.log('Count:', attendance.count);
    console.log('Data type:', typeof attendance.data);
    console.log('Is array:', Array.isArray(attendance.data));
    console.log('Data length:', attendance.data ? attendance.data.length : 0);
    
    if (attendance.data && attendance.data.length > 0) {
      console.log('\n👤 First attendance record (raw):');
      console.log(JSON.stringify(attendance.data[0], null, 2));
      
      console.log('\n🔍 First attendance record properties:');
      const firstRecord = attendance.data[0];
      Object.keys(firstRecord).forEach(key => {
        console.log(`  ${key}: ${typeof firstRecord[key]} = ${JSON.stringify(firstRecord[key])}`);
      });
      
      console.log('\n📊 First 5 attendance records (summary):');
      attendance.data.slice(0, 5).forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        console.log(`  User ID: ${record.deviceUserId || record.userId || record.uid || 'N/A'}`);
        console.log(`  Record Time: ${record.recordTime || record.timestamp || 'N/A'}`);
        console.log(`  Serial No: ${record.userSn || 'N/A'}`);
        console.log(`  IP: ${record.ip || 'N/A'}`);
      });
      
      // Save raw data to file
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `zkteco_raw_attendance_${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify(attendance.data, null, 2));
      console.log(`\n💾 Raw attendance data saved to ${filename}`);
      
      // Count unique users
      const uniqueUsers = new Set();
      attendance.data.forEach(record => {
        const userId = record.deviceUserId || record.userId || record.uid;
        if (userId) {
          uniqueUsers.add(userId);
        }
      });
      
      console.log(`\n👥 Unique users in attendance: ${uniqueUsers.size}`);
      console.log('Sample user IDs:', Array.from(uniqueUsers).slice(0, 10));
      
    } else {
      console.log('❌ No attendance data found');
    }
    
    // Disconnect
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Try to disconnect if connected
    try {
      await zktecoService.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

// Run the test
testZktecoAttendance(); 