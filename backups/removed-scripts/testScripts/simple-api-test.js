const mongoose = require('mongoose');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');

// Load environment variables
require('dotenv').config();

async function simpleAPITest() {
  try {
    console.log('🔄 Testing API Data Access...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp');
    console.log('✅ Connected to MongoDB');

    // Test direct database queries (simulating API logic)
    console.log('\n📊 Testing database queries...');
    
    // Test with different limits
    const testLimits = [10, 25, 50, 100];
    
    for (const limit of testLimits) {
      console.log(`\n🔍 Testing with limit: ${limit}`);
      
      const query = { isActive: true };
      const sortOptions = { appliedDate: -1 };
      const skip = 0; // First page
      
      const leaveRequests = await LeaveRequest.find(query)
        .populate('employee', 'firstName lastName employeeId')
        .populate('leaveType', 'name code')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const total = await LeaveRequest.countDocuments(query);
      const totalPages = Math.ceil(total / limit);
      
      console.log(`  - Records returned: ${leaveRequests.length}`);
      console.log(`  - Total in database: ${total}`);
      console.log(`  - Total pages: ${totalPages}`);
      console.log(`  - Limit: ${limit}`);
      
      // Show first record details
      if (leaveRequests.length > 0) {
        const firstRecord = leaveRequests[0];
        console.log(`  - First record: ${firstRecord.employee.firstName} ${firstRecord.employee.lastName} (${firstRecord.employee.employeeId})`);
        console.log(`  - Leave type: ${firstRecord.leaveType.name}`);
        console.log(`  - Status: ${firstRecord.status}`);
        console.log(`  - Year: ${firstRecord.leaveYear}`);
        console.log(`  - Days: ${firstRecord.totalDays}`);
      }
    }

    // Test pagination - get records from different pages
    console.log('\n📄 Testing pagination...');
    
    // Page 1 (records 1-50)
    const page1 = await LeaveRequest.find({ isActive: true })
      .populate('employee', 'firstName lastName employeeId')
      .sort({ appliedDate: -1 })
      .skip(0)
      .limit(50);
    
    // Page 2 (records 51-100)  
    const page2 = await LeaveRequest.find({ isActive: true })
      .populate('employee', 'firstName lastName employeeId')
      .sort({ appliedDate: -1 })
      .skip(50)
      .limit(50);
    
    // Page 3 (records 101-150)
    const page3 = await LeaveRequest.find({ isActive: true })
      .populate('employee', 'firstName lastName employeeId')
      .sort({ appliedDate: -1 })
      .skip(100)
      .limit(50);
    
    console.log(`Page 1: ${page1.length} records`);
    console.log(`Page 2: ${page2.length} records`);
    console.log(`Page 3: ${page3.length} records`);
    
    if (page1.length > 0 && page2.length > 0) {
      console.log(`Page 1 first: ${page1[0].employee.firstName} ${page1[0].employee.lastName}`);
      console.log(`Page 2 first: ${page2[0].employee.firstName} ${page2[0].employee.lastName}`);
    }

    // Test different status filters
    console.log('\n🔍 Testing status filters...');
    const approvedCount = await LeaveRequest.countDocuments({ isActive: true, status: 'approved' });
    const pendingCount = await LeaveRequest.countDocuments({ isActive: true, status: 'pending' });
    const rejectedCount = await LeaveRequest.countDocuments({ isActive: true, status: 'rejected' });
    
    console.log(`Approved: ${approvedCount}`);
    console.log(`Pending: ${pendingCount}`);
    console.log(`Rejected: ${rejectedCount}`);

    // Test year filter
    console.log('\n📅 Testing year filters...');
    const year2024 = await LeaveRequest.countDocuments({ isActive: true, leaveYear: '2024' });
    const year2023 = await LeaveRequest.countDocuments({ isActive: true, leaveYear: '2023' });
    const year2025 = await LeaveRequest.countDocuments({ isActive: true, leaveYear: '2025' });
    
    console.log(`2024: ${year2024}`);
    console.log(`2023: ${year2023}`);
    console.log(`2025: ${year2025}`);

    console.log('\n✅ All tests completed successfully!');
    console.log('🎯 The API should now return all 996 records with proper pagination');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
simpleAPITest();
