// Test script to simulate frontend request
const axios = require('axios');

const testFrontendRequest = async () => {
  console.log('🔍 Testing Frontend Request Simulation...\n');

  try {
    // Simulate the exact request the frontend makes
    const API_URL = 'http://localhost:5001/api';
    const employeeId = '68850b7f0482b9a9267b3c6b'; // Use the actual employee ID from our tests
    
    console.log(`📋 Making request to: ${API_URL}/hr/employees/${employeeId}`);
    
    // First, let's try without authentication
    console.log('\n🔓 Test 1: Request without authentication...');
    try {
      const response1 = await axios.get(`${API_URL}/hr/employees/${employeeId}`);
      console.log('   ✅ Request successful without auth (unexpected)');
      console.log('   Response status:', response1.status);
      console.log('   Response data:', response1.data);
    } catch (error1) {
      console.log('   ❌ Request failed without auth (expected)');
      console.log('   Error status:', error1.response?.status);
      console.log('   Error message:', error1.response?.data?.message);
    }

    // Now let's try with a mock token
    console.log('\n🔐 Test 2: Request with mock authentication...');
    try {
      const response2 = await axios.get(`${API_URL}/hr/employees/${employeeId}`, {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json'
        }
      });
      console.log('   ✅ Request successful with mock token');
      console.log('   Response status:', response2.status);
      console.log('   Response data:', response2.data);
    } catch (error2) {
      console.log('   ❌ Request failed with mock token');
      console.log('   Error status:', error2.response?.status);
      console.log('   Error message:', error2.response?.data?.message);
    }

    // Let's also test the server directly
    console.log('\n🖥️  Test 3: Testing server availability...');
    try {
      const response3 = await axios.get(`${API_URL}/hr/departments`);
      console.log('   ✅ Server is responding');
      console.log('   Response status:', response3.status);
    } catch (error3) {
      console.log('   ❌ Server is not responding');
      console.log('   Error:', error3.message);
    }

  } catch (error) {
    console.log('❌ Error during test:');
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n🎯 Test Summary:');
  console.log('✅ Frontend request simulation completed');
  console.log('📝 Check the results above for authentication or server issues');
};

testFrontendRequest().catch(console.error); 