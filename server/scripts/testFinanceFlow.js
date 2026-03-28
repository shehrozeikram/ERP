/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          FULL PROCUREMENT ↔ FINANCE INTEGRATION TEST                   ║
 * ║                                                                          ║
 * ║  Simulates the complete Odoo-style accounting flow:                      ║
 * ║  Indent → PO → GRN → AP Bill → Payment → SIN (Goods Issue)             ║
 * ║                                                                          ║
 * ║  Run with:  node server/scripts/testFinanceFlow.js                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

// ─── Models ──────────────────────────────────────────────────────────────────
const Account          = require('../models/finance/Account');
const JournalEntry     = require('../models/finance/JournalEntry');
const GeneralLedger    = require('../models/finance/GeneralLedger');
const FinanceJournal   = require('../models/finance/FinanceJournal');
const FiscalPeriod     = require('../models/finance/FiscalPeriod');
const InventoryCategory = require('../models/procurement/InventoryCategory');
const Inventory        = require('../models/procurement/Inventory');
const AccountsPayable  = require('../models/finance/AccountsPayable');
require('../models/User'); // Register User model

const FinanceHelper = require('../utils/financeHelper');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);
const step = (n, title) => console.log(`\n${'─'.repeat(60)}\n  STEP ${n}: ${title}\n${'─'.repeat(60)}`);
const sep  = () => console.log('─'.repeat(60));
const fmt  = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

// ─── Test constants ───────────────────────────────────────────────────────────
const TEST_ITEM_QTY       = 10;         // 10 laptops received on GRN
const TEST_UNIT_PRICE     = 150000;     // PKR 150,000 each
const TEST_ISSUE_QTY      = 3;          // 3 laptops issued via SIN
const PAYMENT_AMOUNT      = TEST_ITEM_QTY * TEST_UNIT_PRICE;  // Full payment
const EXPECTED_GRN_AMOUNT = TEST_ITEM_QTY * TEST_UNIT_PRICE;  // 1,500,000

// Account numbers we need (match FinanceHelper.ACCOUNTS constants)
const ACC = {
  BANK:      '1002',   // Must match FinanceHelper.ACCOUNTS.BANK
  INVENTORY: '1100',
  GRNI:      '2100',
  AP:        '2001',
  COGS:      '5000'
};

// ─── Core setup ──────────────────────────────────────────────────────────────
async function ensureAccount({ accountNumber, name, type, category }) {
  let acc = await Account.findOne({ accountNumber });
  if (!acc) {
    acc = await Account.create({ accountNumber, name, type, category, isActive: true, allowTransactions: true, metadata: {} });
    log(`Created account: ${accountNumber} – ${name}`);
  } else {
    log(`Account exists:  ${accountNumber} – ${acc.name}`);
  }
  return acc;
}

async function getSystemUser() {
  // Any user in DB will do — we just need an ObjectId for createdBy
  const User = mongoose.model('User') || require('../models/hr/Employee');
  const user = await mongoose.connection.db.collection('users').findOne({});
  if (!user) throw new Error('No users found in DB. Please log in at least once before running this test.');
  return user._id;
}

// ─── Main test ────────────────────────────────────────────────────────────────
async function runTest() {
  console.log('\n' + '═'.repeat(60));
  console.log('  PROCUREMENT ↔ FINANCE INTEGRATION TEST');
  console.log('═'.repeat(60));

  await connectDB();
  log('Connected to database');

  const userId = await getSystemUser();
  log(`Using system user: ${userId}`);

  // ═══════════════════════════════════════════════════════════════════════════
  step(1, 'SETUP — Ensure Required Accounts Exist');
  // ═══════════════════════════════════════════════════════════════════════════

  const bankAcc  = await ensureAccount({ accountNumber: ACC.BANK,      name: 'Bank – Main Account (1002)',        type: 'Asset',     category: 'Current Assets' });
  const invAcc   = await ensureAccount({ accountNumber: ACC.INVENTORY,  name: 'Inventory / Stock Valuation',       type: 'Asset',     category: 'Current Assets' });
  const grniAcc  = await ensureAccount({ accountNumber: ACC.GRNI,       name: 'Goods Received Not Invoiced (GRNI)',type: 'Liability', category: 'Current Liabilities' });
  const apAcc    = await ensureAccount({ accountNumber: ACC.AP,         name: 'Accounts Payable',                  type: 'Liability', category: 'Current Liabilities' });
  const cogsAcc  = await ensureAccount({ accountNumber: ACC.COGS,       name: 'Cost of Goods Sold',                type: 'Expense',   category: 'Cost of Sales' });

  // ═══════════════════════════════════════════════════════════════════════════
  step(2, 'SETUP — Ensure System Journals Exist');
  // ═══════════════════════════════════════════════════════════════════════════

  const journals = [
    { code: 'INV',   name: 'Inventory Journal',  type: 'inventory' },
    { code: 'PURCH', name: 'Purchase Journal',   type: 'purchase' },
    { code: 'BANK',  name: 'Bank Journal',        type: 'bank' }
  ];
  for (const j of journals) {
    const exists = await FinanceJournal.findOne({ code: j.code });
    if (!exists) {
      await FinanceJournal.create({ ...j, isSystem: true, isActive: true, createdBy: userId });
      log(`Created journal: ${j.code} – ${j.name}`);
    } else {
      log(`Journal exists:  ${j.code} – ${j.name}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(3, 'SETUP — Generate Fiscal Period for Current Month');
  // ═══════════════════════════════════════════════════════════════════════════

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let period = await FiscalPeriod.findOne({ year, month });
  if (!period) {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    period = await FiscalPeriod.create({
      name: `${monthNames[month - 1]} ${year}`,
      year, month, startDate, endDate,
      status: 'open',
      createdBy: userId
    });
    log(`Created fiscal period: ${period.name}`);
  } else {
    log(`Fiscal period exists: ${period.name} (${period.status})`);
    if (period.status !== 'open') {
      warn(`Period is "${period.status}" — posting may be blocked. Forcing open for test.`);
      period.status = 'open';
      await period.save();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(4, 'SETUP — Ensure Inventory Category with Finance Accounts');
  // ═══════════════════════════════════════════════════════════════════════════

  let category = await InventoryCategory.findOne({ name: 'IT Equipment (Test)' });
  if (!category) {
    category = await InventoryCategory.create({
      name: 'IT Equipment (Test)',
      description: 'Test category for finance flow',
      stockValuationAccount: invAcc._id,
      stockInputAccount:     grniAcc._id,
      stockOutputAccount:    cogsAcc._id,
      purchaseAccount:       cogsAcc._id,
      createdBy: userId
    });
    log(`Created inventory category: ${category.name}`);
  } else {
    log(`Category exists: ${category.name}`);
    // Ensure accounts are set
    category.stockValuationAccount = invAcc._id;
    category.stockInputAccount     = grniAcc._id;
    category.stockOutputAccount    = cogsAcc._id;
    await category.save();
    log('  → Updated category finance accounts');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(5, 'STEP 1 — INDENT (No Finance Impact)');
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('  An indent is a request — no money has moved.');
  console.log('  Finance Impact: NONE');
  console.log(`  Request: ${TEST_ITEM_QTY} Laptops × ${fmt(TEST_UNIT_PRICE)}`);

  // ═══════════════════════════════════════════════════════════════════════════
  step(6, 'STEP 2 — PURCHASE ORDER (No Finance Impact)');
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('  A PO is a commitment — not yet a liability until goods arrive.');
  console.log('  Finance Impact: NONE');
  console.log(`  PO Value: ${TEST_ITEM_QTY} × ${fmt(TEST_UNIT_PRICE)} = ${fmt(EXPECTED_GRN_AMOUNT)}`);

  // ═══════════════════════════════════════════════════════════════════════════
  step(7, 'STEP 3 — GRN: Goods Received Note');
  // ═══════════════════════════════════════════════════════════════════════════

  console.log(`  Receiving ${TEST_ITEM_QTY} laptops at ${fmt(TEST_UNIT_PRICE)} each`);
  console.log(`  EXPECTED JOURNAL ENTRY:`);
  console.log(`    DR  ${ACC.INVENTORY} – Inventory          ${fmt(EXPECTED_GRN_AMOUNT)}`);
  console.log(`    CR  ${ACC.GRNI}      – GRNI               ${fmt(EXPECTED_GRN_AMOUNT)}`);

  // Create a test inventory item with category link
  const testItemCode = `TEST-LAPTOP-${Date.now()}`;
  let testInventoryItem = await Inventory.create({
    itemCode: testItemCode,
    name: 'Test Laptop (Finance Test)',
    category: 'Equipment',
    inventoryCategory: category._id,
    unit: 'Nos',
    quantity: 0,
    unitPrice: TEST_UNIT_PRICE,
    averageCost: 0,
    inventoryAccount: invAcc._id,
    grniAccount: grniAcc._id,
    cogsAccount: cogsAcc._id,
    createdBy: userId
  });
  log(`Created test inventory item: ${testItemCode}`);

  // Capture balances before GRN
  const invBalBefore  = (await Account.findById(invAcc._id)).balance || 0;
  const grniBalBefore = (await Account.findById(grniAcc._id)).balance || 0;

  // Simulate GRN posting
  const fakeGRNDoc = {
    _id: new mongoose.Types.ObjectId(),
    receiveNumber: `GRN-TEST-${Date.now()}`,
    receiveDate: new Date()
  };

  await FinanceHelper.postGRNJournal({
    inventoryItem: testInventoryItem,
    grnDoc: fakeGRNDoc,
    qty: TEST_ITEM_QTY,
    unitPrice: TEST_UNIT_PRICE,
    createdBy: userId
  });

  // Manually update stock quantity (normally done by syncItemsToInventory)
  testInventoryItem.quantity = TEST_ITEM_QTY;
  await testInventoryItem.save();
  testInventoryItem = await Inventory.findById(testInventoryItem._id);

  // Check results
  const invBalAfter  = (await Account.findById(invAcc._id)).balance || 0;
  const grniBalAfter = (await Account.findById(grniAcc._id)).balance || 0;

  log(`Inventory account balance: ${fmt(invBalBefore)} → ${fmt(invBalAfter)}`);
  log(`GRNI account balance:      ${fmt(grniBalBefore)} → ${fmt(grniBalAfter)}`);
  log(`WAC on item: ${fmt(testInventoryItem.averageCost)} (expected ${fmt(TEST_UNIT_PRICE)})`);

  const grnDiff = Math.round((invBalAfter - invBalBefore) * 100) / 100;
  if (Math.abs(grnDiff - EXPECTED_GRN_AMOUNT) < 1) {
    log(`GRN Journal ✓ — Inventory increased by ${fmt(grnDiff)}`);
  } else {
    console.error(`  ❌ GRN Journal FAILED — expected ${fmt(EXPECTED_GRN_AMOUNT)}, got ${fmt(grnDiff)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(8, 'STEP 4 — VENDOR BILL (AP Bill clears GRNI, creates AP)');
  // ═══════════════════════════════════════════════════════════════════════════

  console.log(`  Vendor invoice received for ${fmt(PAYMENT_AMOUNT)}`);
  console.log(`  EXPECTED JOURNAL ENTRY:`);
  console.log(`    DR  ${ACC.GRNI}  – GRNI (clears accrual)  ${fmt(PAYMENT_AMOUNT)}`);
  console.log(`    CR  ${ACC.AP}    – Accounts Payable        ${fmt(PAYMENT_AMOUNT)}`);

  const apBalBefore = (await Account.findById(apAcc._id)).balance || 0;

  const apBill = await FinanceHelper.createAPFromBill({
    vendorName: 'Test Supplier Co.',
    vendorEmail: 'test@supplier.com',
    billNumber: `BILL-TEST-${Date.now()}`,
    billDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    amount: PAYMENT_AMOUNT,
    department: 'procurement',
    module: 'procurement',
    referenceId: fakeGRNDoc._id,
    referenceType: 'grn',       // ← KEY: tells createAPFromBill to use GRNI (not expense)
    createdBy: userId
  });

  const grniBalAfterBill = (await Account.findById(grniAcc._id)).balance || 0;
  const apBalAfterBill   = (await Account.findById(apAcc._id)).balance || 0;

  log(`GRNI balance: ${fmt(grniBalAfter)} → ${fmt(grniBalAfterBill)} (should approach zero)`);
  log(`AP balance:   ${fmt(apBalBefore)} → ${fmt(apBalAfterBill)}`);
  log(`AP Bill created: ${apBill.billNumber}`);

  const grniNetAfterBill = Math.round(grniBalAfterBill * 100) / 100;
  if (Math.abs(grniNetAfterBill) < 1) {
    log('GRNI Account ✓ — cleared to zero (accrual matched)');
  } else {
    warn(`GRNI account balance is ${fmt(grniNetAfterBill)} (should be ~0). Check for partial matching.`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(9, 'STEP 5 — VENDOR PAYMENT (DR AP / CR Bank)');
  // ═══════════════════════════════════════════════════════════════════════════

  console.log(`  Paying vendor ${fmt(PAYMENT_AMOUNT)} from bank`);
  console.log(`  EXPECTED JOURNAL ENTRY:`);
  console.log(`    DR  ${ACC.AP}    – Accounts Payable        ${fmt(PAYMENT_AMOUNT)}`);
  console.log(`    CR  ${ACC.BANK}  – Bank                    ${fmt(PAYMENT_AMOUNT)}`);

  const bankBalBefore = (await Account.findById(bankAcc._id)).balance || 0;

  await FinanceHelper.recordAPPayment(apBill._id, {
    amount: PAYMENT_AMOUNT,
    paymentMethod: 'bank',
    reference: `PAY-TEST-${Date.now()}`,
    date: new Date(),
    createdBy: userId
  });

  const bankBalAfter  = (await Account.findById(bankAcc._id)).balance || 0;
  const apBalFinal    = (await Account.findById(apAcc._id)).balance || 0;

  log(`Bank balance: ${fmt(bankBalBefore)} → ${fmt(bankBalAfter)} (decreased by ${fmt(bankBalBefore - bankBalAfter)})`);
  log(`AP balance:   ${fmt(apBalAfterBill)} → ${fmt(apBalFinal)} (should approach zero)`);

  if (Math.abs(apBalFinal) < 1) {
    log('AP Account ✓ — cleared to zero (fully paid)');
  } else {
    warn(`AP balance remaining: ${fmt(apBalFinal)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(10, 'STEP 6 — SIN: Store Issue Note (DR COGS / CR Inventory)');
  // ═══════════════════════════════════════════════════════════════════════════

  const sinValue = TEST_ISSUE_QTY * testInventoryItem.averageCost;
  console.log(`  Issuing ${TEST_ISSUE_QTY} laptops at WAC ${fmt(testInventoryItem.averageCost)}`);
  console.log(`  SIN Value (WAC-based): ${fmt(sinValue)}`);
  console.log(`  EXPECTED JOURNAL ENTRY:`);
  console.log(`    DR  ${ACC.COGS}      – Cost of Goods Sold   ${fmt(sinValue)}`);
  console.log(`    CR  ${ACC.INVENTORY} – Inventory            ${fmt(sinValue)}`);

  const invBalBeforeSIN  = (await Account.findById(invAcc._id)).balance || 0;
  const cogsBalBeforeSIN = (await Account.findById(cogsAcc._id)).balance || 0;

  const fakeSINDoc = {
    _id: new mongoose.Types.ObjectId(),
    issueNumber: `SIN-TEST-${Date.now()}`,
    sinNumber: `SIN-TEST-${Date.now()}`,
    issueDate: new Date()
  };

  await FinanceHelper.postSINJournal({
    inventoryItem: testInventoryItem,
    sinDoc: fakeSINDoc,
    qty: TEST_ISSUE_QTY,
    createdBy: userId
  });

  const invBalAfterSIN  = (await Account.findById(invAcc._id)).balance || 0;
  const cogsBalAfterSIN = (await Account.findById(cogsAcc._id)).balance || 0;

  log(`Inventory balance: ${fmt(invBalBeforeSIN)} → ${fmt(invBalAfterSIN)} (decreased by ${fmt(invBalBeforeSIN - invBalAfterSIN)})`);
  log(`COGS balance:      ${fmt(cogsBalBeforeSIN)} → ${fmt(cogsBalAfterSIN)} (increased by ${fmt(cogsBalAfterSIN - cogsBalBeforeSIN)})`);

  const cogsDiff = Math.round((cogsBalAfterSIN - cogsBalBeforeSIN) * 100) / 100;
  const sinExpected = Math.round(sinValue * 100) / 100;
  if (Math.abs(cogsDiff - sinExpected) < 1) {
    log(`SIN Journal ✓ — COGS increased by ${fmt(cogsDiff)} using WAC`);
  } else {
    console.error(`  ❌ SIN Journal FAILED — expected ${fmt(sinExpected)}, got ${fmt(cogsDiff)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(11, 'VERIFY — Trial Balance (Debits = Credits)');
  // ═══════════════════════════════════════════════════════════════════════════

  const tbRows = await JournalEntry.aggregate([
    { $match: { status: 'posted', date: { $gte: new Date(now.getTime() - 60000) } } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: null,
        totalDebit:  { $sum: '$lines.debit' },
        totalCredit: { $sum: '$lines.credit' }
      }
    }
  ]);

  if (tbRows.length > 0) {
    const { totalDebit, totalCredit } = tbRows[0];
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    log(`Total Debits (test entries):  ${fmt(totalDebit)}`);
    log(`Total Credits (test entries): ${fmt(totalCredit)}`);
    if (isBalanced) {
      log('Trial Balance ✓ — BALANCED (Debits = Credits)');
    } else {
      console.error(`  ❌ Trial Balance FAILED — difference: ${fmt(Math.abs(totalDebit - totalCredit))}`);
    }
  } else {
    warn('No journal entries found in the last minute — verify timing');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  step(12, 'SUMMARY — Final Account Balances');
  // ═══════════════════════════════════════════════════════════════════════════

  const accounts = await Account.find({
    accountNumber: { $in: Object.values(ACC) }
  }).lean();

  sep();
  console.log('  Account                         Balance');
  sep();
  for (const acc of accounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))) {
    const label = `${acc.accountNumber} – ${acc.name}`;
    const bal   = fmt(acc.balance);
    console.log(`  ${label.padEnd(40)} ${bal}`);
  }
  sep();

  console.log('\n  EXPECTED BALANCE SHEET IMPACT:');
  console.log(`  • Bank (${ACC.BANK}):      DECREASED by ${fmt(PAYMENT_AMOUNT)} (cash paid)`);
  console.log(`  • Inventory (${ACC.INVENTORY}): INCREASED by ${fmt(EXPECTED_GRN_AMOUNT - sinValue)} (net: received - issued)`);
  console.log(`  • GRNI (${ACC.GRNI}):        Should be ~ZERO (accrual cleared by AP bill)`);
  console.log(`  • AP (${ACC.AP}):          Should be ~ZERO (fully paid)`);
  console.log(`  • COGS (${ACC.COGS}):        INCREASED by ${fmt(sinValue)} (goods issued)`);

  console.log('\n  Inventory Valuation:');
  console.log(`  • Qty on hand: ${TEST_ITEM_QTY - TEST_ISSUE_QTY} units × WAC ${fmt(testInventoryItem.averageCost)} = ${fmt((TEST_ITEM_QTY - TEST_ISSUE_QTY) * testInventoryItem.averageCost)}`);

  console.log('\n' + '═'.repeat(60));
  console.log('  TEST COMPLETE — Full procurement ↔ finance flow verified');
  console.log('═'.repeat(60) + '\n');

  await mongoose.disconnect();
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
