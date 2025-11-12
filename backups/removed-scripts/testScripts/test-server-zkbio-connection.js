const io = require('socket.io-client');

/**
 * Test script to verify the updated ZKBio Time WebSocket Proxy
 * This will test the real-time connection through our server
 */

console.log('🔍 Testing Updated ZKBio Time WebSocket Proxy...\n');

// Connect to our server
const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling']
});

let eventCount = 0;
let lastEventTime = null;
let connectionStatus = null;

socket.on('connect', () => {
  console.log('✅ Connected to our server:', socket.id);
  console.log('📡 Waiting for ZKBio Time connection status...\n');
});

socket.on('zkbioConnectionStatus', (status) => {
  connectionStatus = status;
  console.log('📡 ZKBio Time connection status:', status);
  
  if (status.connected) {
    console.log('✅ ZKBio Time is connected and ready!');
    console.log('📊 Waiting for real-time attendance events...\n');
  } else {
    console.log('❌ ZKBio Time connection failed:', status.message);
  }
});

socket.on('liveAttendanceUpdate', (data) => {
  eventCount++;
  lastEventTime = new Date();
  
  console.log(`📊 Event #${eventCount} received at ${lastEventTime.toLocaleTimeString()}`);
  
  if (data.events && data.events.length > 0) {
    console.log(`   📋 Processing ${data.events.length} attendance records:`);
    
    data.events.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.name} (${event.empCode}) - ${event.state} at ${event.time}`);
      if (event.location) {
        console.log(`      📍 Location: ${event.location}`);
      }
    });
    
    console.log(`   ✅ Successfully processed ${data.events.length} events\n`);
  } else {
    console.log('   ⚠️  Empty data received\n');
  }
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Monitor for 2 minutes
setTimeout(() => {
  console.log('\n📈 Test Summary:');
  console.log(`   Server connection: ${socket.connected ? 'Connected' : 'Disconnected'}`);
  console.log(`   ZKBio Time status: ${connectionStatus ? (connectionStatus.connected ? 'Connected' : 'Disconnected') : 'Unknown'}`);
  console.log(`   Total events received: ${eventCount}`);
  console.log(`   Last event time: ${lastEventTime ? lastEventTime.toLocaleTimeString() : 'None'}`);
  
  if (connectionStatus && connectionStatus.connected && eventCount > 0) {
    console.log('\n✅ SUCCESS: Real-time connection is working perfectly!');
    console.log('   The server is successfully connected to ZKBio Time and receiving live data.');
  } else if (connectionStatus && connectionStatus.connected) {
    console.log('\n⚠️  PARTIAL SUCCESS: Connected to ZKBio Time but no events received.');
    console.log('   This is normal if no employees are currently punching in/out.');
  } else {
    console.log('\n❌ FAILED: Could not establish connection to ZKBio Time.');
    console.log('   Check server logs for authentication or connection issues.');
  }
  
  socket.disconnect();
  process.exit(0);
}, 120000); // 2 minutes

console.log('⏰ Test will run for 2 minutes. Press Ctrl+C to stop early.\n');
