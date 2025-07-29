// Test ZKTeco device using the exact code provided
console.log('🔍 Testing ZKTeco Device with node-zklib...\n');

const ZKLib = require('node-zklib');

(async () => {
  const zkInstance = new ZKLib('splaza.nayatel.net', 4370, 10000, 4000); // IP, port, timeout, inMsgDelay

  try {
    console.log('🔌 Creating socket connection...');
    // Create socket connection
    await zkInstance.createSocket();
    console.log('✅ Socket connection created successfully!');

    console.log('\n📋 Getting device info...');
    // Get general info (optional)
    const deviceInfo = await zkInstance.getInfo();
    console.log('✅ Device Info:', deviceInfo);

    console.log('\n📊 Getting attendance logs...');
    // Get attendance logs
    const logs = await zkInstance.getAttendances();
    console.log('✅ Attendance Logs:', logs);
    console.log(`   Total attendance records: ${logs.data ? logs.data.length : logs.length}`);

    // Show some sample records
    const attendanceData = logs.data || logs;
    if (attendanceData.length > 0) {
      console.log('\n📋 Sample attendance records:');
      attendanceData.slice(0, 5).forEach((record, index) => {
        console.log(`   ${index + 1}. User ID: ${record.uid || record.userId}, Time: ${record.timestamp}, Status: ${record.state || record.status}`);
      });
    }

    console.log('\n🔌 Disconnecting...');
    // Disconnect after use
    await zkInstance.disconnect();
    console.log('✅ Disconnected successfully!');

    console.log('\n📊 Summary:');
    console.log('   ✅ Connection successful');
    console.log('   📋 Device information retrieved');
    console.log('   📊 Attendance logs retrieved');
    console.log(`   📈 Total records: ${attendanceData.length}`);

  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error('   Stack:', e.stack);
  }
})(); 