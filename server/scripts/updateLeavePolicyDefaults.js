/**
 * Script to update Leave Policy defaults to new standard (20, 10, 10)
 * Run this script to update the database with new leave limits
 * 
 * Usage: node server/scripts/updateLeavePolicyDefaults.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const LeavePolicy = require('../models/hr/LeavePolicy');
const LeaveType = require('../models/hr/LeaveType');

async function updateLeavePolicyDefaults() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    // Update Leave Types
    console.log('\n📋 Updating Leave Types...');
    
    const annualLeave = await LeaveType.findOne({ code: 'ANNUAL' });
    if (annualLeave) {
      annualLeave.daysPerYear = 20;
      annualLeave.maxConsecutiveDays = 20;
      annualLeave.maxCarryForwardDays = 10;
      await annualLeave.save();
      console.log('✅ Updated Annual Leave: 20 days');
    }

    // Update or create Sick Leave
    let sickLeave = await LeaveType.findOne({ code: 'SICK' });
    if (!sickLeave) {
      sickLeave = await LeaveType.create({
        name: 'Sick Leave',
        code: 'SICK',
        description: 'Sick leave for medical reasons',
        daysPerYear: 10,
        isPaid: true,
        requiresApproval: true,
        maxConsecutiveDays: 10,
        advanceNoticeDays: 0,
        carryForwardAllowed: false,
        requiresMedicalCertificate: true,
        color: '#EF4444'
      });
      console.log('✅ Created Sick Leave: 10 days');
    } else {
      sickLeave.daysPerYear = 10;
      sickLeave.maxConsecutiveDays = 10;
      await sickLeave.save();
      console.log('✅ Updated Sick Leave: 10 days');
    }

    // Update Medical Leave (for backward compatibility)
    const medicalLeave = await LeaveType.findOne({ code: 'MEDICAL' });
    if (medicalLeave) {
      medicalLeave.daysPerYear = 10;
      medicalLeave.maxConsecutiveDays = 10;
      await medicalLeave.save();
      console.log('✅ Updated Medical Leave: 10 days');
    }

    const casualLeave = await LeaveType.findOne({ code: 'CASUAL' });
    if (casualLeave) {
      casualLeave.daysPerYear = 10;
      await casualLeave.save();
      console.log('✅ Updated Casual Leave: 10 days (confirmed)');
    }

    // Update Leave Policy
    console.log('\n📋 Updating Leave Policy...');
    
    const policy = await LeavePolicy.findOne({ isDefault: true });
    if (policy) {
      policy.leaveAllocation.annual.days = 20;
      policy.leaveAllocation.annual.carryForward.maxDays = 10;
      policy.leaveAllocation.casual.days = 10;
      policy.leaveAllocation.medical.days = 10;
      
      await policy.save();
      console.log('✅ Updated Default Leave Policy');
      console.log('   - Annual: 20 days (carry forward: 10)');
      console.log('   - Sick/Medical: 10 days');
      console.log('   - Casual: 10 days');
    } else {
      console.log('⚠️ No default policy found. Creating new one...');
      
      const newPolicy = await LeavePolicy.create({
        name: 'Default Leave Policy',
        description: 'Default leave policy for all employees',
        leaveAllocation: {
          annual: {
            days: 20,
            accrualMethod: 'yearly',
            carryForward: {
              allowed: true,
              maxDays: 10,
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
            days: 10,
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
        isDefault: true,
        isActive: true,
        createdBy: new mongoose.Types.ObjectId()
      });
      
      console.log('✅ Created new Default Leave Policy with (20, 10, 10)');
    }

    console.log('\n✅ All leave defaults updated successfully!');
    console.log('\n📊 New Standard Leave Limits:');
    console.log('   Annual Leave: 20 days per year');
    console.log('   Sick Leave: 10 days per year');
    console.log('   Casual Leave: 10 days per year');
    
  } catch (error) {
    console.error('❌ Error updating leave policy defaults:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
updateLeavePolicyDefaults()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

