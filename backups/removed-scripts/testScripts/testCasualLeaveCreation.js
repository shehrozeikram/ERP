const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveManagementService = require('../services/leaveManagementService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

async function testCasualLeaveCreation() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    // Get any employee
    console.log('\n🔍 Finding an employee...');
    const employee = await Employee.findOne({ isActive: true, isDeleted: false }).sort({ joiningDate: -1 });
    
    if (!employee) {
      console.log('❌ No active employees found');
      return;
    }
    
    console.log('✅ Found employee:', employee.firstName, employee.lastName);
    console.log('📅 Employee ID:', employee.employeeId);
    console.log('📅 Hire Date:', employee.hireDate);
    console.log('📅 Joining Date:', employee.joiningDate);
    
    // Calculate work year
    const hireDate = employee.hireDate || employee.joiningDate;
    const workYear = LeaveIntegrationService.calculateWorkYear(hireDate);
    console.log('\n📊 Work Year:', workYear);
    console.log('📊 Explanation:', workYear === 0 ? 'Employee is in their first year (no anniversary yet)' : `Employee has completed ${workYear} work year(s)`);
    
    // Get leave balance
    console.log('\n📊 Getting leave balance...');
    const balance = await LeaveIntegrationService.getWorkYearBalance(employee._id, workYear);
    const balanceSummary = balance.getSummary();
    console.log('✅ Leave Balance:', JSON.stringify(balanceSummary, null, 2));
    
    // Find Casual leave type
    console.log('\n🔍 Finding Casual leave type...');
    const casualLeaveType = await LeaveType.findOne({ code: 'CASUAL' });
    
    if (!casualLeaveType) {
      console.log('❌ Casual leave type not found');
      return;
    }
    
    console.log('✅ Found leave type:', casualLeaveType.name, `(${casualLeaveType.code})`);
    
    // Try to create a Casual leave request for 2025-10-27 (future date)
    console.log('\n📝 Creating Casual leave for 2025-10-27 (one day)...');
    
    // Calculate total days
    const startDate = new Date('2025-10-27');
    const endDate = new Date('2025-10-27');
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    const leaveData = {
      employee: employee._id,
      leaveType: casualLeaveType._id,
      startDate: startDate,
      endDate: endDate,
      totalDays: daysDiff,
      reason: 'Test Casual leave creation',
      createdBy: employee.user || employee._id
    };
    
    try {
      const leaveRequest = await LeaveManagementService.applyForLeave(leaveData, employee.user || employee._id);
      console.log('✅ Leave request created successfully!');
      console.log('\n📝 Created Leave Request Details:');
      console.log('- Leave Request ID:', leaveRequest._id);
      console.log('- Employee:', employee.firstName, employee.lastName);
      console.log('- Leave Type:', casualLeaveType.name);
      console.log('- Start Date:', leaveRequest.startDate);
      console.log('- End Date:', leaveRequest.endDate);
      console.log('- Total Days:', leaveRequest.totalDays);
      console.log('- Work Year:', leaveRequest.workYear);
      console.log('- Leave Year:', leaveRequest.leaveYear);
      console.log('- Status:', leaveRequest.status);
      console.log('- Reason:', leaveRequest.reason);
      
      // Verify reset-on-joining logic (no carry forward for non-Annual leaves)
      console.log('\n📊 Verifying reset-on-joining logic...');
      console.log('- Casual Leave Carry Forward:', balanceSummary.casual.carriedForward);
      console.log('- Casual Leave Allocated:', balanceSummary.casual.allocated);
      console.log('- Casual Leave Used:', balanceSummary.casual.used);
      console.log('- Casual Leave Remaining:', balanceSummary.casual.remaining);
      
      if (balanceSummary.casual.carriedForward === 0) {
        console.log('✅ Correct: Casual leave has no carry forward (reset-on-joining logic working)');
      } else {
        console.log('⚠️  Warning: Casual leave has carry forward, which should not happen');
      }
      
    } catch (error) {
      console.log('❌ Error creating leave request:', error.message);
      console.log('Error details:', error);
      
      // Check if it's a validation error
      if (error.name === 'ValidationError') {
        console.log('\n🔍 Validation Errors:');
        Object.keys(error.errors).forEach(key => {
          console.log(`- ${key}: ${error.errors[key].message}`);
        });
      }
      
      throw error;
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testCasualLeaveCreation();

