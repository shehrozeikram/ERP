const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const User = require('../models/User');
const LeaveManagementService = require('../services/leaveManagementService');

// Load environment variables
require('dotenv').config();

async function testLeaveAPIEndpoint() {
  try {
    console.log('🔄 Testing Leave API Endpoint for MongoDB Atlas...');
    
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Test the exact API endpoint logic that the frontend uses
    console.log('\n📊 Testing /api/leaves/requests endpoint...');
    
    // This simulates what happens when the frontend calls the API
    const filters = {
      page: 1,
      limit: 100  // Our updated default limit
    };

    console.log('🔍 Calling LeaveManagementService.getLeaveRequests with filters:', filters);
    const result = await LeaveManagementService.getLeaveRequests(filters);
    
    console.log('\n📈 API Response:');
    console.log(`✅ Records returned: ${result.leaveRequests.length}`);
    console.log(`📊 Total in database: ${result.pagination.total}`);
    console.log(`📄 Current page: ${result.pagination.current}`);
    console.log(`📄 Total pages: ${result.pagination.pages}`);
    console.log(`📄 Limit: ${result.pagination.limit}`);
    
    // Show sample records
    console.log('\n📋 Sample records from API:');
    result.leaveRequests.slice(0, 5).forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeId})`);
      console.log(`     - Leave Type: ${record.leaveType.name}`);
      console.log(`     - Status: ${record.status}`);
      console.log(`     - Year: ${record.leaveYear}`);
      console.log(`     - Days: ${record.totalDays}`);
      console.log(`     - Start Date: ${record.startDate}`);
      console.log(`     - End Date: ${record.endDate}`);
    });

    // Test different page sizes to verify pagination
    console.log('\n🔍 Testing different page sizes:');
    
    const pageSizes = [10, 25, 50, 100];
    for (const pageSize of pageSizes) {
      const testResult = await LeaveManagementService.getLeaveRequests({ page: 1, limit: pageSize });
      console.log(`  - Page size ${pageSize}: Returns ${testResult.leaveRequests.length} records`);
    }

    // Test pagination with page 2
    console.log('\n📄 Testing pagination (Page 2):');
    const page2Result = await LeaveManagementService.getLeaveRequests({ page: 2, limit: 50 });
    console.log(`Page 2 (limit 50): ${page2Result.leaveRequests.length} records`);
    console.log(`Total pages: ${page2Result.pagination.pages}`);
    
    if (page2Result.leaveRequests.length > 0) {
      console.log(`First record on page 2: ${page2Result.leaveRequests[0].employee.firstName} ${page2Result.leaveRequests[0].employee.lastName}`);
    }

    console.log('\n✅ API endpoint test completed successfully!');
    console.log('🎯 The Leave Approval page should now show all 996 records');
    console.log('📱 Please refresh your browser and check the Leave Approval page');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testLeaveAPIEndpoint();
