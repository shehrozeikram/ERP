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

async function fixMansoorDirectly() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc-erp-backend';
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const emp = await Employee.findOne({
      $or: [{ firstName: /mansor/i }, { firstName: /mansoor/i }]
    });

    if (!emp) {
      console.log('Mansoor not found');
      process.exit(1);
    }

    console.log(`Employee: ${emp.firstName} ${emp.lastName} (${emp._id})`);

    // Get all leave balances for Mansoor
    const balances = await LeaveBalance.find({ employee: emp._id }).sort({ workYear: 1 });
    console.log('\n--- Current Leave Balances in DB ---');
    console.log(JSON.stringify(balances, null, 2));

    // Update WorkYear 1 balance: Annual Allocated=20, Used=0, CF=0, Remaining=20. Casual Used=7.
    let wy1 = await LeaveBalance.findOne({ employee: emp._id, workYear: 1 });
    if (wy1) {
      wy1.annual = { allocated: 20, used: 0, remaining: 20, carriedForward: 0, advance: 0 };
      wy1.casual = { allocated: 10, used: 7, remaining: 3, carriedForward: 0, advance: 0 };
      wy1.sick = { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 };
      wy1.markModified('annual');
      wy1.markModified('casual');
      wy1.markModified('sick');
      await wy1.save();
      console.log('\nUpdated WorkYear 1 Balance successfully.');
    }

    // Update WorkYear 2 balance: Annual Allocated=20, CF=20, Used=12, Remaining=28. Casual Used=5.
    let wy2 = await LeaveBalance.findOne({ employee: emp._id, workYear: 2 });
    if (wy2) {
      wy2.annual = { allocated: 20, used: 12, remaining: 28, carriedForward: 20, advance: 0 };
      wy2.casual = { allocated: 10, used: 5, remaining: 5, carriedForward: 0, advance: 0 };
      wy2.sick = { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 };
      wy2.isCarriedForward = true;
      wy2.markModified('annual');
      wy2.markModified('casual');
      wy2.markModified('sick');
      await wy2.save();
      console.log('Updated WorkYear 2 Balance successfully.');
    }

    // Also update Employee embedded leaveBalance field
    emp.leaveBalance = {
      annual: { allocated: 20, used: 12, remaining: 28, carriedForward: 20, advance: 0 },
      casual: { allocated: 10, used: 5, remaining: 5, carriedForward: 0, advance: 0 },
      sick: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 },
      medical: { allocated: 10, used: 0, remaining: 10, carriedForward: 0, advance: 0 }
    };
    await emp.save({ validateBeforeSave: false });
    console.log('Updated Employee embedded leaveBalance successfully.');

    // Print final balances
    const updatedBalances = await LeaveBalance.find({ employee: emp._id }).sort({ workYear: 1 });
    console.log('\n--- Final Balances for Mansoor Zareen ---');
    updatedBalances.forEach(b => {
      console.log(`WorkYear ${b.workYear}: Annual Allocated=${b.annual.allocated}, Used=${b.annual.used}, CF=${b.annual.carriedForward}, Remaining=${b.annual.remaining} | Casual Used=${b.casual.used}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixMansoorDirectly();
