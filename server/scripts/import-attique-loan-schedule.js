require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const Loan = require('../models/hr/Loan');
const User = require('../models/User');

async function importLoanToUri(uri) {
  console.log('\n==================================================');
  console.log('Connecting to database:', uri);
  await mongoose.connect(uri);

  if (mongoose.models.Loan) {
    delete mongoose.models.Loan;
  }
  const LoanModel = require('../models/hr/Loan');

  // Find Employee Attique Ur Rehman (00026 / 26)
  const emp = await Employee.findOne({
    $or: [
      { employeeId: '00026' },
      { employeeId: '26' },
      { firstName: 'Attique', lastName: 'Ur Rehman' }
    ]
  });

  if (!emp) {
    console.error('❌ Employee Attique Ur Rehman (00026) not found in database:', uri);
    await mongoose.disconnect();
    return;
  }

  console.log(`Found Employee: ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, MongoDB _id: ${emp._id})`);

  // Find admin user for createdBy reference
  const adminUser = await User.findOne({ role: 'admin' }).select('_id');
  const createdById = adminUser ? adminUser._id : emp._id;

  // Build the 43 schedule installments as per the document
  const schedule = [];
  let remainingBalance = 300000;
  const startDate = new Date(2024, 6, 1); // July 1, 2024

  for (let i = 1; i <= 43; i++) {
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1), 1);
    const amount = (i === 43) ? 6000 : 7000;
    const principal = amount;
    const interest = 0;
    remainingBalance = Math.max(0, remainingBalance - principal);

    // Installments 1 to 24 (Jul-2024 through Jun-2026) are Paid
    const isPaid = i <= 24;

    schedule.push({
      installmentNumber: i,
      dueDate: dueDate,
      amount: amount,
      principal: principal,
      interest: interest,
      balance: remainingBalance,
      status: isPaid ? 'Paid' : 'Pending',
      paidAmount: isPaid ? amount : 0,
      paymentDate: isPaid ? dueDate : undefined,
      paymentMethod: isPaid ? 'Salary Deduction' : undefined
    });
  }

  // Check if loan already exists for this employee
  let loanDoc = await LoanModel.findOne({
    employee: emp._id,
    $or: [{ loanNumber: '02606' }, { loanAmount: 300000 }]
  });

  const loanPayload = {
    employee: emp._id,
    loanNumber: '02606',
    loanType: 'Personal',
    loanAmount: 300000,
    loanAdmissible: 300000,
    interestRate: 0,
    loanTerm: 43,
    monthlyInstallment: 7000,
    totalPayable: 300000,
    totalPaid: 168000, // 24 * 7000
    totalPrincipalPaid: 168000,
    totalInterestPaid: 0,
    outstandingBalance: 132000, // 300000 - 168000
    status: 'Active',
    applicationDate: new Date('2024-07-01'),
    approvalDate: new Date('2024-07-01'),
    disbursementDate: new Date('2024-07-01'),
    purpose: 'Company Loan',
    emiManuallyAdjusted: true,
    loanSchedule: schedule,
    createdBy: createdById,
    updatedBy: createdById
  };

  if (loanDoc) {
    console.log(`Updating existing loan record (_id: ${loanDoc._id})...`);
    Object.assign(loanDoc, loanPayload);
    await loanDoc.save();
    console.log('✅ Loan record updated successfully!');
  } else {
    console.log('Creating new loan record...');
    loanDoc = await LoanModel.create(loanPayload);
    console.log(`✅ Loan record created successfully with _id: ${loanDoc._id}`);
  }

  console.log('\n--- Loan Summary ---');
  console.log(`Employee: ${emp.firstName} ${emp.lastName}`);
  console.log(`Loan Ref: ${loanDoc.loanNumber}`);
  console.log(`Loan Amount: PKR ${loanDoc.loanAmount.toLocaleString()}`);
  console.log(`Total Paid (24 Months): PKR ${loanDoc.totalPaid.toLocaleString()}`);
  console.log(`Outstanding Balance: PKR ${loanDoc.outstandingBalance.toLocaleString()}`);
  console.log(`Total Schedule Installments: ${loanDoc.loanSchedule.length}`);
  console.log(`Paid Installments: ${loanDoc.loanSchedule.filter(s => s.status === 'Paid').length}`);
  console.log(`Pending Installments: ${loanDoc.loanSchedule.filter(s => s.status === 'Pending').length}`);

  await mongoose.disconnect();
}

async function main() {
  const uris = [
    'mongodb://127.0.0.1:27017/sgc_erp_local',
    'mongodb://127.0.0.1:27017/sgc_erp'
  ];
  if (process.env.MONGODB_URI_LOCAL && !uris.includes(process.env.MONGODB_URI_LOCAL)) {
    uris.push(process.env.MONGODB_URI_LOCAL);
  }
  for (const uri of uris) {
    try {
      await importLoanToUri(uri);
    } catch (err) {
      console.error(`❌ Error importing to ${uri}:`, err.message);
      try { await mongoose.disconnect(); } catch (e) {}
    }
  }
}

main();
