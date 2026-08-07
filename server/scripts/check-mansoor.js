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
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');

async function inspectMansoor() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc-erp-backend';
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const emp = await Employee.findOne({
      $or: [
        { firstName: /mansor/i },
        { firstName: /mansoor/i },
        { lastName: /zareen/i }
      ]
    });

    if (!emp) {
      console.log('Mansoor not found');
      process.exit(1);
    }

    console.log(`=== Employee Info ===`);
    console.log(`ID: ${emp._id}, Name: ${emp.firstName} ${emp.lastName}, Joining: ${emp.joiningDate || emp.hireDate}`);

    const requests = await LeaveRequest.find({ employee: emp._id }).populate('leaveType');
    console.log(`\n=== All Leave Requests (${requests.length}) ===`);
    requests.forEach((r, idx) => {
      console.log(`[${idx+1}] Status: ${r.status}, Type: ${r.leaveType?.name} (${r.leaveType?.code}), Dates: ${r.startDate?.toISOString().split('T')[0]} to ${r.endDate?.toISOString().split('T')[0]}, Days: ${r.totalDays}, WorkYear: ${r.workYear}`);
    });

    const balances = await LeaveBalance.find({ employee: emp._id }).sort({ workYear: 1 });
    console.log(`\n=== All Leave Balances (${balances.length}) ===`);
    balances.forEach(b => {
      console.log(`WorkYear ${b.workYear} (Year ${b.year}): Annual Allocated=${b.annual?.allocated}, Used=${b.annual?.used}, CF=${b.annual?.carriedForward}, Remaining=${b.annual?.remaining}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

inspectMansoor();
