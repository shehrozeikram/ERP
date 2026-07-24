const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('../config/database');
const Employee = require('../models/hr/Employee');
const Loan = require('../models/hr/Loan');

async function removeAhsanLoans() {
  const isApply = process.argv.includes('--apply');
  console.log(`=== FINDING AND REMOVING VEHICLE LOAN (Rs. 500,000 / Rs. 41,667) [MODE: ${isApply ? 'APPLY' : 'DRY RUN'}] ===\n`);

  await connectDB();

  // Query for Vehicle loan with 500,000 loanAmount or monthlyInstallment ~41667
  const loans = await Loan.find({
    $or: [
      { loanType: 'Vehicle', loanAmount: 500000 },
      { loanAmount: 500000 },
      { monthlyInstallment: { $gte: 41600, $lte: 41700 } }
    ]
  }).populate('employee');

  console.log(`Matching loans found in DB: ${loans.length}`);

  loans.forEach((l, idx) => {
    const empName = l.employee ? `${l.employee.employeeId} - ${l.employee.firstName} ${l.employee.lastName}` : 'No Employee Linked (Orphaned)';
    console.log(`  [${idx + 1}] ID: ${l._id} | Employee: ${empName} | Type: ${l.loanType} | Amount: Rs. ${l.loanAmount?.toLocaleString()} | Monthly: Rs. ${l.monthlyInstallment?.toLocaleString()} | Status: ${l.status}`);
  });

  if (loans.length === 0) {
    console.log('\nNo matching loans found.');
    await mongoose.disconnect();
    return;
  }

  if (isApply) {
    const ids = loans.map(l => l._id);
    const deleteResult = await Loan.deleteMany({ _id: { $in: ids } });
    console.log(`\n✅ Successfully deleted ${deleteResult.deletedCount} vehicle loan(s) from Production Database.`);
  } else {
    console.log('\n[DRY RUN COMPLETE] No records were deleted. Pass --apply to permanently delete.');
  }

  await mongoose.disconnect();
}

removeAhsanLoans().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});
