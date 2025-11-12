const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const Department = require('../models/hr/Department');

/**
 * Script to create employee 6387 and manage their approved leaves
 */

async function createEmployee6387() {
  try {
    console.log('🚀 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority');
    console.log('✅ Connected to database');
    
    // Check if employee 6387 already exists
    let employee = await Employee.findOne({ employeeId: '6387' });
    
    if (!employee) {
      console.log('👤 Creating employee 6387...');
      
      // Get or create IT department
      let department = await Department.findOne({ name: 'IT' });
      if (!department) {
        department = new Department({
          name: 'IT',
          description: 'Information Technology Department',
          isActive: true
        });
        await department.save();
        console.log('✅ Created IT department');
      }
      
      // Create employee 6387 with minimal required fields
      employee = new Employee({
        employeeId: '6387',
        firstName: 'Test',
        lastName: 'Employee',
        email: 'test.employee6387@sgc.com',
        phone: '+92-300-1234567',
        hireDate: new Date('2021-10-21'),
        joiningDate: new Date('2021-10-21'),
        appointmentDate: new Date('2021-10-21'),
        dateOfBirth: new Date('1990-01-01'),
        gender: 'Male',
        nationality: 'Pakistani',
        idCard: '12345-1234567-1',
        probationPeriodMonths: 3,
        employmentType: 'Full Time',
        employmentStatus: 'Active',
        bankName: 'Test Bank',
        bankAccountNumber: '1234567890',
        qualification: 'Bachelor Degree',
        department: department._id,
        designation: 'Software Developer',
        isActive: true,
        isDeleted: false,
        address: {
          street: '123 Test Street',
          city: 'Karachi',
          state: 'Sindh',
          country: 'Pakistan'
        },
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '+92-300-9876543',
          relationship: 'Brother'
        },
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
    
    return employee;
    
  } catch (error) {
    console.error('❌ Error creating employee 6387:', error);
    throw error;
  }
}

async function removeApprovedLeavesForEmployee6387() {
  try {
    console.log('🚀 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority');
    console.log('✅ Connected to database');
    
    // Find employee 6387
    const employee = await Employee.findOne({ employeeId: '6387' });
    if (!employee) {
      console.log('❌ Employee 6387 not found. Please create the employee first.');
      return;
    }
    
    console.log(`👤 Found employee 6387: ${employee.firstName} ${employee.lastName}`);
    
    // Find approved leave requests for employee 6387
    const approvedLeaves = await LeaveRequest.find({
      employee: employee._id,
      status: 'approved',
      isActive: true
    }).populate('leaveType', 'name code').sort({ startDate: 1 });
    
    console.log(`\n📋 Found ${approvedLeaves.length} approved leave requests for employee 6387:`);
    
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
    
    console.log('\n⚠️  WARNING: This will permanently remove all approved leave requests for employee 6387');
    console.log('This action will:');
    console.log('1. Mark all approved leave requests as inactive');
    console.log('2. Restore leave balance (add back the used days)');
    console.log('3. Remove attendance records created for these leaves');
    console.log('4. This action cannot be undone!');
    
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
        
        console.log(`\n🎉 Successfully removed ${approvedLeaves.length} approved leave requests for employee 6387`);
        console.log(`📊 Total days restored: ${totalDaysRestored}`);
        
        // Show updated leave balance
        console.log('\n📈 Updated Leave Balance for Employee 6387:');
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

// Main function to run the script
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'create') {
    await createEmployee6387();
  } else if (command === 'remove') {
    await removeApprovedLeavesForEmployee6387();
  } else {
    console.log('Usage:');
    console.log('  node server/scripts/employee6387Manager.js create  - Create employee 6387');
    console.log('  node server/scripts/employee6387Manager.js remove  - Remove approved leaves for employee 6387');
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createEmployee6387, removeApprovedLeavesForEmployee6387 };
