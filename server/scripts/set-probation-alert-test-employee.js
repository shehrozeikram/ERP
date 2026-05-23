#!/usr/bin/env node
/**
 * Dev helper: set an employee's probation so "Probation Ending Soon" popup appears.
 *
 *   node server/scripts/set-probation-alert-test-employee.js 06470
 *   node server/scripts/set-probation-alert-test-employee.js 06470 --days 0   # ends today
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

const employeeId = process.argv[2] || '06470';
const daysArg = process.argv.indexOf('--days');
const daysUntilEnd = daysArg >= 0 ? parseInt(process.argv[daysArg + 1], 10) : 3;
if (!Number.isFinite(daysUntilEnd) || daysUntilEnd < 0 || daysUntilEnd > 7) {
  console.error('--days must be 0–7 (within alert window)');
  process.exit(1);
}

const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp_local';

(async () => {
  await mongoose.connect(uri);

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + daysUntilEnd);

  const appointment = new Date(end);
  appointment.setMonth(appointment.getMonth() - 3);

  const result = await Employee.updateOne(
    { employeeId: String(employeeId).trim() },
    {
      $set: {
        appointmentDate: appointment,
        probationPeriodMonths: 3,
        endOfProbationDate: end,
        employmentStatus: 'Active',
        isActive: true
      },
      $unset: { confirmationDate: '' }
    }
  );

  if (result.matchedCount === 0) {
    console.error(`Employee ${employeeId} not found`);
    process.exit(1);
  }

  const emp = await Employee.findOne({ employeeId: String(employeeId).trim() })
    .select('employeeId firstName lastName endOfProbationDate confirmationDate')
    .lean();

  console.log('OK — open HR Dashboard or Employee List to see the popup:');
  console.log(JSON.stringify(emp, null, 2));
  console.log(`Probation ends: ${end.toISOString().slice(0, 10)} (${daysUntilEnd} day(s) from today)`);
  console.log('Note: Saving this employee in the form may set confirmationDate again and hide the alert.');

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
