const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');

/**
 * Script to create employee 6387 and check for approved leaves
 */

async function createEmployee6387AndCheckLeaves() {
  try {
    console.log('🚀 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');
    
    // Check if employee 6387 already exists
    let employee = await Employee.findOne({ employeeId: '6387' });
    
    if (!employee) {
      console.log('👤 Creating employee 6387...');
      
      // Create employee 6387 with hire date 2021-10-21 as specified in requirements
      employee = new Employee({
        employeeId: '6387',
        firstName: 'Test',
        lastName: 'Employee',
        email: 'test.employee6387@sgc.com',
        phone: '+92-300-1234567',
        hireDate: new Date('2021-10-21'),
        joiningDate: new Date('2021-10-21'),
        isActive: true,
        isDeleted: false,
        department: 'IT',
        designation: 'Software Developer',
        employmentType: 'permanent',
        employmentStatus: 'active',
        leaveConfig: {
          annualLimit: 20,
          sickLimit: 10,
          casualLimit: 10,
          useGlobalDefaults: false
        },
        leaveBalance: {
          annual: { allocated: 20, used: 0, remaining: 20, carriedForward: 0, advance: 0 },
          casual: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 },
          sick: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 },
          medical: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 }
        }
      });
      
      await employee.save();
      console.log('✅ Employee 6387 created successfully');
    } else {
      console.log('👤 Employee 6387 already exists');
    }
    
    console.log(`📅 Hire Date: ${employee.hireDate}`);
    console.log(`📊 Current Leave Balance:`);
    console.log(`   Annual: ${employee.leaveBalance.annual.remaining}/${employee.leaveBalance.annual.allocated}`);
    console.log(`   Casual: ${employee.leaveBalance.casual.remaining}/${employee.leaveBalance.casual.allocated}`);
    console.log(`   Sick: ${employee.leaveBalance.sick.remaining}/${employee.leaveBalance.sick.allocated}`);
    console.log(`   Medical: ${employee.leaveBalance.medical.remaining}/${employee.leaveBalance.medical.allocated}`);
    
    // Check for any approved leave requests
    const approvedLeaves = await LeaveRequest.find({
      employee: employee._id,
      status: 'approved',
      isActive: true
    }).populate('leaveType', 'name code').sort({ startDate: 1 });
    
    console.log(`\n📋 Found ${approvedLeaves.length} approved leave requests:`);
    
    if (approvedLeaves.length === 0) {
      console.log('✅ No approved leave requests found for employee 6387');
      console.log('🎉 Employee 6387 is ready for testing the annual leave system!');
    } else {
      console.log('\n⚠️  Found approved leave requests that need to be removed:');
      
      approvedLeaves.forEach((leave, index) => {
        console.log(`\n${index + 1}. Leave Request ID: ${leave._id}`);
        console.log(`   Type: ${leave.leaveType.name} (${leave.leaveType.code})`);
        console.log(`   Period: ${leave.startDate.toDateString()} to ${leave.endDate.toDateString()}`);
        console.log(`   Days: ${leave.totalDays}`);
        console.log(`   Reason: ${leave.reason}`);
        console.log(`   Applied: ${leave.appliedDate.toDateString()}`);
        console.log(`   Approved: ${leave.approvedDate?.toDateString() || 'N/A'}`);
      });
      
      console.log('\n🔄 Removing approved leave requests...');
      
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
  createEmployee6387AndCheckLeaves()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = createEmployee6387AndCheckLeaves;
