/**
 * sync-employee-phones-to-users.js
 * Copies phone numbers from Employee records to their linked User accounts.
 * Matches on employeeId (both User and Employee have this field).
 * Skips users who already have a phone number.
 * Run: NODE_ENV=production node server/scripts/sync-employee-phones-to-users.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const Employee = require('../models/hr/Employee');
  const User = require('../models/User');

  // Load all employees with phone and employeeId
  const employees = await Employee.find({
    phone: { $exists: true, $ne: '', $ne: null },
    employeeId: { $exists: true, $ne: '', $ne: null }
  }).select('employeeId phone firstName lastName').lean();

  console.log(`Found ${employees.length} employees with employeeId + phone`);

  let updated = 0, skipped = 0, noUser = 0;

  for (const emp of employees) {
    const empId = String(emp.employeeId || '').trim();
    if (!empId) { skipped++; continue; }

    const user = await User.findOne({ employeeId: empId }).select('_id email phone firstName');
    if (!user) { noUser++; continue; }

    if (user.phone && String(user.phone).trim()) {
      skipped++; // already has phone, don't overwrite
      continue;
    }

    // Normalise phone — store as 0xxxxxxxxxx (local format)
    let phone = String(emp.phone || '').replace(/[\s\-\(\)\.]/g, '');
    if (phone.startsWith('92') && phone.length === 12) phone = '0' + phone.slice(2);
    else if (!phone.startsWith('0') && phone.length === 10) phone = '0' + phone;

    await User.findByIdAndUpdate(user._id, { phone });
    console.log(`  ✅ ${emp.firstName} ${emp.lastName || ''} (EmpID: ${empId}) → phone: ${phone}`);
    updated++;
  }

  console.log(`\nSummary: Updated: ${updated}, Had phone already (skipped): ${skipped}, No matching user: ${noUser}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
