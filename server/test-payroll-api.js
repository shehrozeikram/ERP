/**
 * Simple test script to check payroll API endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';

async function testPayrollEndpoints() {
  try {
    console.log('🚀 Testing Payroll API Endpoints...\n');
    
    // Test 1: GET /api/payroll (should work)
    console.log('📞 Test 1: GET /api/payroll');
    try {
      const response = await axios.get(`${BASE_URL}/payroll`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ GET /api/payroll - Success');
      console.log('   Status:', response.status);
      console.log('   Data length:', response.data.data?.length || 0);
    } catch (error) {
      console.log('❌ GET /api/payroll - Failed');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
    }
    
    console.log('');
    
    // Test 2: POST /api/payroll without auth (should fail)
    console.log('📞 Test 2: POST /api/payroll (without auth)');
    try {
      const response = await axios.post(`${BASE_URL}/payroll`, {
        month: 12,
        year: 2024
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ POST /api/payroll - Should have failed but succeeded');
      console.log('   Status:', response.status);
    } catch (error) {
      console.log('✅ POST /api/payroll - Failed as expected (no auth)');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
    }
    
    console.log('');
    
    // Test 3: POST /api/payroll with invalid data (should fail validation)
    console.log('📞 Test 3: POST /api/payroll (with invalid data)');
    try {
      const response = await axios.post(`${BASE_URL}/payroll`, {
        month: 13, // Invalid month
        year: 2024
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ POST /api/payroll - Should have failed validation but succeeded');
      console.log('   Status:', response.status);
    } catch (error) {
      console.log('✅ POST /api/payroll - Failed validation as expected');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
      if (error.response?.data?.errors) {
        console.log('   Validation Errors:', error.response.data.errors);
      }
    }
    
    console.log('');
    
    // Test 4: Check if there are any existing payrolls
    console.log('📊 Current Payroll Status:');
    try {
      const response = await axios.get(`${BASE_URL}/payroll`);
      const payrollCount = response.data.data?.length || 0;
      console.log(`   Total Payrolls: ${payrollCount}`);
      
      if (payrollCount > 0) {
        console.log('   Sample Payrolls:');
        response.data.data.slice(0, 3).forEach((payroll, index) => {
          console.log(`     ${index + 1}. Employee: ${payroll.employee?.firstName || 'N/A'} ${payroll.employee?.lastName || 'N/A'}`);
          console.log(`        Month/Year: ${payroll.month}/${payroll.year}`);
          console.log(`        Status: ${payroll.status}`);
        });
      } else {
        console.log('   No payrolls found - database is clean');
      }
    } catch (error) {
      console.log('   ❌ Could not fetch payroll status');
      console.log('   Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testPayrollEndpoints();
}

module.exports = { testPayrollEndpoints };
