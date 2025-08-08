#!/usr/bin/env node

/**
 * Test WebSocket Connection
 * 
 * This script tests the WebSocket connection to the real-time attendance service.
 * 
 * Usage: node server/scripts/testWebSocket.js
 */

const WebSocket = require('ws');

async function testWebSocket() {
  try {
    console.log('🧪 Testing WebSocket connection to real-time attendance service...');
    
    const wsUrl = 'ws://localhost:8080';
    console.log(`🔌 Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully!');
      
      // Send a test message
      const testMessage = {
        type: 'test',
        message: 'Testing WebSocket connection',
        timestamp: new Date().toISOString()
      };
      
      ws.send(JSON.stringify(testMessage));
      console.log('📤 Sent test message:', testMessage);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('📥 Received message:', message);
        
        if (message.type === 'connection') {
          console.log('✅ Connection established successfully!');
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
    
    // Keep the connection open for 5 seconds
    setTimeout(() => {
      console.log('🛑 Closing WebSocket connection...');
      ws.close();
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error testing WebSocket:', error.message);
    process.exit(1);
  }
}

// Run the test
testWebSocket(); 