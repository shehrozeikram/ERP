/**
 * Test: Server WebSocket Proxy Status
 * This test checks if our server's WebSocket proxy is working
 */

const axios = require('axios');

console.log('🔍 Testing Server WebSocket Proxy Status...\n');

async function testServerStatus() {
  try {
    console.log('🔍 Step 1: Checking server status...');
    
    // Test if our server is running
    const serverResponse = await axios.get('http://localhost:5001/api/health', {
      timeout: 5000
    });
    
    console.log('✅ Server is running');
    console.log('📊 Server response:', serverResponse.data);
    
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
  }
}

async function testZKBioTimeDirect() {
  try {
    console.log('\n🔍 Step 2: Testing direct connection to ZKBio Time...');
    
    // Test if ZKBio Time is accessible
    const zkbioResponse = await axios.get('http://182.180.55.96:85/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    console.log('✅ ZKBio Time is accessible');
    console.log('📊 Response status:', zkbioResponse.status);
    console.log('📊 Response length:', zkbioResponse.data.length);
    
    // Check if it's the login page
    if (zkbioResponse.data.includes('login') || zkbioResponse.data.includes('Login')) {
      console.log('✅ ZKBio Time login page detected');
    } else {
      console.log('⚠️  ZKBio Time response doesn\'t look like login page');
    }
    
  } catch (error) {
    console.log('❌ ZKBio Time connection failed:', error.message);
  }
}

async function testSocketIOConnection() {
  try {
    console.log('\n🔍 Step 3: Testing Socket.IO connection...');
    
    // Test if Socket.IO is working
    const socketResponse = await axios.get('http://localhost:5001/socket.io/', {
      timeout: 5000
    });
    
    console.log('✅ Socket.IO endpoint accessible');
    console.log('📊 Socket.IO response:', socketResponse.data.substring(0, 100));
    
  } catch (error) {
    console.log('❌ Socket.IO connection failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive server status test...\n');
  
  await testServerStatus();
  await testZKBioTimeDirect();
  await testSocketIOConnection();
  
  console.log('\n📊 DIAGNOSIS:');
  console.log('=' .repeat(60));
  console.log('If all tests pass:');
  console.log('✅ Server is running and accessible');
  console.log('✅ ZKBio Time is accessible');
  console.log('✅ Socket.IO is working');
  console.log('❓ Issue might be in WebSocket proxy authentication');
  console.log('');
  console.log('If ZKBio Time test fails:');
  console.log('❌ ZKBio Time server is not accessible');
  console.log('❓ Check network connectivity');
  console.log('');
  console.log('If Socket.IO test fails:');
  console.log('❌ Socket.IO is not properly configured');
  console.log('❓ Check server Socket.IO setup');
  
  console.log('\n📱 NEXT STEPS:');
  console.log('=' .repeat(60));
  console.log('1. Check server console logs for WebSocket proxy messages');
  console.log('2. Look for authentication errors');
  console.log('3. Check if WebSocket proxy is connecting to ZKBio Time');
  console.log('4. Verify Socket.IO events are being emitted');
  console.log('5. Test with actual attendance events');
}

runAllTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error.message);
});
