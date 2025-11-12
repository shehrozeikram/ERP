require('dotenv').config();
const mongoose = require('mongoose');

const LeaveRequest = require('../models/hr/LeaveRequest');
const Employee = require('../models/hr/Employee');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

/**
 * Script to recalculate workYear and leaveYear for all leave requests
 * using the leave start date and employee hire date.
 */

async function fixLeaveWorkYears() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp';
  console.log('🚀 Connecting to database...');
  await mongoose.connect(dbUri);
  console.log('✅ Connected to database');

  try {
    const leaves = await LeaveRequest.find({}).populate('employee', 'employeeId firstName lastName hireDate');
    console.log(`📋 Found ${leaves.length} leave requests to inspect`);

    let updated = 0;
    let skipped = 0;
    const changes = [];

    for (const leave of leaves) {
      if (!leave.employee || !leave.employee.hireDate || !leave.startDate) {
        skipped++;
        continue;
      }

      const hireDate = new Date(leave.employee.hireDate);
      const leaveStart = new Date(leave.startDate);

      if (Number.isNaN(hireDate.getTime()) || Number.isNaN(leaveStart.getTime())) {
        skipped++;
        continue;
      }

      const newWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate, leaveStart);
      const hireYear = hireDate.getFullYear();
      const newLeaveYear = Math.max(hireYear + 1, hireYear + newWorkYear + 1);

      const needsUpdate = (leave.workYear !== newWorkYear) || (leave.leaveYear !== newLeaveYear);

      if (!needsUpdate) {
        continue;
      }

      await LeaveRequest.updateOne(
        { _id: leave._id },
        {
          $set: {
            workYear: newWorkYear,
            leaveYear: newLeaveYear
          }
        }
      );

      updated++;
      changes.push({
        id: leave._id,
        employeeId: leave.employee.employeeId,
        employeeName: `${leave.employee.firstName || ''} ${leave.employee.lastName || ''}`.trim(),
        startDate: leave.startDate,
        oldWorkYear: leave.workYear,
        newWorkYear,
        oldLeaveYear: leave.leaveYear,
        newLeaveYear
      });

      if (updated % 100 === 0) {
        console.log(`   ✅ Updated ${updated} records so far...`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Fix Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   Total processed: ${leaves.length}`);

    if (changes.length > 0) {
      console.log('\n📝 Sample changes:');
      changes.slice(0, 10).forEach(change => {
        console.log(`   • Employee ${change.employeeId} (${change.employeeName}) | ${change.startDate.toISOString().split('T')[0]} | workYear ${change.oldWorkYear} → ${change.newWorkYear}`);
      });
      if (changes.length > 10) {
        console.log(`   ... and ${changes.length - 10} more changes`);
      }
    }

    console.log('\n✅ Work year recalculation complete!');
  } catch (error) {
    console.error('❌ Error while fixing work years:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

if (require.main === module) {
  fixLeaveWorkYears()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = fixLeaveWorkYears;


