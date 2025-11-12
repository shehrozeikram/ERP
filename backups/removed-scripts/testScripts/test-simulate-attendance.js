/**
 * Test: Simulate Real-Time Attendance Event
 * This test simulates what a real-time attendance event should look like
 */

const axios = require('axios');

console.log('🔍 Testing Real-Time Attendance Event Simulation...\n');

async function simulateAttendanceEvent() {
  try {
    console.log('🎯 Step 1: Simulating real-time attendance event...');
    
    // Create a mock attendance event with image data
    const mockEvent = {
      events: [
        {
          id: '12345',
          empCode: 'EMP001',
          name: 'Test Employee',
          time: '2025-01-13 10:30:00',
          state: 'Check In',
          imagePath: '/media/attendance_images/20250113103000-EMP001.jpg',
          photoPath: '/media/employee_photos/EMP001.jpg',
          location: 'Main Entrance',
          timestamp: new Date().toISOString(),
          score: 95
        }
      ],
      timestamp: new Date().toISOString(),
      count: 1
    };
    
    console.log('📊 Mock event created:', JSON.stringify(mockEvent, null, 2));
    
    // Test if we can send this to our server
    console.log('\n🎯 Step 2: Testing server endpoint...');
    
    const response = await axios.post('http://localhost:5001/api/test/simulate-attendance', mockEvent, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log('✅ Server responded:', response.data);
    
  } catch (error) {
    console.log('❌ Simulation failed:', error.message);
    console.log('   This is expected if the endpoint doesn\'t exist');
  }
}

async function testImageURLs() {
  console.log('\n🎯 Step 3: Testing image URL construction...');
  
  const baseURL = 'http://45.115.86.139:85';
  const testPaths = [
    '/media/attendance_images/20250113103000-EMP001.jpg',
    '/media/employee_photos/EMP001.jpg'
  ];
  
  testPaths.forEach((path, index) => {
    const fullURL = `${baseURL}${path}`;
    console.log(`${index + 1}. Testing URL: ${fullURL}`);
    
    // Test if URL is accessible
    axios.get(fullURL, { timeout: 5000 })
      .then(response => {
        console.log(`   ✅ Image accessible (${response.status})`);
      })
      .catch(error => {
        console.log(`   ❌ Image not accessible: ${error.message}`);
      });
  });
}

async function runTest() {
  console.log('🚀 Starting real-time attendance event simulation...\n');
  
  await simulateAttendanceEvent();
  await testImageURLs();
  
  console.log('\n📊 EXPECTED BEHAVIOR:');
  console.log('=' .repeat(60));
  console.log('✅ Mock event should be created with image paths');
  console.log('✅ Image URLs should be constructed correctly');
  console.log('✅ Server should be able to process the event');
  console.log('✅ Frontend should display the event with images');
  
  console.log('\n📱 WHAT TO CHECK IN BROWSER:');
  console.log('=' .repeat(60));
  console.log('1. 🔍 Look for "🔍 Socket.IO Event Received: liveAttendanceUpdate"');
  console.log('2. 🔍 Look for "🎉 LIVE ATTENDANCE UPDATE RECEIVED!"');
  console.log('3. 🔍 Look for "🖼️ Processing REAL-TIME event for Test Employee"');
  console.log('4. 🔍 Look for "✅ Real-time image loaded for Test Employee"');
  console.log('5. 🔍 Check if the event appears in the real-time monitor');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('=' .repeat(60));
  console.log('1. 🔍 Open Dashboard and check browser console');
  console.log('2. 🔍 Look for the debugging messages we added');
  console.log('3. 🔍 Try using the actual ZKBio Time attendance system');
  console.log('4. 🔍 Check if real events trigger the same logging');
  console.log('5. 🔍 Verify images load when real events occur');
}

runTest().catch(error => {
  console.error('\n💥 Test crashed:', error.message);
});
