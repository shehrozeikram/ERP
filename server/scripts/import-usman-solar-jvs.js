const mongoose = require('mongoose');
const path = require('path');
const xlsx = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('../config/database');
const PlacementCompany = require('../models/hr/Company');
const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const User = require('../models/User');

const excelPath = path.join(__dirname, '../../docs/Usman solar - data import.xlsx');

const COA_DEFINITIONS = [
  { accountNumber: '1000', name: 'ABL-0010130385030016', type: 'Asset', category: 'Current Assets', detailType: 'Bank', accountCode: 'BANK_ABL' },
  { accountNumber: '1003', name: 'Bank Islami# 640001', type: 'Asset', category: 'Current Assets', detailType: 'Bank', accountCode: 'BANK_ISLAMI' },
  { accountNumber: '1004', name: 'JV Partner Clearing A/C', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1005', name: 'Advance Tax Recoverable', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1006', name: 'Accumulated depreciation on property, plant and equipment', type: 'Asset', category: 'Fixed Assets', detailType: 'Accumulated Depreciation' },
  { accountNumber: '1007', name: 'Furniture & Fixture', type: 'Asset', category: 'Fixed Assets', detailType: 'Property, Plant and Equipment' },
  { accountNumber: '1008', name: 'Security Deposits', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1009', name: 'Sale of Solar System', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets' },
  { accountNumber: '1100', name: 'Accounts Receivable', type: 'Asset', category: 'Current Assets', detailType: 'Accounts Receivable', accountCode: 'RECEIVABLE', isSystem: true },
  { accountNumber: '1120', name: 'Cash Advance to Staff', type: 'Asset', category: 'Current Assets', detailType: 'Other Current Assets', accountCode: 'STAFF_ADVANCE' },
  { accountNumber: '1200', name: 'Inventory', type: 'Asset', category: 'Current Assets', detailType: 'Inventory' },
  { accountNumber: '2000', name: 'WHT-Employees Salary', type: 'Liability', category: 'Current Liabilities', detailType: 'Tax Payable' },
  { accountNumber: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities', detailType: 'Accounts Payable', accountCode: 'PAYABLE', isSystem: true },
  { accountNumber: '2002', name: 'Sardar Group of Companies', type: 'Liability', category: 'Current Liabilities', detailType: 'Intercompany Payable' },
  { accountNumber: '2003', name: 'Taj Residencia', type: 'Liability', category: 'Current Liabilities', detailType: 'Intercompany Payable' },
  { accountNumber: '2200', name: 'Salaries Payable', type: 'Liability', category: 'Current Liabilities', detailType: 'Payroll Liabilities', accountCode: 'SALARIES_PAYABLE', isSystem: true },
  { accountNumber: '2211-01', name: 'EOBI Payable - Employee Contribution', type: 'Liability', category: 'Current Liabilities', detailType: 'Payroll Liabilities' },
  { accountNumber: '2211-02', name: 'EOBI Payable - Employer Contribution', type: 'Liability', category: 'Current Liabilities', detailType: 'Payroll Liabilities', accountCode: 'EOBI_PAYABLE' },
  { accountNumber: '3002', name: 'Retained Earnings', type: 'Equity', category: 'Equity', detailType: 'Retained Earnings', accountCode: 'RETAINED_EARNINGS', isSystem: true },
  { accountNumber: '4000', name: 'Bank Profit', type: 'Revenue', category: 'Non-operating Revenue', detailType: 'Other Income' },
  { accountNumber: '4001', name: 'Sales Revenue', type: 'Revenue', category: 'Operating Revenue', detailType: 'Sales' },
  { accountNumber: '5000', name: 'Cost of Goods Sold', type: 'Expense', category: 'Cost of Goods Sold', detailType: 'Supplies and Materials' },
  { accountNumber: '5001', name: 'General Expenses', type: 'Expense', category: 'Operating Expenses', detailType: 'Other Operating Expenses', accountCode: 'EXPENSE_GENERAL' },
  { accountNumber: '5002', name: 'Salaries Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Payroll Expenses', accountCode: 'EXPENSE_SALARIES' },
  { accountNumber: '5003', name: 'Depreciation Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Depreciation', accountCode: 'DEPRECIATION' },
  { accountNumber: '5004', name: 'Dues and subscriptions', type: 'Expense', category: 'Operating Expenses', detailType: 'Admin Expenses' },
  { accountNumber: '5005', name: 'Internet Charges', type: 'Expense', category: 'Operating Expenses', detailType: 'Utilities' },
  { accountNumber: '5015', name: 'EOBI Expense', type: 'Expense', category: 'Operating Expenses', detailType: 'Payroll Expenses', accountCode: 'EOBI_EXPENSE' },
  { accountNumber: '6200', name: 'Utilities (Electricity/Gas)', type: 'Expense', category: 'Operating Expenses', detailType: 'Utilities' }
];

function excelDateToJSDate(serial) {
  if (serial instanceof Date) return serial;
  if (typeof serial === 'string') {
    const parsed = new Date(serial);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), 12, 0, 0);
}

async function runImport() {
  await connectDB();

  try {
    await PlacementCompany.collection.dropIndex('code_1');
  } catch (_) {}

  // 1. Get or Create Company "Usman Solar (Pvt) Ltd"
  let company = await PlacementCompany.findOne({
    $or: [
      { name: { $regex: /usman solar/i } },
      { companyCode: 'USMAN_SOLAR' },
      { companyCode: 'US' }
    ]
  });

  if (!company) {
    console.log('Creating PlacementCompany "Usman Solar (Pvt) Ltd"...');
    company = await PlacementCompany.create({
      name: 'Usman Solar (Pvt) Ltd',
      companyCode: 'USMAN_SOLAR',
      type: 'Private Limited',
      isActive: true
    });
    console.log('Created Company ID:', company._id);
  } else {
    console.log('Found Company:', company.name, 'ID:', company._id);
  }

  const companyId = company._id;

  // 2. Find Admin / System User & Department
  let adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
  if (!adminUser) {
    adminUser = await User.findOne({});
  }
  const userId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();
  console.log('Using Admin User ID:', userId);

  const Department = mongoose.models.Department || require('../models/hr/Department');
  let deptDoc = await Department.findOne({}).lean();
  if (!deptDoc) {
    deptDoc = await Department.create({ name: 'General / Finance' });
  }
  const deptId = deptDoc._id;
  console.log('Using Department ID:', deptId);

  // 3. Ensure Chart of Accounts for Usman Solar
  console.log('\n--- Checking & Seeding Chart of Accounts for Usman Solar ---');
  const accountMap = new Map(); // accNumber -> Account doc

  for (const def of COA_DEFINITIONS) {
    let acc = await Account.findOne({ companyId, accountNumber: def.accountNumber });
    if (!acc) {
      acc = await Account.findOne({ companyId, name: { $regex: new RegExp(`^${def.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    }
    if (!acc) {
      acc = await Account.create({
        ...def,
        companyId,
        createdBy: userId,
        isActive: true
      });
      console.log(`  + Created COA: [${acc.accountNumber}] ${acc.name}`);
    } else {
      console.log(`  = Found COA: [${acc.accountNumber}] ${acc.name}`);
    }
    accountMap.set(String(def.accountNumber), acc);
  }

  // 4. Read Excel File
  console.log('\n--- Reading Excel File ---');
  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets['General Journal'];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Total raw sheet rows: ${rawRows.length}`);

  // Group lines by Voucher No
  const voucherGroups = new Map(); // vNo -> array of row items

  for (let i = 4; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !row[0] || !row[1]) continue;

    const dateVal = excelDateToJSDate(row[0]);
    const vNo = String(row[1]).trim();
    const accCode = String(row[2]).trim();
    const accTitle = String(row[3] || '').trim();
    const description = String(row[4] || '').trim();
    const chequeNo = row[5] ? String(row[5]).trim() : '';
    const debit = Number(row[6]) || 0;
    const credit = Number(row[7]) || 0;

    if (!voucherGroups.has(vNo)) {
      voucherGroups.set(vNo, []);
    }

    voucherGroups.get(vNo).push({
      date: dateVal,
      voucherNo: vNo,
      accountCode: accCode,
      accountTitle: accTitle,
      description,
      chequeNo,
      debit,
      credit
    });
  }

  console.log(`Total unique Vouchers to process: ${voucherGroups.size}`);

  // 5. Clean existing Journal Entries for this company to prevent duplicates
  console.log('\n--- Cleaning old JVs for Usman Solar ---');
  const deletedJEs = await JournalEntry.deleteMany({ companyId });
  console.log(`Deleted ${deletedJEs.deletedCount} existing JournalEntries for Usman Solar.`);
  await GeneralLedger.deleteMany({ companyId });

  // 6. Import Vouchers into JournalEntry and GeneralLedger
  console.log('\n--- Importing Journal Entries & Posting to General Ledger ---');
  let importedCount = 0;
  let skippedCount = 0;
  let totalDebitsSum = 0;
  let totalCreditsSum = 0;

  for (const [vNo, lines] of voucherGroups.entries()) {
    let totalDebit = 0;
    let totalCredit = 0;
    const jeLines = [];
    const vDate = lines[0].date;

    // Detect voucher series (BPV, BRV, CPV, CRV, JV)
    let voucherSeries = 'JV';
    if (vNo.startsWith('BPV')) voucherSeries = 'BPV';
    else if (vNo.startsWith('BRV')) voucherSeries = 'BRV';
    else if (vNo.startsWith('CPV')) voucherSeries = 'CPV';
    else if (vNo.startsWith('CRV')) voucherSeries = 'CRV';

    // Find main cheque number if present
    const chequeNo = lines.find((l) => l.chequeNo)?.chequeNo || '';

    for (const l of lines) {
      if (!l.debit && !l.credit) continue; // Skip zero-amount lines

      totalDebit += l.debit;
      totalCredit += l.credit;

      let accDoc = accountMap.get(l.accountCode);
      if (!accDoc) {
        // Fallback search
        accDoc = await Account.findOne({ companyId, accountNumber: l.accountCode });
      }
      if (!accDoc) {
        console.error(`ERROR: Account code "${l.accountCode}" not found for line in voucher ${vNo}`);
        continue;
      }

      jeLines.push({
        account: accDoc._id,
        description: l.description || `${voucherSeries} Line Item`,
        debit: l.debit,
        credit: l.credit,
        department: 'general'
      });
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.warn(`Skipping unbalanced voucher ${vNo}: Debit ${totalDebit} != Credit ${totalCredit}`);
      skippedCount++;
      continue;
    }

    const firstLineDesc = lines[0]?.description || `Voucher ${vNo}`;

    const formattedEntryNumber = `${vNo}-${company.companyCode || 'USMAN_SOLAR'}`;

    // Create Journal Entry
    const je = await JournalEntry.create({
      companyId,
      entryNumber: formattedEntryNumber,
      date: vDate,
      reference: chequeNo || vNo,
      description: firstLineDesc,
      department: deptId,
      module: 'finance',
      status: 'posted',
      journalCode: voucherSeries.includes('BP') || voucherSeries.includes('BR') ? 'BANK' : voucherSeries.includes('CP') || voucherSeries.includes('CR') ? 'CASH' : 'GEN',
      voucherSeries,
      referenceType: 'manual',
      isImported: true,
      lines: jeLines,
      totalDebits: totalDebit,
      totalCredits: totalCredit,
      createdBy: userId,
      postedBy: userId,
      postedAt: vDate
    });

    // Create General Ledger entries
    const glDocs = [];
    for (const l of jeLines) {
      glDocs.push({
        companyId,
        journalEntry: je._id,
        account: l.account,
        date: vDate,
        entryNumber: formattedEntryNumber,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
        reference: chequeNo || vNo,
        status: 'posted',
        department: 'general',
        module: 'finance',
        isImported: true,
        createdBy: userId
      });
    }
    await GeneralLedger.insertMany(glDocs);

    importedCount++;
    totalDebitsSum += totalDebit;
    totalCreditsSum += totalCredit;
  }

  console.log('\n================ IMPORT COMPLETE ================');
  console.log(`Successfully Imported Vouchers : ${importedCount}`);
  console.log(`Skipped Unbalanced Vouchers     : ${skippedCount}`);
  console.log(`Total Debits Sum                : PKR ${Math.round(totalDebitsSum).toLocaleString()}`);
  console.log(`Total Credits Sum               : PKR ${Math.round(totalCreditsSum).toLocaleString()}`);
  console.log('=================================================\n');

  process.exit(0);
}

runImport().catch((err) => {
  console.error('Import failed with error:', err);
  process.exit(1);
});
