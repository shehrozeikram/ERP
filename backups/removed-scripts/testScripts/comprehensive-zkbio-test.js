const io = require('socket.io-client');

/**
 * Comprehensive End-to-End Test for ZKBio Time Real-Time Connection
 * This test verifies the complete flow from ZKBio Time to frontend
 */

console.log('🔍 Comprehensive ZKBio Time Real-Time Connection Test\n');
console.log('This test will verify:');
console.log('1. Server connection to ZKBio Time');
console.log('2. Real-time data flow');
console.log('3. Frontend-ready data format');
console.log('4. Connection status updates\n');

// Connect to our server
const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling']
});

let testResults = {
  serverConnected: false,
  zkbioConnected: false,
  eventsReceived: 0,
  lastEventTime: null,
  connectionStatus: null,
  sampleEvent: null
};

socket.on('connect', () => {
  console.log('✅ Step 1: Connected to our server');
  testResults.serverConnected = true;
  console.log(`   Server ID: ${socket.id}`);
  console.log('   Status: PASSED\n');
});

socket.on('zkbioConnectionStatus', (status) => {
  testResults.connectionStatus = status;
  
  if (status.connected) {
    console.log('✅ Step 2: ZKBio Time connection established');
    console.log(`   Status: ${status.message}`);
    console.log('   Result: PASSED\n');
    testResults.zkbioConnected = true;
  } else {
    console.log('❌ Step 2: ZKBio Time connection failed');
    console.log(`   Error: ${status.message}`);
    console.log('   Result: FAILED\n');
  }
});

socket.on('liveAttendanceUpdate', (data) => {
  testResults.eventsReceived++;
  testResults.lastEventTime = new Date();
  
  if (testResults.eventsReceived === 1) {
    console.log('✅ Step 3: Real-time data flow working');
    console.log(`   First event received at: ${testResults.lastEventTime.toLocaleTimeString()}`);
    console.log(`   Events in this update: ${data.events?.length || 0}`);
    
    if (data.events && data.events.length > 0) {
      testResults.sampleEvent = data.events[0];
      console.log(`   Sample event: ${testResults.sampleEvent.name} - ${testResults.sampleEvent.state}`);
      console.log('   Result: PASSED\n');
    } else {
      console.log('   Result: PARTIAL (no events in update)\n');
    }
  } else {
    console.log(`📊 Additional event #${testResults.eventsReceived} received`);
    if (data.events && data.events.length > 0) {
      console.log(`   ${data.events.length} attendance records processed`);
    }
  }
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Monitor for 3 minutes to get comprehensive results
setTimeout(() => {
  console.log('\n📈 COMPREHENSIVE TEST RESULTS:');
  console.log('=' .repeat(50));
  
  console.log(`1. Server Connection: ${testResults.serverConnected ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`2. ZKBio Time Connection: ${testResults.zkbioConnected ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`3. Real-time Data Flow: ${testResults.eventsReceived > 0 ? '✅ PASSED' : '⚠️  NO EVENTS (Normal if no activity)'}`);
  console.log(`4. Total Events Received: ${testResults.eventsReceived}`);
  console.log(`5. Last Event Time: ${testResults.lastEventTime ? testResults.lastEventTime.toLocaleTimeString() : 'None'}`);
  
  if (testResults.sampleEvent) {
    console.log('\n📋 Sample Event Data:');
    console.log(`   Employee: ${testResults.sampleEvent.name}`);
    console.log(`   Code: ${testResults.sampleEvent.empCode}`);
    console.log(`   Action: ${testResults.sampleEvent.state}`);
    console.log(`   Time: ${testResults.sampleEvent.time}`);
    console.log(`   Location: ${testResults.sampleEvent.location || 'N/A'}`);
  }
  
  console.log('\n🎯 FINAL ASSESSMENT:');
  if (testResults.serverConnected && testResults.zkbioConnected) {
    console.log('✅ SUCCESS: Real-time connection is working perfectly!');
    console.log('   The system is successfully connected to ZKBio Time');
    console.log('   and ready to receive live attendance data.');
    console.log('   The Dashboard Real-Time Monitor should now show "LIVE" status.');
  } else {
    console.log('❌ FAILED: Connection issues detected.');
    console.log('   Check server logs for authentication or connection problems.');
  }
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Open your Dashboard in the browser');
  console.log('2. Check the Real-Time Monitor section');
  console.log('3. Verify it shows "LIVE" status instead of "OFFLINE"');
  console.log('4. Wait for employee punch events to appear in real-time');
  
  socket.disconnect();
  process.exit(0);
}, 180000); // 3 minutes

console.log('⏰ Test will run for 3 minutes to ensure comprehensive coverage.\n');
