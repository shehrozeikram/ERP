/**
 * Optional horizontal scaling for Socket.IO using Redis pub/sub.
 * Set REDIS_URL (e.g. redis://localhost:6379) to enable.
 * SFU / WebRTC media is separate from this; use a dedicated SFU (LiveKit, mediasoup) for calls.
 */
async function attachSocketRedisAdapter(io) {
  if (!io || !process.env.REDIS_URL) return;

  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => console.error('Redis pub client error:', err.message));
    subClient.on('error', (err) => console.error('Redis sub client error:', err.message));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis adapter enabled (REDIS_URL)');
  } catch (e) {
    console.warn('⚠️ Socket.IO Redis adapter not started:', e.message);
  }
}

module.exports = { attachSocketRedisAdapter };
