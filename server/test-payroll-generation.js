/**
 * Test script for payroll generation API
 * This script tests the new payroll generation route
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

// Test data
const testPayload = {
  month: 12, // December
  year: 2024,
  forceRegenerate: false
};

async function testPayrollGeneration() {
  try {
    console.log('🚀 Testing Payroll Generation API...');
    console.log('📊 Test Payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await axios.post(`${BASE_URL}/payroll`, testPayload, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 Payroll Generation Successful!');
      console.log(`📈 Generated ${response.data.data.summary.totalEmployees} payrolls`);
      console.log(`💰 Total Gross Salary: Rs. ${response.data.data.summary.totalGrossSalary.toLocaleString()}`);
      console.log(`💰 Total Net Salary: Rs. ${response.data.data.summary.totalNetSalary.toLocaleString()}`);
      console.log(`💰 Total Tax: Rs. ${response.data.data.summary.totalTax.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('❌ API Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testPayrollGeneration();
}

module.exports = { testPayrollGeneration };
