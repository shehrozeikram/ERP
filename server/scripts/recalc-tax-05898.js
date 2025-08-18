const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, disconnectDB } = require('../config/database');
const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');

(async () => {
  try {
    await connectDB();

    const employee = await Employee.findOne({ employeeId: '05898' });
    if (!employee) {
      console.log('Employee 05898 not found');
      process.exit(0);
    }

    const payrolls = await Payroll.find({ employee: employee._id });
    console.log(`Found ${payrolls.length} payroll(s) for employee 05898`);

    for (const p of payrolls) {
      await p.calculateAndUpdateTax();
      console.log(`Updated payroll ${p.month}/${p.year}: incomeTax=${p.incomeTax}`);
    }

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
