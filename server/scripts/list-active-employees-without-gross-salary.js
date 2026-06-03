/**
 * Active employees (isActive + employmentStatus Active) with no gross salary.
 *
 *   npm run list:employees-without-gross
 *   NODE_ENV=production node server/scripts/list-active-employees-without-gross-salary.js
 */

const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..', '..');
for (const f of ['.env', '.env.local']) {
  const p = path.join(repoRoot, f);
  if (fs.existsSync(p)) require('dotenv').config({ path: p, override: f === '.env.local' });
}
if (process.env.SGC_ENV_FILE) {
  const extra = path.isAbsolute(process.env.SGC_ENV_FILE)
    ? process.env.SGC_ENV_FILE
    : path.join(repoRoot, process.env.SGC_ENV_FILE);
  if (fs.existsSync(extra)) require('dotenv').config({ path: extra, override: true });
}

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
require('../models/hr/Department');
require('../models/hr/Position');
const Employee = require('../models/hr/Employee');

function hasGrossSalary(emp) {
  const g = Number(emp?.salary?.gross);
  const excel = Number(emp?.excelGrossSalary);
  return (Number.isFinite(g) && g > 0) || (Number.isFinite(excel) && excel > 0);
}

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI. Set MONGODB_URI (production) or MONGODB_URI_LOCAL (dev).');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  const employees = await Employee.find({
    isDeleted: { $ne: true },
    isActive: true,
    employmentStatus: 'Active'
  })
    .select('employeeId firstName lastName email salary.gross excelGrossSalary')
    .populate('department', 'name')
    .populate('position', 'title')
    .sort({ employeeId: 1 })
    .lean();

  const missing = employees.filter((e) => !hasGrossSalary(e));

  console.log(`Database: ${isLocal ? 'local' : 'production (MONGODB_URI)'}`);
  console.log(`Active employees: ${employees.length}`);
  console.log(`Without gross salary (salary.gross and excelGrossSalary empty/zero): ${missing.length}\n`);

  if (!missing.length) {
    console.log('None — all active employees have gross salary.');
    await mongoose.disconnect();
    return;
  }

  console.log('Emp ID | Name | Department | Position | salary.gross | excelGross');
  console.log('-'.repeat(90));
  missing.forEach((e, i) => {
    const name = [e.firstName, e.lastName].filter(Boolean).join(' ');
    const dept = e.department?.name || '—';
    const pos = e.position?.title || '—';
    console.log(
      `${String(i + 1).padStart(3)}. ${(e.employeeId || '—').padEnd(8)} | ${name.padEnd(28).slice(0, 28)} | ${dept.slice(0, 18).padEnd(18)} | ${pos.slice(0, 16).padEnd(16)} | ${e.salary?.gross ?? '—'} | ${e.excelGrossSalary ?? '—'}`
    );
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
