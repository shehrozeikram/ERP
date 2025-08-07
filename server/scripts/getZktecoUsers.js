const zktecoService = require('../services/zktecoService');

async function getZktecoUsers() {
  console.log('🔍 Getting all users from ZKTeco device at splaza.nayatel.net...\n');
  
  try {
    // Connect to device
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');
    
    // Get all users
    const usersResult = await zktecoService.getUsers();
    
    if (usersResult.success) {
      console.log(`✅ Successfully retrieved ${usersResult.count} users\n`);
      
      // Display user information
      usersResult.data.forEach((user, index) => {
        console.log(`👤 User ${index + 1}:`);
        console.log(`   ID: ${user.uid || user.userId || 'N/A'}`);
        console.log(`   Name: ${user.name || user.userName || 'N/A'}`);
        console.log(`   Role: ${user.role || user.userRole || 'N/A'}`);
        console.log(`   Password: ${user.password ? 'Set' : 'Not Set'}`);
        console.log(`   Card: ${user.card || 'N/A'}`);
        console.log(`   Group: ${user.group || 'N/A'}`);
        console.log(`   Time Zone: ${user.timeZone || 'N/A'}`);
        console.log(`   Privilege: ${user.privilege || 'N/A'}`);
        console.log(`   Fingerprints: ${user.fingerprints ? user.fingerprints.length : 0}`);
        console.log(`   Faces: ${user.faces ? user.faces.length : 0}`);
        console.log(`   Status: ${user.status || 'Active'}`);
        console.log('');
      });
      
      // Save to file for reference
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `zkteco_users_${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify(usersResult.data, null, 2));
      console.log(`💾 User data saved to ${filename}`);
      
    } else {
      console.log('❌ Failed to get users');
    }
    
    // Disconnect
    await zktecoService.disconnect();
    console.log('🔌 Disconnected from ZKTeco device');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try to disconnect if connected
    try {
      await zktecoService.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

// Run the script
getZktecoUsers(); 