const zkbioService = require('../services/zkbioTimeService');

async function testZKBioAuthentication() {
  try {
    console.log('🧪 Testing ZKBio Time authentication...');
    
    const authResult = await zkbioService.authenticate();
    
    console.log('📊 Authentication Result:', authResult);
    
    if (authResult.success) {
      console.log('✅ Authentication successful!');
      
      // Test fetching employee 3 attendance
      console.log('\n🔍 Testing attendance fetch for employee 3...');
      const attendanceResult = await zkbioService.getEmployeeAttendanceHistory('3');
      console.log('📊 Attendance Result:', {
        success: attendanceResult.success,
        count: attendanceResult.data ? attendanceResult.data.length : 0,
        hasData: !!attendanceResult.data && attendanceResult.data.length > 0
      });
      
      if (attendanceResult.data && attendanceResult.data.length > 0) {
        console.log('✅ Attendance data fetched successfully!');
        console.log('📅 Sample record:', attendanceResult.data[0]);
      } else {
        console.log('⚠️ No attendance data found');
      }
    } else {
      console.log('❌ Authentication failed:', authResult.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testZKBioAuthentication();
