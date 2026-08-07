const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const Employee = require('../models/hr/Employee');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeaveIntegrationService = require('../services/leaveIntegrationService');

async function testMansoorSync() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc-erp-backend';
    await mongoose.connect(mongoUri);

    const emp = await Employee.findOne({
      $or: [{ firstName: /mansor/i }, { firstName: /mansoor/i }]
    });

    const hireDate = emp.hireDate || emp.joiningDate;
    const currentWorkYear = LeaveIntegrationService.calculateWorkYear(hireDate);
    const hireDateObj = new Date(hireDate);

    const allRequests = await LeaveRequest.find({
      employee: emp._id,
      status: 'approved',
      isActive: true
    }).populate('leaveType');

    console.log(`Mansoor Hire Date: ${hireDateObj.toISOString()}`);
    console.log(`Current Work Year: ${currentWorkYear}`);
    console.log(`Total Approved Requests: ${allRequests.length}`);

    for (let wy = 0; wy <= currentWorkYear; wy++) {
      const wyStart = new Date(hireDateObj.getFullYear() + wy, hireDateObj.getMonth(), hireDateObj.getDate());
      const wyEnd = new Date(hireDateObj.getFullYear() + wy + 1, hireDateObj.getMonth(), hireDateObj.getDate());

      console.log(`\n--- WorkYear ${wy} (${wyStart.toISOString().split('T')[0]} to ${wyEnd.toISOString().split('T')[0]}) ---`);

      const wyRequests = allRequests.filter(r => {
        const lStart = new Date(r.startDate);
        return lStart >= wyStart && lStart < wyEnd;
      });

      console.log(`Found ${wyRequests.length} requests in this period:`);

      let annualUsed = 0;
      let sickUsed = 0;
      let casualUsed = 0;

      for (const req of wyRequests) {
        const code = (req.leaveType?.code || req.leaveType?.name || '').toUpperCase();
        const name = (req.leaveType?.name || '').toUpperCase();

        let typeChosen = 'casual';
        if (code.includes('ANNUAL') || code === 'AL' || code.startsWith('AL_') || name.includes('ANNUAL')) {
          typeChosen = 'annual';
          annualUsed += req.totalDays || 0;
        } else if (code.includes('SICK') || code === 'SL' || code.startsWith('SL_') || code.includes('MEDICAL') || code === 'ML' || name.includes('SICK') || name.includes('MEDICAL')) {
          typeChosen = 'sick';
          sickUsed += req.totalDays || 0;
        } else {
          typeChosen = 'casual';
          casualUsed += req.totalDays || 0;
        }

        console.log(`  Req ID ${req._id}: startDate=${req.startDate.toISOString().split('T')[0]}, code="${req.leaveType?.code}", name="${req.leaveType?.name}", days=${req.totalDays} -> Matched Type: [${typeChosen.toUpperCase()}]`);
      }

      console.log(`Result for WorkYear ${wy}: AnnualUsed=${annualUsed}, SickUsed=${sickUsed}, CasualUsed=${casualUsed}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testMansoorSync();
