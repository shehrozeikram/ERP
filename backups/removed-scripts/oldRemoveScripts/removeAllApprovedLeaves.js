const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');

/**
 * Script to find and remove approved leaves for any employee
 */

async function findAndRemoveApprovedLeaves() {
  try {
    console.log('🚀 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');
    
    // Find all approved leave requests across all employees
    const approvedLeaves = await LeaveRequest.find({
      status: 'approved',
      isActive: true
    })
    .populate('employee', 'employeeId firstName lastName')
    .populate('leaveType', 'name code')
    .sort({ startDate: 1 });
    
    console.log(`\n📋 Found ${approvedLeaves.length} approved leave requests across all employees:`);
    
    if (approvedLeaves.length === 0) {
      console.log('✅ No approved leave requests found in the system');
      return;
    }
    
    // Group by employee
    const leavesByEmployee = {};
    approvedLeaves.forEach(leave => {
      const empId = leave.employee.employeeId;
      if (!leavesByEmployee[empId]) {
        leavesByEmployee[empId] = {
          employee: leave.employee,
          leaves: []
        };
      }
      leavesByEmployee[empId].leaves.push(leave);
    });
    
    // Display leaves by employee
    Object.keys(leavesByEmployee).forEach(empId => {
      const empData = leavesByEmployee[empId];
      console.log(`\n👤 Employee ${empId}: ${empData.employee.firstName} ${empData.employee.lastName}`);
      console.log(`   📅 Found ${empData.leaves.length} approved leave requests:`);
      
      empData.leaves.forEach((leave, index) => {
        console.log(`   ${index + 1}. ${leave.leaveType.name} (${leave.leaveType.code})`);
        console.log(`      Period: ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()}`);
        console.log(`      Days: ${leave.totalDays}`);
        console.log(`      Reason: ${leave.reason}`);
        console.log(`      Applied: ${leave.appliedDate.toDateString()}`);
        console.log(`      Approved: ${leave.approvedDate?.toDateString() || 'N/A'}`);
        console.log(`      Leave ID: ${leave._id}`);
      });
    });
    
    // Ask for specific employee or all employees
    console.log('\n🔧 Options to remove approved leaves:');
    console.log('1. Remove leaves for a specific employee (provide employee ID)');
    console.log('2. Remove all approved leaves for all employees');
    console.log('3. Exit without removing anything');
    
    // For this demo, let's remove all approved leaves
    console.log('\n⚠️  WARNING: This will remove ALL approved leave requests!');
    console.log('This action will:');
    console.log('1. Mark all approved leave requests as inactive');
    console.log('2. Restore leave balance (add back the used days)');
    console.log('3. Remove attendance records created for these leaves');
    console.log('4. This action cannot be undone!');
    
    console.log('\n🔄 Proceeding with removal of all approved leaves...');
    
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        let totalLeavesRemoved = 0;
        let totalDaysRestored = 0;
        
        for (const leave of approvedLeaves) {
          console.log(`\n🗑️  Removing leave: ${leave.employee.employeeId} - ${leave.leaveType.name} (${leave.totalDays} days)`);
          
          // Mark leave as inactive
          leave.isActive = false;
          leave.status = 'cancelled';
          leave.cancelledDate = new Date();
          leave.cancellationReason = 'Removed by admin - bulk cleanup';
          await leave.save({ session });
          
          // Get employee to update balance
          const employee = await Employee.findById(leave.employee._id).session(session);
          if (employee && employee.leaveBalance) {
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
            
            if (employee.leaveBalance[balanceType]) {
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
            
            // Save updated employee
            employee.lastLeaveBalanceUpdate = new Date();
            await employee.save({ session });
          }
          
          // Remove attendance records if they exist
          if (leave.attendanceRecords && leave.attendanceRecords.length > 0) {
            const Attendance = mongoose.model('Attendance');
            await Attendance.deleteMany({
              _id: { $in: leave.attendanceRecords }
            }).session(session);
            console.log(`   ✅ Removed ${leave.attendanceRecords.length} attendance records`);
          }
          
          totalLeavesRemoved++;
        }
        
        console.log(`\n🎉 Successfully removed ${totalLeavesRemoved} approved leave requests`);
        console.log(`📊 Total days restored: ${totalDaysRestored}`);
        
        // Show summary by employee
        console.log('\n📈 Updated Leave Balances by Employee:');
        const updatedEmployees = await Employee.find({
          _id: { $in: Object.values(leavesByEmployee).map(emp => emp.employee._id) }
        }).session(session);
        
        updatedEmployees.forEach(emp => {
          console.log(`\n👤 Employee ${emp.employeeId}: ${emp.firstName} ${emp.lastName}`);
          console.log(`   Annual: ${emp.leaveBalance.annual.remaining}/${emp.leaveBalance.annual.allocated + emp.leaveBalance.annual.carriedForward}`);
          console.log(`   Casual: ${emp.leaveBalance.casual.remaining}/${emp.leaveBalance.casual.allocated + emp.leaveBalance.casual.carriedForward}`);
          console.log(`   Sick: ${emp.leaveBalance.sick.remaining}/${emp.leaveBalance.sick.allocated + emp.leaveBalance.sick.carriedForward}`);
          console.log(`   Medical: ${emp.leaveBalance.medical.remaining}/${emp.leaveBalance.medical.allocated + emp.leaveBalance.medical.carriedForward}`);
        });
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
  findAndRemoveApprovedLeaves()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = findAndRemoveApprovedLeaves;
