const zktecoService = require('../services/zktecoService');

async function testZktecoConnection() {
  console.log('🔍 Testing ZKTeco connection to splaza.nayatel.net...\n');
  
  try {
    // Test connection with different ports
    const result = await zktecoService.testConnection('splaza.nayatel.net', [4370, 5200, 5000]);
    
    if (result.success) {
      console.log('✅ Connection successful!');
      console.log(`📡 Port: ${result.port}`);
      console.log(`👥 Users found: ${result.usersCount}`);
      console.log(`📊 Attendance records: ${result.attendanceCount}`);
      console.log('\n📋 Device Information:');
      console.log(JSON.stringify(result.deviceInfo, null, 2));
    } else {
      console.log('❌ Connection failed on all ports');
      console.log('Results:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testZktecoConnection(); 