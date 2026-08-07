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
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

async function syncAllEmployeesCorrectly() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc-erp-backend';
    console.log(`Connecting to MongoDB... (URI masked: ${mongoUri.replace(/:([^@]+)@/, ':****@')})`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const employees = await Employee.find({ isActive: true, isDeleted: false });
    console.log(`Found ${employees.length} active employees to process...`);

    let successCount = 0;
    let errorCount = 0;

    for (const emp of employees) {
      try {
        const hireDate = emp.hireDate || emp.joiningDate;
        if (!hireDate) continue;

        const currentWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate);
        const hireDateObj = new Date(hireDate);

        // Fetch all approved requests for this employee
        const allRequests = await LeaveRequest.find({
          employee: emp._id,
          status: 'approved',
          isActive: true
        }).populate('leaveType');

        let prevAnnualRemaining = 0;

        for (let wy = 0; wy <= currentWorkYear; wy++) {
          const wyStart = new Date(hireDateObj.getFullYear() + wy, hireDateObj.getMonth(), hireDateObj.getDate());
          const wyEnd = new Date(hireDateObj.getFullYear() + wy + 1, hireDateObj.getMonth(), hireDateObj.getDate());

          const wyRequests = allRequests.filter(r => {
            const lStart = new Date(r.startDate);
            return lStart >= wyStart && lStart < wyEnd;
          });

          // Calculate used days per type for this period
          let annualUsed = 0;
          let sickUsed = 0;
          let casualUsed = 0;

          for (const req of wyRequests) {
            const codeStr = (req.leaveType?.code || req.leaveType?.name || '').toUpperCase();
            const nameStr = (req.leaveType?.name || '').toUpperCase();

            if (codeStr.includes('ANNUAL') || codeStr.includes('AL') || nameStr.includes('ANNUAL')) {
              annualUsed += req.totalDays || 0;
            } else if (codeStr.includes('SICK') || codeStr.includes('SL') || codeStr.includes('MEDICAL') || codeStr.includes('ML') || nameStr.includes('SICK') || nameStr.includes('MEDICAL')) {
              sickUsed += req.totalDays || 0;
            } else {
              casualUsed += req.totalDays || 0;
            }
          }

          // Calculate allocations
          const annualAllocated = wy >= 1 ? (emp.leaveConfig?.annualLimit || 20) : 0;
          const sickAllocated = wy >= 0 ? (emp.leaveConfig?.sickLimit || 10) : 0;
          const casualAllocated = wy >= 0 ? (emp.leaveConfig?.casualLimit || 10) : 0;

          // Carry forward calculation for annual leaves (capped at 20 CF, max 40 total quota)
          let carriedForward = 0;
          if (wy > 0) {
            const individualCap = Math.min(prevAnnualRemaining, 20);
            const maxCF = Math.max(0, 40 - annualAllocated);
            carriedForward = Math.min(individualCap, maxCF);
          }

          const annualTotalAvailable = annualAllocated + carriedForward;
          const annualRemaining = Math.max(0, annualTotalAvailable - annualUsed);
          const annualAdvance = annualUsed > annualTotalAvailable ? (annualUsed - annualTotalAvailable) : 0;

          const sickRemaining = Math.max(0, sickAllocated - sickUsed);
          const sickAdvance = sickUsed > sickAllocated ? (sickUsed - sickAllocated) : 0;

          const casualRemaining = Math.max(0, casualAllocated - casualUsed);
          const casualAdvance = casualUsed > casualAllocated ? (casualUsed - casualAllocated) : 0;

          // Update/Create LeaveBalance doc for this work year
          const year = hireDateObj.getFullYear() + wy + 1;
          let balanceDoc = await LeaveBalance.findOne({
            employee: emp._id,
            $or: [{ workYear: wy }, { year: year }]
          });

          if (!balanceDoc) {
            balanceDoc = new LeaveBalance({
              employee: emp._id,
              year: year,
              workYear: wy,
              expirationDate: new Date(year + 2, 11, 31)
            });
          }

          balanceDoc.workYear = wy;
          balanceDoc.year = year;
          balanceDoc.isCarriedForward = carriedForward > 0;
          balanceDoc.annual = {
            allocated: annualAllocated,
            used: annualUsed,
            remaining: annualRemaining,
            carriedForward: carriedForward,
            advance: annualAdvance
          };
          balanceDoc.sick = {
            allocated: sickAllocated,
            used: sickUsed,
            remaining: sickRemaining,
            carriedForward: 0,
            advance: sickAdvance
          };
          balanceDoc.casual = {
            allocated: casualAllocated,
            used: casualUsed,
            remaining: casualRemaining,
            carriedForward: 0,
            advance: casualAdvance
          };

          balanceDoc.markModified('annual');
          balanceDoc.markModified('sick');
          balanceDoc.markModified('casual');

          await balanceDoc.save({ validateBeforeSave: false });

          // Pass remaining to next work year carry forward
          prevAnnualRemaining = annualRemaining;

          // If this is current work year, update Employee embedded balance
          if (wy === currentWorkYear) {
            emp.leaveBalance = {
              annual: {
                allocated: annualAllocated,
                used: annualUsed,
                remaining: annualRemaining,
                carriedForward: carriedForward,
                advance: annualAdvance
              },
              sick: {
                allocated: sickAllocated,
                used: sickUsed,
                remaining: sickRemaining,
                carriedForward: 0,
                advance: sickAdvance
              },
              casual: {
                allocated: casualAllocated,
                used: casualUsed,
                remaining: casualRemaining,
                carriedForward: 0,
                advance: casualAdvance
              },
              medical: {
                allocated: sickAllocated,
                used: sickUsed,
                remaining: sickRemaining,
                carriedForward: 0,
                advance: 0
              }
            };
            await emp.save({ validateBeforeSave: false });
          }
        }
        successCount++;
      } catch (err) {
        console.warn(`Error processing employee ${emp.firstName} ${emp.lastName} (${emp._id}): ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n🎉 Bulk Sync Complete! Success: ${successCount}, Errors: ${errorCount}`);
    process.exit(0);
  } catch (globalErr) {
    console.error('Global Error in syncAllEmployeesCorrectly:', globalErr);
    process.exit(1);
  }
}

syncAllEmployeesCorrectly();
