const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

/**
 * Script to check and remove approved leaves for employee 6387
 */

async function checkAndRemoveEmployee6387Leaves() {
  try {
    console.log('🚀 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority');
    console.log('✅ Connected to database');
    
    // Find employee 6387
    const employee = await Employee.findOne({ employeeId: '6387' });
    if (!employee) {
      console.log('❌ Employee 6387 not found');
      return;
    }
    
    console.log(`👤 Employee 6387 found: ${employee.firstName} ${employee.lastName}`);
    console.log(`📅 Hire Date: ${employee.hireDate}`);
    
    // Find all approved leave requests for this employee
    const approvedLeaves = await LeaveRequest.find({
      employee: employee._id,
      status: 'approved',
      isActive: true
    }).populate('leaveType', 'name code').sort({ startDate: 1 });
    
    console.log(`\n📋 Found ${approvedLeaves.length} approved leave requests:`);
    
    if (approvedLeaves.length === 0) {
      console.log('✅ No approved leave requests found for employee 6387');
      return;
    }
    
    // Display all approved leaves
    approvedLeaves.forEach((leave, index) => {
      console.log(`\n${index + 1}. Leave Request ID: ${leave._id}`);
      console.log(`   Type: ${leave.leaveType.name} (${leave.leaveType.code})`);
      console.log(`   Period: ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()}`);
      console.log(`   Days: ${leave.totalDays}`);
      console.log(`   Reason: ${leave.reason}`);
      console.log(`   Applied: ${leave.appliedDate.toDateString()}`);
      console.log(`   Approved: ${leave.approvedDate?.toDateString() || 'N/A'}`);
    });
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently remove all approved leave requests for employee 6387');
    console.log('This action will:');
    console.log('1. Mark all approved leave requests as inactive');
    console.log('2. Restore leave balance (add back the used days)');
    console.log('3. Remove attendance records created for these leaves');
    console.log('4. This action cannot be undone!');
    
    // For automated execution, we'll proceed with the removal
    console.log('\n🔄 Proceeding with removal...');
    
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        let totalDaysRestored = 0;
        
        for (const leave of approvedLeaves) {
          console.log(`\n🗑️  Removing leave: ${leave.leaveType.name} (${leave.totalDays} days)`);
          
          // Mark leave as inactive
          leave.isActive = false;
          leave.status = 'cancelled';
          leave.cancelledDate = new Date();
          leave.cancellationReason = 'Removed by admin - employee 6387 cleanup';
          await leave.save({ session });
          
          // Restore leave balance
          const typeMap = {
            'ANNUAL': 'annual',
            'AL': 'annual',
            'SICK': 'sick',
            'SL': 'sick',
            'CASUAL': 'casual',
            'CL': 'casual',
            'MEDICAL': 'medical',
            'ML': 'medical'
          };
          
          const balanceType = typeMap[leave.leaveType.code] || 'casual';
          
          // Update employee's leave balance
          if (employee.leaveBalance && employee.leaveBalance[balanceType]) {
            employee.leaveBalance[balanceType].used = Math.max(0, 
              employee.leaveBalance[balanceType].used - leave.totalDays
            );
            employee.leaveBalance[balanceType].remaining = 
              employee.leaveBalance[balanceType].allocated + 
              employee.leaveBalance[balanceType].carriedForward - 
              employee.leaveBalance[balanceType].used;
            
            totalDaysRestored += leave.totalDays;
            console.log(`   ✅ Restored ${leave.totalDays} days to ${balanceType} leave balance`);
          }
          
          // Remove attendance records if they exist
          if (leave.attendanceRecords && leave.attendanceRecords.length > 0) {
            const Attendance = mongoose.model('Attendance');
            await Attendance.deleteMany({
              _id: { $in: leave.attendanceRecords }
            }).session(session);
            console.log(`   ✅ Removed ${leave.attendanceRecords.length} attendance records`);
          }
        }
        
        // Save updated employee
        employee.lastLeaveBalanceUpdate = new Date();
        await employee.save({ session });
        
        console.log(`\n🎉 Successfully removed ${approvedLeaves.length} approved leave requests`);
        console.log(`📊 Total days restored: ${totalDaysRestored}`);
        
        // Show updated leave balance
        console.log('\n📈 Updated Leave Balance:');
        console.log(`   Annual: ${employee.leaveBalance.annual.remaining}/${employee.leaveBalance.annual.allocated + employee.leaveBalance.annual.carriedForward}`);
        console.log(`   Casual: ${employee.leaveBalance.casual.remaining}/${employee.leaveBalance.casual.allocated + employee.leaveBalance.casual.carriedForward}`);
        console.log(`   Sick: ${employee.leaveBalance.sick.remaining}/${employee.leaveBalance.sick.allocated + employee.leaveBalance.sick.carriedForward}`);
        console.log(`   Medical: ${employee.leaveBalance.medical.remaining}/${employee.leaveBalance.medical.allocated + employee.leaveBalance.medical.carriedForward}`);
      });
      
    } catch (error) {
      console.error('❌ Error during transaction:', error);
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  checkAndRemoveEmployee6387Leaves()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = checkAndRemoveEmployee6387Leaves;
