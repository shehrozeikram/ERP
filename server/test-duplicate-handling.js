/**
 * Test script to verify duplicate payroll handling
 * This tests the improved duplicate key error handling
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

// Test data
const testPayload = {
  month: 9,
  year: 2025,
  forceRegenerate: false
};

async function testDuplicateHandling() {
  try {
    console.log('🚀 Testing Duplicate Payroll Handling...');
    console.log('📊 Test Payload:', JSON.stringify(testPayload, null, 2));
    
    // First call - should succeed
    console.log('\n📞 First API Call (should succeed):');
    const response1 = await axios.post(`${BASE_URL}/payroll`, testPayload, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ First Call Response:');
    console.log('Status:', response1.status);
    console.log('Success:', response1.data.success);
    console.log('Message:', response1.data.message);
    
    if (response1.data.success) {
      console.log(`📈 Generated ${response1.data.data.summary.totalEmployees} payrolls`);
    }
    
    // Wait a moment
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Second call - should fail with duplicate error
    console.log('\n📞 Second API Call (should fail with duplicate error):');
    try {
      const response2 = await axios.post(`${BASE_URL}/payroll`, testPayload, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('❌ Second call should have failed but succeeded');
      console.log('Response:', response2.data);
      
    } catch (error) {
      if (error.response) {
        console.log('✅ Second Call Failed as Expected:');
        console.log('Status:', error.response.status);
        console.log('Message:', error.response.data.message);
        console.log('Existing Count:', error.response.data.existingCount);
        console.log('Suggestion:', error.response.data.suggestion);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    // Third call - with forceRegenerate: true
    console.log('\n📞 Third API Call (with forceRegenerate: true):');
    const forcePayload = { ...testPayload, forceRegenerate: true };
    
    const response3 = await axios.post(`${BASE_URL}/payroll`, forcePayload, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Third Call Response (Force Regenerate):');
    console.log('Status:', response3.status);
    console.log('Success:', response3.data.success);
    console.log('Message:', response3.data.message);
    
    if (response3.data.success) {
      console.log(`📈 Regenerated ${response3.data.data.summary.totalEmployees} payrolls`);
      if (response3.data.data.skippedEmployees) {
        console.log(`⏭️  Skipped ${response3.data.data.skippedEmployees.length} employees`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testDuplicateHandling();
}

module.exports = { testDuplicateHandling };
