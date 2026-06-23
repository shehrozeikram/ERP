/**
 * Test: Land Transfer BPV Creation
 * Run: node scratch/test-land-transfer-bpv.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
  console.log('✅ Connected to MongoDB\n');

  const LandTransfer = require('../server/models/tajResidencia/LandTransfer');
  const JournalEntry = require('../server/models/finance/JournalEntry');
  const Account = require('../server/models/finance/Account');

  // ── Step 1: Find an existing land transfer with pending payments ──────────
  const transfer = await LandTransfer.findOne({ isActive: true }).lean();
  if (!transfer) {
    console.log('❌ No land transfer found in DB. Create one first.');
    process.exit(1);
  }
  console.log(`📋 Transfer: ${transfer.transferNo} | paymentStatus: ${transfer.paymentStatus || 'N/A'}`);
  console.log(`   Payments: ${transfer.transferPayments?.length || 0} rows`);
  transfer.transferPayments?.forEach(p => {
    console.log(`   - [${p.status || 'N/A'}] ${p.paymentType}: PKR ${p.amount}`);
  });

  // ── Step 2: Find a bank account ───────────────────────────────────────────
  const bankAcc = await Account.findOne({ isActive: true, type: 'Asset' }).lean();
  if (!bankAcc) {
    console.log('❌ No bank account found');
    process.exit(1);
  }
  console.log(`\n🏦 Bank Account: ${bankAcc.name} (${bankAcc._id}) | companyId: ${bankAcc.companyId || 'null'}`);

  // ── Step 3: Find expense account ─────────────────────────────────────────
  let expenseAcc = await Account.findOne({ name: /Land Acquisition/i, isActive: true }).lean();
  if (!expenseAcc) expenseAcc = await Account.findOne({ type: 'Expense', isActive: true }).lean();
  console.log(`💼 Expense Account: ${expenseAcc?.name || 'NOT FOUND'} (${expenseAcc?._id || 'N/A'})`);

  if (!expenseAcc) {
    console.log('\n❌ PROBLEM: No expense account found — BPV will fail. Create a Land Acquisition expense account first.');
    process.exit(1);
  }

  // ── Step 4: Simulate BPV creation ────────────────────────────────────────
  const FinanceHelper = require('../server/utils/financeHelper');

  const debitLines = [
    { paymentType: 'District Council Fee', amount: 5000 },
    { paymentType: 'Stamp Duty', amount: 3000 }
  ];
  const totalAmount = 8000;

  console.log('\n🔄 Attempting to create BPV...');

  const journalLines = [
    ...debitLines.map(({ paymentType, amount }) => ({
      account: expenseAcc._id,
      description: `Land Transfer – ${paymentType} (${transfer.transferNo})`,
      debit: amount,
      credit: 0,
      department: 'general'
    })),
    {
      account: bankAcc._id,
      description: `Bank Payment – Transfer ${transfer.transferNo}`,
      debit: 0,
      credit: totalAmount,
      department: 'general'
    }
  ];

  const payload = {
    date: new Date(),
    reference: `LT-${transfer.transferNo}-TEST`,
    referenceType: 'payment',
    referenceId: transfer._id,
    description: `BPV TEST: Land Transfer Payment – ${transfer.transferNo}`,
    department: 'general',
    module: 'general',
    journalCode: 'BANK',
    voucherSeries: 'BPV',
    lines: journalLines,
    createdBy: transfer.updatedBy || transfer.createdBy || new mongoose.Types.ObjectId()
  };
  if (bankAcc.companyId) payload.companyId = bankAcc.companyId;

  try {
    const entry = await FinanceHelper.createAndPostJournalEntry(payload);
    console.log(`\n✅ BPV CREATED SUCCESSFULLY!`);
    console.log(`   Entry Number: ${entry.entryNumber}`);
    console.log(`   Status: ${entry.status}`);
    console.log(`   Lines: ${entry.lines?.length}`);
    entry.lines?.forEach(l => {
      console.log(`   - Dr: ${l.debit} | Cr: ${l.credit} | ${l.description}`);
    });

    // Clean up test entry
    await JournalEntry.findByIdAndDelete(entry._id);
    console.log('\n🧹 Test entry deleted (cleanup)');
  } catch (err) {
    console.log(`\n❌ BPV CREATION FAILED: ${err.message}`);
    console.error(err);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
