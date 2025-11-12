const io = require('socket.io-client');

// Test Socket.IO connection to our server
const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling']
});

console.log('🔌 Testing Socket.IO connection to server...');

socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
  
  // Request status
  socket.emit('requestStatus');
});

socket.on('zkbioConnectionStatus', (status) => {
  console.log('📡 ZKBio Time connection status:', status);
});

socket.on('liveAttendanceUpdate', (data) => {
  console.log('📊 Live attendance update received:', {
    eventsCount: data.events?.length || 0,
    timestamp: data.timestamp,
    sampleEvent: data.events?.[0] || null
  });
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Keep running for 30 seconds to test
setTimeout(() => {
  console.log('⏰ Test completed, disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 30000);
