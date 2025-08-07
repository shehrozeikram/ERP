const zktecoService = require('../services/zktecoService');

async function testAttendanceDisplay() {
  console.log('🔍 Testing ZKTeco attendance display logic...\n');
  
  try {
    // Connect to device
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');
    
    // Get attendance data
    const attendance = await zktecoService.getAttendanceData();
    
    console.log('\n📊 Raw attendance data from service:');
    console.log('Success:', attendance.success);
    console.log('Count:', attendance.count);
    console.log('Data length:', attendance.data ? attendance.data.length : 0);
    
    // Simulate the server response structure
    const serverResponse = {
      success: true,
      data: attendance
    };
    
    console.log('\n📋 Server response structure:');
    console.log('Server success:', serverResponse.success);
    console.log('Has data:', !!serverResponse.data);
    console.log('Data success:', serverResponse.data.success);
    console.log('Data count:', serverResponse.data.count);
    console.log('Data data length:', serverResponse.data.data ? serverResponse.data.data.length : 0);
    
    // Simulate frontend processing
    const response = serverResponse;
    const attendanceData = response.data;
    const attendanceRecords = attendanceData?.data || [];
    const recordCount = Array.isArray(attendanceRecords) ? attendanceRecords.length : 0;
    
    console.log('\n🎯 Frontend processing:');
    console.log('Attendance data exists:', !!attendanceData);
    console.log('Attendance records exists:', !!attendanceRecords);
    console.log('Record count:', recordCount);
    console.log('Is array:', Array.isArray(attendanceRecords));
    
    if (attendanceRecords.length > 0) {
      console.log('\n👤 First record sample:');
      console.log(JSON.stringify(attendanceRecords[0], null, 2));
    }
    
    // Disconnect
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
    console.log('\n✅ Test completed successfully!');
    console.log(`📊 Expected attendance count: ${recordCount}`);
    
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
testAttendanceDisplay(); 