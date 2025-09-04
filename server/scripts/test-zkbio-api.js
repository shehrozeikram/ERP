const axios = require('axios');

async function testZKBioAPI() {
  try {
    console.log('🔍 Testing ZKBio Time API for employee 6035...');
    
    const baseURL = 'http://182.180.55.96:85';
    
    // Step 1: Authenticate
    console.log('🔐 Authenticating...');
    const authResponse = await axios.post(`${baseURL}/api-token-auth/`, {
      username: 'superuser',
      password: 'SGCit123456'
    });
    
    if (!authResponse.data || !authResponse.data.token) {
      console.log('❌ Authentication failed');
      return;
    }
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Step 2: Get employee attendance history
    console.log('📊 Fetching attendance history...');
    const attendanceResponse = await axios.get(`${baseURL}/iclock/api/transactions/`, {
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        emp_code: '6035',
        page_size: 100,
        page: 1,
        ordering: '-punch_time'
      }
    });
    
    if (attendanceResponse.data && attendanceResponse.data.data) {
      const records = attendanceResponse.data.data;
      console.log(`✅ Fetched ${records.length} attendance records`);
      
      // Filter August 2025 records
      const augustRecords = records.filter(record => {
        const punchTime = record.punch_time;
        if (!punchTime) return false;
        const date = new Date(punchTime);
        return date.getFullYear() === 2025 && date.getMonth() === 7; // August is month 7 (0-indexed)
      });
      
      console.log(`📅 August 2025 records: ${augustRecords.length}`);
      
      if (augustRecords.length > 0) {
        console.log('\n📋 August 2025 attendance records:');
        augustRecords.forEach((record, index) => {
          console.log(`${index + 1}. ${record.punch_time} - ${record.punch_state_display} - ${record.area_alias || 'N/A'}`);
        });
        
        // Group by date
        const dateGroups = {};
        augustRecords.forEach(record => {
          const date = record.punch_time.split(' ')[0]; // YYYY-MM-DD
          if (!dateGroups[date]) {
            dateGroups[date] = [];
          }
          dateGroups[date].push({
            time: record.punch_time,
            state: record.punch_state_display,
            location: record.area_alias || 'N/A'
          });
        });
        
        console.log('\n📅 Records by date:');
        Object.entries(dateGroups).forEach(([date, punches]) => {
          console.log(`\n${date}: ${punches.length} punches`);
          punches.forEach(p => {
            console.log(`  ${p.time} - ${p.state} - ${p.location}`);
          });
        });
        
        console.log(`\n📊 Summary:`);
        console.log(`Total August records: ${augustRecords.length}`);
        console.log(`Unique dates: ${Object.keys(dateGroups).length}`);
        console.log(`Dates with records: ${Object.keys(dateGroups).join(', ')}`);
      } else {
        console.log('❌ No August 2025 records found');
      }
      
      // Show some sample records from other months
      const otherRecords = records.filter(record => {
        const punchTime = record.punch_time;
        if (!punchTime) return false;
        const date = new Date(punchTime);
        return !(date.getFullYear() === 2025 && date.getMonth() === 7);
      });
      
      if (otherRecords.length > 0) {
        console.log(`\n📅 Other records: ${otherRecords.length}`);
        console.log('Sample records:');
        otherRecords.slice(0, 5).forEach(record => {
          console.log(`  ${record.punch_time} - ${record.punch_state_display}`);
        });
      }
      
    } else {
      console.log('❌ No attendance data received');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testZKBioAPI();
