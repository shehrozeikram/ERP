const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const Employee = require('../models/hr/Employee');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveType = require('../models/hr/LeaveType');

async function checkEmployees() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc-erp-backend';
    await mongoose.connect(mongoUri);

    const names = ['Sania', 'Riasat'];

    for (const name of names) {
      const emp = await Employee.findOne({
        $or: [{ firstName: new RegExp(name, 'i') }, { lastName: new RegExp(name, 'i') }]
      });

      if (!emp) {
        console.log(`Employee matching "${name}" not found.`);
        continue;
      }

      console.log(`\n==================================================`);
      console.log(`Employee: ${emp.firstName} ${emp.lastName} (${emp._id})`);
      console.log(`Joining Date: ${emp.joiningDate || emp.hireDate}`);
      console.log(`LeaveConfig:`, emp.leaveConfig);

      const requests = await LeaveRequest.find({ employee: emp._id }).populate('leaveType');
      console.log(`\n--- Leave Requests (${requests.length}) ---`);
      requests.forEach((r, i) => {
        console.log(`[${i+1}] Status: ${r.status}, Type: ${r.leaveType?.name} (${r.leaveType?.code}), Dates: ${r.startDate?.toISOString().split('T')[0]} to ${r.endDate?.toISOString().split('T')[0]}, Days: ${r.totalDays}, LeaveYear: ${r.leaveYear}, WorkYear: ${r.workYear}`);
      });

      const balances = await LeaveBalance.find({ employee: emp._id }).sort({ workYear: 1 });
      console.log(`\n--- Leave Balances in DB (${balances.length}) ---`);
      balances.forEach(b => {
        console.log(`WorkYear ${b.workYear} (Year ${b.year}): Annual Allocated=${b.annual?.allocated}, Used=${b.annual?.used}, CF=${b.annual?.carriedForward}, Remaining=${b.annual?.remaining} | Casual Used=${b.casual?.used} | Sick Used=${b.sick?.used}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkEmployees();
