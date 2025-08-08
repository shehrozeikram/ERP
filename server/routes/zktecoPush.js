/**
 * ZKTeco Push SDK Routes
 * 
 * Handles real-time attendance notifications and WebSocket connections
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { errorHandler } = require('../middleware/errorHandler');
const zktecoPushService = require('../services/zktecoPushService');

// Start real-time push server
router.post('/start', authMiddleware, async (req, res) => {
  try {
    console.log('🚀 Starting ZKTeco real-time push server...');
    
    const result = await zktecoPushService.startPushServer();
    
    res.json({
      success: true,
      message: 'ZKTeco real-time push server started successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error starting push server:', error);
    errorHandler(error, req, res);
  }
});

// Stop real-time push server
router.post('/stop', authMiddleware, async (req, res) => {
  try {
    console.log('🛑 Stopping ZKTeco real-time push server...');
    
    const result = await zktecoPushService.stopPushServer();
    
    res.json({
      success: true,
      message: 'ZKTeco real-time push server stopped successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error stopping push server:', error);
    errorHandler(error, req, res);
  }
});

// Get push server status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = zktecoPushService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Error getting push server status:', error);
    errorHandler(error, req, res);
  }
});

// Configure push server settings
router.post('/configure', authMiddleware, async (req, res) => {
  try {
    const { host, port, pushEndpoint } = req.body;
    
    const config = {};
    if (host) config.host = host;
    if (port) config.port = port;
    if (pushEndpoint) config.pushEndpoint = pushEndpoint;
    
    zktecoPushService.configureDevice(config);
    
    res.json({
      success: true,
      message: 'Push server configuration updated successfully',
      data: zktecoPushService.getStatus()
    });
  } catch (error) {
    console.error('❌ Error configuring push server:', error);
    errorHandler(error, req, res);
  }
});

// Test push endpoint (for testing real-time functionality)
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const testData = req.body || {
      deviceUserId: "6035",
      recordTime: new Date().toISOString(),
      state: 1,
      ip: "splaza.nayatel.net"
    };
    
    console.log('🧪 Testing real-time attendance processing...');
    const result = await zktecoPushService.processRealTimeAttendance(testData);
    
    res.json({
      success: true,
      message: 'Test attendance processed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error testing push functionality:', error);
    errorHandler(error, req, res);
  }
});

// WebSocket endpoint for real-time updates
router.get('/ws', (req, res) => {
  res.json({
    success: true,
    message: 'WebSocket endpoint available at ws://localhost:8080',
    instructions: [
      'Connect to WebSocket for real-time attendance updates',
      'Use: new WebSocket("ws://localhost:8080")',
      'Listen for "attendance" type messages'
    ]
  });
});

module.exports = router; 