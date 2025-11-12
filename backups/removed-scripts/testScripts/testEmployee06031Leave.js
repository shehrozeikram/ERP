const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveManagementService = require('../services/leaveManagementService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

async function testEmployee06031Leave() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    // Find employee 06031
    console.log('\n🔍 Finding employee 06031...');
    const employee = await Employee.findOne({ employeeId: '06031' });
    
    if (!employee) {
      console.log('❌ Employee 06031 not found');
      return;
    }
    
    console.log('✅ Found employee:', employee.firstName, employee.lastName);
    console.log('📅 Hire Date:', employee.hireDate);
    console.log('📅 Joining Date:', employee.joiningDate);
    
    // Calculate work year
    const workYear = LeaveIntegrationService.calculateWorkYear(employee.hireDate || employee.joiningDate);
    console.log('\n📊 Work Year:', workYear);
    
    // Get leave balance
    console.log('\n📊 Getting leave balance...');
    const balance = await LeaveIntegrationService.getWorkYearBalance(employee._id, workYear);
    console.log('✅ Leave Balance:', balance.getSummary());
    
    // Find Casual leave type
    console.log('\n🔍 Finding Casual leave type...');
    const casualLeaveType = await LeaveType.findOne({ code: 'CASUAL' });
    
    if (!casualLeaveType) {
      console.log('❌ Casual leave type not found');
      return;
    }
    
    console.log('✅ Found leave type:', casualLeaveType.name);
    
    // Try to create a Casual leave request for 2025-10-27
    console.log('\n📝 Creating Casual leave for 2025-10-27...');
    
    const leaveData = {
      employee: employee._id,
      leaveType: casualLeaveType._id,
      startDate: new Date('2025-10-27'),
      endDate: new Date('2025-10-27'),
      reason: 'Test Casual leave',
      createdBy: employee.user || employee._id,
      leaveYear: 2025,
      workYear: workYear
    };
    
    console.log('📝 Leave Data:', {
      employee: leaveData.employee,
      leaveType: leaveData.leaveType,
      startDate: leaveData.startDate,
      endDate: leaveData.endDate,
      workYear: leaveData.workYear
    });
    
    try {
      const leaveRequest = await LeaveManagementService.applyForLeave(leaveData, employee.user || employee._id);
      console.log('✅ Leave request created successfully:', leaveRequest._id);
      
      // Show the created request
      console.log('\n📝 Created Leave Request:');
      console.log('- Status:', leaveRequest.status);
      console.log('- Total Days:', leaveRequest.totalDays);
      console.log('- Work Year:', leaveRequest.workYear);
      console.log('- Leave Year:', leaveRequest.leaveYear);
      
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
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testEmployee06031Leave();

