const zktecoService = require('../services/zktecoService');

async function testUsersDisplay() {
  console.log('🔍 Testing ZKTeco users display logic...\n');
  
  try {
    // Connect to device
    await zktecoService.connect('splaza.nayatel.net', 4370);
    console.log('✅ Connected to ZKTeco device');
    
    // Get users data
    const users = await zktecoService.getUsers();
    
    console.log('\n📊 Raw users data from service:');
    console.log('Success:', users.success);
    console.log('Count:', users.count);
    console.log('Data length:', users.data ? users.data.length : 0);
    
    // Simulate the server response structure
    const serverResponse = {
      success: true,
      data: users,
      message: `Found ${users.count} users from device`
    };
    
    console.log('\n📋 Server response structure:');
    console.log('Server success:', serverResponse.success);
    console.log('Has data:', !!serverResponse.data);
    console.log('Data success:', serverResponse.data.success);
    console.log('Data count:', serverResponse.data.count);
    console.log('Data data length:', serverResponse.data.data ? serverResponse.data.data.length : 0);
    
    // Simulate frontend processing
    const response = serverResponse;
    const usersData = response.data;
    const usersArray = usersData?.data || [];
    
    console.log('\n🎯 Frontend processing:');
    console.log('Users data exists:', !!usersData);
    console.log('Users array exists:', !!usersArray);
    console.log('Users array length:', usersArray.length);
    console.log('Is array:', Array.isArray(usersArray));
    
    if (usersArray.length > 0) {
      console.log('\n👤 First user sample:');
      console.log(JSON.stringify(usersArray[0], null, 2));
      
      console.log('\n👥 First 3 users (summary):');
      usersArray.slice(0, 3).forEach((user, index) => {
        console.log(`\nUser ${index + 1}:`);
        console.log(`  UID: ${user.uid}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  User ID: ${user.userId}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Password: ${user.password ? 'Set' : 'Not Set'}`);
        console.log(`  Card: ${user.cardno}`);
      });
    }
    
    // Disconnect
    await zktecoService.disconnect();
    console.log('\n🔌 Disconnected from ZKTeco device');
    
    console.log('\n✅ Test completed successfully!');
    console.log(`👥 Expected users count: ${usersArray.length}`);
    
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

// Run the test
testUsersDisplay(); 