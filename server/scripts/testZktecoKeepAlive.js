#!/usr/bin/env node

/**
 * Test script for ZKTeco Keep-Alive Service
 * Tests the keep-alive mechanism to maintain active sessions
 */

const ZKTecoKeepAliveService = require('../services/zktecoKeepAliveService');

async function testZktecoKeepAlive() {
  console.log('🧪 Testing ZKTeco Keep-Alive Service...\n');
  
  try {
    const keepAliveService = new ZKTecoKeepAliveService();
    
    console.log('📊 Initial service status:');
    console.log(keepAliveService.getStatus());
    console.log('');
    
    console.log('🔄 Initializing keep-alive service...');
    const initResult = await keepAliveService.initialize();
    
    if (initResult) {
      console.log('✅ Keep-alive service initialized successfully');
      
      console.log('\n📊 Service status after initialization:');
      console.log(keepAliveService.getStatus());
      
      console.log('\n🔄 Starting keep-alive service...');
      await keepAliveService.start();
      
      console.log('\n📊 Service status after starting:');
      console.log(keepAliveService.getStatus());
      
      console.log('\n🔄 Testing manual keep-alive...');
      const manualResult = await keepAliveService.performKeepAlive();
      
      if (manualResult) {
        console.log('✅ Manual keep-alive successful');
      } else {
        console.log('❌ Manual keep-alive failed');
      }
      
      console.log('\n📊 Service status after manual keep-alive:');
      console.log(keepAliveService.getStatus());
      
      console.log('\n🔄 Testing connection status...');
      const connectionTest = await keepAliveService.testConnection();
      
      if (connectionTest.success) {
        console.log(`✅ Connection test successful (status: ${connectionTest.status})`);
      } else {
        console.log(`❌ Connection test failed (status: ${connectionTest.status})`);
      }
      
      console.log('\n⏰ Waiting for automatic keep-alive (30 seconds)...');
      console.log('This will test the automatic interval-based keep-alive...');
      
      // Wait for 30 seconds to see automatic keep-alive in action
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      console.log('\n📊 Final service status:');
      console.log(keepAliveService.getStatus());
      
      console.log('\n🔄 Testing force refresh...');
      const forceRefreshResult = await keepAliveService.forceRefresh();
      
      if (forceRefreshResult) {
        console.log('✅ Force refresh successful');
      } else {
        console.log('❌ Force refresh failed');
      }
      
      console.log('\n🛑 Stopping keep-alive service...');
      keepAliveService.stop();
      
      console.log('\n📊 Final status after stopping:');
      console.log(keepAliveService.getStatus());
      
      console.log('\n🎉 ZKTeco keep-alive service test completed successfully!');
      
    } else {
      console.log('❌ Keep-alive service initialization failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testZktecoKeepAlive().then(() => {
  console.log('\n🏁 Test completed.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});
