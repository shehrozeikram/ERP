const mongoose = require('mongoose');
const LeaveManagementService = require('../services/leaveManagementService');
require('dotenv').config();

async function initializeLeaveManagement() {
  try {
    console.log('🚀 Initializing Leave Management System...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Initialize default leave types
    console.log('📋 Creating default leave types...');
    await LeaveManagementService.initializeDefaultLeaveTypes();
    console.log('✅ Default leave types created');

    // Initialize default leave policy
    console.log('📋 Creating default leave policy...');
    const LeavePolicy = require('../models/hr/LeavePolicy');
    
    // Check if default policy already exists
    const existingPolicy = await LeavePolicy.findOne({ isDefault: true });
    if (!existingPolicy) {
      // Create a default policy with a dummy createdBy (we'll use the first admin user or create a system user)
      const User = require('../models/User');
      let systemUser = await User.findOne({ role: 'admin' });
      
      if (!systemUser) {
        // Create a system user for initialization
        systemUser = new User({
          firstName: 'System',
          lastName: 'Admin',
          email: 'system@sgc.com',
          password: 'temp123', // This will be hashed
          role: 'admin',
          isActive: true
        });
        await systemUser.save();
        console.log('✅ Created system admin user for initialization');
      }
      
      const defaultPolicy = new LeavePolicy({
        name: 'Default Leave Policy',
        description: 'Default leave policy for all employees',
        leaveAllocation: {
          annual: {
            days: 14,
            accrualMethod: 'yearly',
            carryForward: {
              allowed: true,
              maxDays: 7,
              expiryMonths: 12
            }
          },
          casual: {
            days: 10,
            accrualMethod: 'yearly',
            carryForward: {
              allowed: false,
              maxDays: 0
            }
          },
          medical: {
            days: 8,
            accrualMethod: 'yearly',
            carryForward: {
              allowed: false,
              maxDays: 0
            },
            requiresCertificate: true,
            certificateRequiredAfterDays: 3
          }
        },
        probationRules: {
          duration: 3,
          leaveEligibility: 'reduced_leave',
          reducedLeavePercentage: 50
        },
        applicationRules: {
          advanceNoticeDays: 1,
          emergencyLeaveAllowed: true,
          maxConsecutiveDays: 30,
          maxLeaveDaysPerMonth: 5,
          requireManagerApproval: true,
          requireHRApproval: false,
          autoApproveDays: 0
        },
        workingDays: {
          daysPerWeek: 6,
          workingDaysPerMonth: 26,
          excludeWeekends: true,
          excludeHolidays: true
        },
        effectiveFrom: new Date(),
        applicableTo: {
          employmentTypes: ['permanent', 'contract', 'probation'],
          departments: [],
          designations: []
        },
        isActive: true,
        isDefault: true,
        createdBy: systemUser._id
      });
      
      await defaultPolicy.save();
      console.log('✅ Default leave policy created');
    } else {
      console.log('✅ Default leave policy already exists');
    }

    // Update existing employees with new leave balance structure
    console.log('👥 Updating existing employees with new leave balance structure...');
    const Employee = require('../models/hr/Employee');
    const employees = await Employee.find({ isActive: true });
    
    let updatedCount = 0;
    for (const employee of employees) {
      // Check if employee already has the new leave balance structure
      if (!employee.leaveBalance.annual.allocated) {
        // Update with new structure
        await Employee.findByIdAndUpdate(employee._id, {
          $set: {
            'leaveBalance.annual.allocated': 14,
            'leaveBalance.annual.used': 0,
            'leaveBalance.annual.remaining': 14,
            'leaveBalance.annual.carriedForward': 0,
            'leaveBalance.casual.allocated': 10,
            'leaveBalance.casual.used': 0,
            'leaveBalance.casual.remaining': 10,
            'leaveBalance.casual.carriedForward': 0,
            'leaveBalance.medical.allocated': 8,
            'leaveBalance.medical.used': 0,
            'leaveBalance.medical.remaining': 8,
            'leaveBalance.medical.carriedForward': 0,
            'leaveBalance.maternity.allocated': 0,
            'leaveBalance.maternity.used': 0,
            'leaveBalance.maternity.remaining': 0,
            'leaveBalance.paternity.allocated': 0,
            'leaveBalance.paternity.used': 0,
            'leaveBalance.paternity.remaining': 0,
            lastLeaveBalanceUpdate: new Date()
          }
        });
        updatedCount++;
      }
    }
    
    console.log(`✅ Updated ${updatedCount} employees with new leave balance structure`);

    console.log('🎉 Leave Management System initialized successfully!');
    console.log('');
    console.log('📊 System Features:');
    console.log('   • Annual Leave: 14 days per year');
    console.log('   • Casual Leave: 10 days per year');
    console.log('   • Medical Leave: 8 days per year');
    console.log('   • Leave carry forward support');
    console.log('   • Integration with payroll system');
    console.log('   • Integration with attendance system');
    console.log('   • Approval workflow');
    console.log('   • Leave calendar and reports');
    console.log('');
    console.log('🔗 Access the system at:');
    console.log('   • Employee: /hr/leaves');
    console.log('   • HR Manager: /hr/leaves/approval');
    console.log('   • Calendar: /hr/leaves/calendar');
    console.log('   • Reports: /hr/leaves/reports');

  } catch (error) {
    console.error('❌ Error initializing Leave Management System:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the initialization
initializeLeaveManagement();
