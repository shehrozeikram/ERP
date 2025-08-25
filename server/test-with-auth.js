/**
 * Test script to check payroll API with proper authentication
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';

// You need to get a valid token from your frontend or login API
const AUTH_TOKEN = 'YOUR_VALID_JWT_TOKEN_HERE'; // Replace with actual token

async function testWithAuth() {
  try {
    console.log('🚀 Testing Payroll API with Authentication...\n');
    
    if (AUTH_TOKEN === 'YOUR_VALID_JWT_TOKEN_HERE') {
      console.log('❌ Please update AUTH_TOKEN with a valid JWT token');
      console.log('   You can get this from your frontend after logging in');
      console.log('   Or use the login API to get a fresh token\n');
      return;
    }
    
    // Test 1: GET /api/payroll with auth (should work)
    console.log('📞 Test 1: GET /api/payroll (with auth)');
    try {
      const response = await axios.get(`${BASE_URL}/payroll`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ GET /api/payroll - Success');
      console.log('   Status:', response.status);
      console.log('   Data length:', response.data.data?.length || 0);
      console.log('   Total items:', response.data.pagination?.totalItems || 0);
    } catch (error) {
      console.log('❌ GET /api/payroll - Failed');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
      
      if (error.response?.status === 401) {
        console.log('   💡 This means the token is invalid or expired');
      } else if (error.response?.status === 403) {
        console.log('   💡 This means the user lacks required permissions');
      }
    }
    
    console.log('');
    
    // Test 2: Check user permissions
    console.log('📞 Test 2: Check user permissions');
    try {
      const response = await axios.get(`${BASE_URL}/payroll/stats`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ User has access to payroll stats');
    } catch (error) {
      console.log('❌ User cannot access payroll stats');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Instructions for getting a valid token
function showInstructions() {
  console.log('📋 How to get a valid JWT token:');
  console.log('');
  console.log('1. Open your frontend application');
  console.log('2. Login with valid credentials');
  console.log('3. Open browser DevTools (F12)');
  console.log('4. Go to Network tab');
  console.log('5. Make any API request');
  console.log('6. Look for the Authorization header in the request');
  console.log('7. Copy the token (remove "Bearer " prefix)');
  console.log('8. Update AUTH_TOKEN in this script');
  console.log('');
  console.log('Alternative: Use the login API endpoint');
  console.log('POST /api/auth/login with username/password');
  console.log('');
}

// Run the test
if (require.main === module) {
  if (AUTH_TOKEN === 'YOUR_VALID_JWT_TOKEN_HERE') {
    showInstructions();
  } else {
    testWithAuth();
  }
}

module.exports = { testWithAuth, showInstructions };
