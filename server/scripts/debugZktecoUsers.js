const zktecoService = require('../services/zktecoService');

async function debugZktecoUsers() {
  console.log('🔍 Debugging ZKTeco users from splaza.nayatel.net...\n');
  
  try {
    // Connect to device
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');
    
    // Get users and examine the raw response
    console.log('\n📋 Getting users with standard method...');
    const users = await zktecoService.getUsers();
    
    console.log('\n📊 Raw users response:');
    console.log('Success:', users.success);
    console.log('Count:', users.count);
    console.log('Data type:', typeof users.data);
    console.log('Is array:', Array.isArray(users.data));
    console.log('Data length:', users.data ? users.data.length : 0);
    
    if (users.data && users.data.length > 0) {
      console.log('\n👤 First user (raw):');
      console.log(JSON.stringify(users.data[0], null, 2));
      
      console.log('\n🔍 First user properties:');
      const firstUser = users.data[0];
      Object.keys(firstUser).forEach(key => {
        console.log(`  ${key}: ${typeof firstUser[key]} = ${JSON.stringify(firstUser[key])}`);
      });
      
      console.log('\n👥 First 3 users (summary):');
      users.data.slice(0, 3).forEach((user, index) => {
        console.log(`\nUser ${index + 1}:`);
        Object.keys(user).forEach(key => {
          const value = user[key];
          if (typeof value === 'string' || typeof value === 'number') {
            console.log(`  ${key}: ${value}`);
          } else {
            console.log(`  ${key}: ${typeof value} (${JSON.stringify(value).substring(0, 100)}...)`);
          }
        });
      });
      
      // Save raw data to file
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `zkteco_raw_users_${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify(users.data, null, 2));
      console.log(`\n💾 Raw user data saved to ${filename}`);
    }
    
    // Disconnect
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Try to disconnect if connected
    try {
      await zktecoService.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

// Run the debug
debugZktecoUsers(); 