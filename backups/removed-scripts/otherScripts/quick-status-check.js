const io = require('socket.io-client');

/**
 * Quick Status Check for ZKBio Time Connection
 */

console.log('🔍 Quick ZKBio Time Connection Status Check\n');

const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
});

socket.on('zkbioConnectionStatus', (status) => {
  console.log('📡 ZKBio Time Status:', status);
  
  if (status.connected) {
    console.log('✅ SUCCESS: ZKBio Time is connected and working!');
    console.log('   Your Dashboard Real-Time Monitor should now show "LIVE" status.');
  } else {
    console.log('❌ ISSUE: ZKBio Time connection failed');
    console.log(`   Error: ${status.message}`);
  }
  
  socket.disconnect();
  process.exit(0);
});

socket.on('error', (error) => {
  console.error('❌ Connection error:', error);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏰ Timeout waiting for status');
  socket.disconnect();
  process.exit(1);
}, 10000);
