const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, './.env') });
}

const Employee = require('../models/hr/Employee');
const LeaveBalance = require('../models/hr/LeaveBalance');
const CarryForwardService = require('../services/carryForwardService');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

async function syncAllLeaveBalances() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc-erp-backend';
    console.log(`Connecting to MongoDB... (URI masked: ${mongoUri.replace(/:([^@]+)@/, ':****@')})`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const employees = await Employee.find({ isActive: true, isDeleted: false });
    console.log(`Found ${employees.length} active employees to sync...`);

    let updatedCount = 0;
    for (const emp of employees) {
      try {
        const hireDate = emp.hireDate || emp.joiningDate;
        if (!hireDate) continue;

        const currentWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate);

        // Get all leave requests for employee
        const allRequests = await LeaveRequest.find({
          employee: emp._id,
          isActive: true
        }).populate('leaveType');

        const hireDateObj = new Date(hireDate);

        // Ensure balances exist and sync used days from requests for each work year
        for (let wy = 0; wy <= currentWorkYear; wy++) {
          const wyStart = new Date(hireDateObj.getFullYear() + wy, hireDateObj.getMonth(), hireDateObj.getDate());
          const wyEnd = new Date(hireDateObj.getFullYear() + wy + 1, hireDateObj.getMonth(), hireDateObj.getDate());

          const periodRequests = allRequests.filter(r => {
            const leaveStart = new Date(r.startDate);
            return leaveStart >= wyStart && leaveStart < wyEnd;
          });

          const balance = await LeaveBalance.getOrCreateBalanceWithCarryForward(emp._id, wy);
          await LeaveIntegrationService.syncBalanceWithLeaveRequests(balance, periodRequests);
        }

        // Recalculate carry forward sequentially for all work years of this employee
        await CarryForwardService.recalculateCarryForward(emp._id);

        // Also update embedded leaveBalance on Employee model for consistency
        const currentBalance = await LeaveBalance.findOne({
          employee: emp._id,
          workYear: currentWorkYear
        });

        if (currentBalance) {
          emp.leaveBalance = {
            annual: {
              allocated: currentBalance.annual?.allocated || 20,
              used: currentBalance.annual?.used || 0,
              remaining: Math.max(0, (currentBalance.annual?.allocated || 20) + (currentBalance.annual?.carriedForward || 0) - (currentBalance.annual?.used || 0)),
              carriedForward: currentBalance.annual?.carriedForward || 0,
              advance: currentBalance.annual?.advance || 0
            },
            sick: {
              allocated: currentBalance.sick?.allocated || 10,
              used: currentBalance.sick?.used || 0,
              remaining: Math.max(0, (currentBalance.sick?.allocated || 10) + (currentBalance.sick?.carriedForward || 0) - (currentBalance.sick?.used || 0)),
              carriedForward: currentBalance.sick?.carriedForward || 0,
              advance: currentBalance.sick?.advance || 0
            },
            casual: {
              allocated: currentBalance.casual?.allocated || 10,
              used: currentBalance.casual?.used || 0,
              remaining: Math.max(0, (currentBalance.casual?.allocated || 10) + (currentBalance.casual?.carriedForward || 0) - (currentBalance.casual?.used || 0)),
              carriedForward: currentBalance.casual?.carriedForward || 0,
              advance: currentBalance.casual?.advance || 0
            },
            medical: {
              allocated: currentBalance.sick?.allocated || 10,
              used: currentBalance.sick?.used || 0,
              remaining: Math.max(0, (currentBalance.sick?.allocated || 10) - (currentBalance.sick?.used || 0)),
              carriedForward: 0,
              advance: 0
            }
          };
          await emp.save({ validateBeforeSave: false });
          updatedCount++;
        }
      } catch (empErr) {
        console.warn(`Warning syncing employee ${emp.firstName} ${emp.lastName} (${emp._id}): ${empErr.message}`);
      }
    }

    console.log(`Successfully synced leave balances for ${updatedCount} employees.`);
    
    // Check Mansoor Zareen specifically
    const mansoor = await Employee.findOne({
      $or: [
        { firstName: /mansor/i },
        { firstName: /mansoor/i },
        { lastName: /zareen/i }
      ]
    });

    if (mansoor) {
      console.log('\n--- Mansoor Zareen Sync Result ---');
      console.log(`Name: ${mansoor.firstName} ${mansoor.lastName}`);
      console.log(`Joining Date: ${mansoor.joiningDate || mansoor.hireDate}`);
      const balances = await LeaveBalance.find({ employee: mansoor._id }).sort({ workYear: 1 });
      balances.forEach(b => {
        console.log(`WorkYear ${b.workYear} (Year ${b.year}): Allocated=${b.annual.allocated}, Used=${b.annual.used}, CarriedForward=${b.annual.carriedForward}, Remaining=${b.annual.remaining}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error syncing leave balances:', err);
    process.exit(1);
  }
}

syncAllLeaveBalances();
