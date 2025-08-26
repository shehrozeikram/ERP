const axios = require('axios');

// ZKTECO API Authentication Test
async function testZKTecoAuth() {
  const baseUrl = 'http://182.180.55.96:85';
  const authEndpoint = '/api-token-auth/';
  
  const credentials = {
    username: 'adil.aamir',
    password: 'Pak123456'
  };

  console.log('🔐 Testing ZKTECO API Authentication...');
  console.log('📍 Base URL:', baseUrl);
  console.log('👤 Username:', credentials.username);
  console.log('🔑 Password:', credentials.password);
  console.log('---');

  try {
    console.log('📡 Sending authentication request...');
    
    const response = await axios.post(`${baseUrl}${authEndpoint}`, credentials, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('✅ Authentication SUCCESSFUL!');
    console.log('📊 Response Status:', response.status);
    console.log('🔑 Auth Token:', response.data.token);
    console.log('📝 Full Response:', JSON.stringify(response.data, null, 2));
    
    // Test if we can use the token for other API calls
    if (response.data.token) {
      console.log('---');
      console.log('🧪 Testing token usage...');
      
      // Try to get user info or test another endpoint
      try {
        const testResponse = await axios.get(`${baseUrl}/api/users/me/`, {
          headers: {
            'Authorization': `Token ${response.data.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        console.log('✅ Token validation successful!');
        console.log('👤 User info:', JSON.stringify(testResponse.data, null, 2));
        
      } catch (tokenError) {
        console.log('⚠️  Token validation failed (this might be normal):', tokenError.message);
      }
    }

  } catch (error) {
    console.log('❌ Authentication FAILED!');
    
    if (error.response) {
      // Server responded with error status
      console.log('📊 Error Status:', error.response.status);
      console.log('📝 Error Response:', JSON.stringify(error.response.data, null, 2));
      console.log('📋 Error Headers:', JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      // Request was made but no response received
      console.log('🚫 No response received from server');
      console.log('💡 This might mean:');
      console.log('   - Server is not running');
      console.log('   - Network connectivity issues');
      console.log('   - Firewall blocking the request');
      console.log('   - Wrong port number');
    } else {
      // Something else happened
      console.log('💥 Request setup error:', error.message);
    }
    
    console.log('---');
    console.log('🔍 Troubleshooting Tips:');
    console.log('1. Check if ZKTECO server is running on port 85');
    console.log('2. Verify network connectivity to 182.180.55.96');
    console.log('3. Check firewall settings');
    console.log('4. Verify the API endpoint path');
    console.log('5. Ensure credentials are correct');
  }
}

// Test alternative endpoints
async function testAlternativeEndpoints() {
  const baseUrl = 'http://182.180.55.96:85';
  const credentials = {
    username: 'adil.aamir',
    password: 'Pak123456'
  };

  console.log('\n🔍 Testing Alternative Endpoints...');
  
  const endpoints = [
    '/api/auth/',
    '/api/login/',
    '/auth/',
    '/login/',
    '/api-token-auth/',
    '/api/v1/auth/',
    '/api/v1/login/'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing: ${endpoint}`);
      const response = await axios.post(`${baseUrl}${endpoint}`, credentials, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      console.log(`✅ SUCCESS: ${endpoint}`);
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ FAILED: ${endpoint} - Status: ${error.response.status}`);
      } else {
        console.log(`❌ FAILED: ${endpoint} - ${error.message}`);
      }
    }
  }
}

// Run the tests
async function runTests() {
  try {
    await testZKTecoAuth();
    
    // If first test fails, try alternative endpoints
    console.log('\n' + '='.repeat(50));
    await testAlternativeEndpoints();
    
  } catch (error) {
    console.error('💥 Test execution error:', error.message);
  }
}

// Check if axios is available
try {
  require('axios');
  runTests();
} catch (error) {
  console.log('❌ Axios not found. Installing...');
  console.log('💡 Run: npm install axios');
  console.log('💡 Then run this script again');
}
