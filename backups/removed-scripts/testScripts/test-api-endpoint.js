const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveManagementService = require('../services/leaveManagementService');

// Load environment variables
require('dotenv').config();

async function testAPIEndpoint() {
  try {
    console.log('🔄 Testing API Endpoint...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to MongoDB');

    // Test the API endpoint logic directly
    console.log('\n📊 Testing /api/leaves/requests endpoint logic...');
    
    // Simulate the API call with different limits
    const testLimits = [10, 25, 50, 100];
    
    for (const limit of testLimits) {
      console.log(`\n🔍 Testing with limit: ${limit}`);
      
      const filters = {
        page: 1,
        limit: limit
      };

      const result = await LeaveManagementService.getLeaveRequests(filters);
      
      console.log(`  - Records returned: ${result.leaveRequests.length}`);
      console.log(`  - Total in database: ${result.pagination.total}`);
      console.log(`  - Current page: ${result.pagination.current}`);
      console.log(`  - Total pages: ${result.pagination.pages}`);
      console.log(`  - Limit: ${result.pagination.limit}`);
      
      // Show first few records
      if (result.leaveRequests.length > 0) {
        console.log(`  - First record: ${result.leaveRequests[0].employee.firstName} ${result.leaveRequests[0].employee.lastName} (${result.leaveRequests[0].employee.employeeId})`);
        console.log(`  - Leave type: ${result.leaveRequests[0].leaveType.name}`);
        console.log(`  - Status: ${result.leaveRequests[0].status}`);
        console.log(`  - Year: ${result.leaveRequests[0].leaveYear}`);
      }
    }

    // Test pagination
    console.log('\n📄 Testing pagination...');
    const page2Result = await LeaveManagementService.getLeaveRequests({ page: 2, limit: 50 });
    console.log(`Page 2 with limit 50:`);
    console.log(`  - Records returned: ${page2Result.leaveRequests.length}`);
    console.log(`  - Total pages: ${page2Result.pagination.pages}`);
    
    const page3Result = await LeaveManagementService.getLeaveRequests({ page: 3, limit: 50 });
    console.log(`Page 3 with limit 50:`);
    console.log(`  - Records returned: ${page3Result.leaveRequests.length}`);
    console.log(`  - Total pages: ${page3Result.pagination.pages}`);

    console.log('\n✅ API endpoint test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
testAPIEndpoint();

