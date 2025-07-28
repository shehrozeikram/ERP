// Test script for network connectivity
const axios = require('axios');

const testNetworkConnectivity = async () => {
  console.log('🌐 Testing Network Connectivity...\n');

  const API_URL = 'http://localhost:5001/api';
  
  try {
    // Test 1: Basic health check
    console.log('🔍 Test 1: Basic health check...');
    try {
      const healthResponse = await axios.get(`${API_URL}/health`);
      console.log('   ✅ Health check successful');
      console.log('   Status:', healthResponse.status);
      console.log('   Data:', healthResponse.data);
    } catch (healthError) {
      console.log('   ❌ Health check failed');
      console.log('   Error:', healthError.message);
      console.log('   Code:', healthError.code);
      return;
    }

    // Test 2: CORS preflight test
    console.log('\n🔍 Test 2: CORS preflight test...');
    try {
      const corsResponse = await axios.options(`${API_URL}/hr/employees`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization'
        }
      });
      console.log('   ✅ CORS preflight successful');
      console.log('   Status:', corsResponse.status);
      console.log('   Headers:', corsResponse.headers);
    } catch (corsError) {
      console.log('   ❌ CORS preflight failed');
      console.log('   Error:', corsError.message);
      console.log('   Code:', corsError.code);
    }

    // Test 3: Authenticated request test
    console.log('\n🔍 Test 3: Authenticated request test...');
    try {
      const authResponse = await axios.get(`${API_URL}/hr/employees`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Origin': 'http://localhost:3000'
        }
      });
      console.log('   ✅ Authenticated request successful');
      console.log('   Status:', authResponse.status);
    } catch (authError) {
      console.log('   ❌ Authenticated request failed (expected)');
      console.log('   Status:', authError.response?.status);
      console.log('   Message:', authError.response?.data?.message);
    }

    // Test 4: Network error simulation
    console.log('\n🔍 Test 4: Network error simulation...');
    try {
      const networkResponse = await axios.get('http://localhost:9999/api/test');
      console.log('   ❌ Unexpected success on non-existent port');
    } catch (networkError) {
      console.log('   ✅ Network error correctly detected');
      console.log('   Error name:', networkError.name);
      console.log('   Error code:', networkError.code);
      console.log('   Error message:', networkError.message);
    }

    // Test 5: Frontend-like request
    console.log('\n🔍 Test 5: Frontend-like request simulation...');
    try {
      const frontendResponse = await axios.get(`${API_URL}/hr/employees/68878f7da3b4dc58ae2fbd7e`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Origin': 'http://localhost:3000',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      console.log('   ✅ Frontend-like request successful');
      console.log('   Status:', frontendResponse.status);
    } catch (frontendError) {
      console.log('   ❌ Frontend-like request failed');
      console.log('   Error name:', frontendError.name);
      console.log('   Error code:', frontendError.code);
      console.log('   Error message:', frontendError.message);
      console.log('   Response status:', frontendError.response?.status);
      console.log('   Response data:', frontendError.response?.data);
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }

  console.log('\n🎯 Network Connectivity Test Summary:');
  console.log('✅ All tests completed');
  console.log('📝 Check the results above for connectivity issues');
};

testNetworkConnectivity().catch(console.error); 