const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveManagementService = require('../services/leaveManagementService');

// Load environment variables
require('dotenv').config();

async function testLeaveAPI() {
  try {
    console.log('🔄 Testing Leave API...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to MongoDB');

    // Test the getLeaveRequests method directly
    const filters = {
      page: 1,
      limit: 100
    };

    console.log('📊 Testing getLeaveRequests with filters:', filters);
    const result = await LeaveManagementService.getLeaveRequests(filters);
    
    console.log('📈 Results:');
    console.log('  - Leave requests returned:', result.leaveRequests.length);
    console.log('  - Total in database:', result.pagination.total);
    console.log('  - Current page:', result.pagination.current);
    console.log('  - Total pages:', result.pagination.pages);
    console.log('  - Limit:', result.pagination.limit);

    // Show sample records
    console.log('\n📋 Sample records:');
    result.leaveRequests.slice(0, 5).forEach((record, index) => {
      console.log('  ' + (index + 1) + '. ' + 
        record.employee.firstName + ' ' + record.employee.lastName + 
        ' (' + record.employee.employeeId + ') - ' + 
        record.leaveType.name + ' - ' + record.totalDays + ' days - ' + 
        record.status + ' - ' + record.leaveYear);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
testLeaveAPI();

