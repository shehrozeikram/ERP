const zktecoService = require('../services/zktecoService');

async function testZktecoUsers() {
  console.log('🔍 Testing ZKTeco users retrieval from splaza.nayatel.net...\n');
  
  try {
    // Connect to device
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');
    
    // Try standard method first
    console.log('\n📋 Trying standard getUsers() method...');
    try {
      const standardUsers = await zktecoService.getUsers();
      console.log(`Standard method result: ${standardUsers.count} users`);
      if (standardUsers.count > 0) {
        console.log('Sample user:', JSON.stringify(standardUsers.data[0], null, 2));
      }
    } catch (error) {
      console.log(`Standard method failed: ${error.message}`);
    }
    
    // Try attendance-based method
    console.log('\n📊 Trying getUsersFromAttendance() method...');
    try {
      const attendanceUsers = await zktecoService.getUsersFromAttendance();
      console.log(`Attendance method result: ${attendanceUsers.count} users`);
      
      if (attendanceUsers.count > 0) {
        console.log('\n👥 Sample users from attendance data:');
        attendanceUsers.data.slice(0, 5).forEach((user, index) => {
          console.log(`\nUser ${index + 1}:`);
          console.log(`  ID: ${user.uid}`);
          console.log(`  Name: ${user.name}`);
          console.log(`  Attendance Count: ${user.attendanceCount}`);
          console.log(`  Last Attendance: ${user.lastAttendance}`);
        });
        
        // Save to file
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `zkteco_users_from_attendance_${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(attendanceUsers.data, null, 2));
        console.log(`\n💾 User data saved to ${filename}`);
      }
    } catch (error) {
      console.log(`Attendance method failed: ${error.message}`);
    }
    
    // Disconnect
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try to disconnect if connected
    try {
      await zktecoService.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

// Run the test
testZktecoUsers(); 