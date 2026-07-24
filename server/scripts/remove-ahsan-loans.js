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
  console.log(`=== REMOVING FIRST 2 LOANS FOR MUHAMMAD AHSAN (05742) [MODE: ${isApply ? 'APPLY' : 'DRY RUN'}] ===\n`);

  await connectDB();

  // Find Employee Muhammad Ahsan (Employee ID 05742 / 5742)
  const employee = await Employee.findOne({
    $or: [
      { employeeId: '05742' },
      { employeeId: '5742' },
      { firstName: /Muhammad/i, lastName: /Ahsan/i }
    ]
  });

  if (!employee) {
    console.error('❌ Employee Muhammad Ahsan (05742) not found in DB!');
    await mongoose.disconnect();
    return;
  }

  console.log(`Employee Found: ${employee.employeeId} - ${employee.firstName} ${employee.lastName} (ID: ${employee._id})`);

  // Fetch all loans for this employee ordered by creation date
  const loans = await Loan.find({ employee: employee._id }).sort({ createdAt: 1 });
  console.log(`Total loans found for ${employee.firstName} ${employee.lastName}: ${loans.length}`);

  loans.forEach((l, idx) => {
    console.log(`  [${idx + 1}] ID: ${l._id} | Type: ${l.loanType} | Amount: Rs. ${l.loanAmount?.toLocaleString()} | Monthly: Rs. ${l.monthlyInstallment?.toLocaleString()} | Status: ${l.status} | Created: ${l.createdAt}`);
  });

  if (loans.length === 0) {
    console.log('\nNo loans found to remove.');
    await mongoose.disconnect();
    return;
  }

  // Target the first 2 loans
  const loansToRemove = loans.slice(0, 2);

  console.log('\n--- TARGET LOANS TO REMOVE ---');
  loansToRemove.forEach((l, idx) => {
    console.log(`  Target ${idx + 1}: Loan ID ${l._id} | Type: ${l.loanType} | Amount: Rs. ${l.loanAmount} | Monthly: Rs. ${l.monthlyInstallment}`);
  });

  if (isApply) {
    const ids = loansToRemove.map(l => l._id);
    const deleteResult = await Loan.deleteMany({ _id: { $in: ids } });
    console.log(`\n✅ Successfully deleted ${deleteResult.deletedCount} loan(s) from Production Database.`);
  } else {
    console.log('\n[DRY RUN COMPLETE] No records were deleted. Pass --apply to permanently delete these 2 loans.');
  }

  await mongoose.disconnect();
}

removeAhsanLoans().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});
