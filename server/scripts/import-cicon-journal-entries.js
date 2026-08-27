/**
 * Script to import CICON Journal Entries from Excel (docs/CICON Entries - 30 June 2025.xlsx)
 * into JournalEntry and GeneralLedger collections for PlacementCompany "CICON".
 *
 * Run: node server/scripts/import-cicon-journal-entries.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const xlsx = require('xlsx');

dotenv.config({ path: path.join(__dirname, '../../.env') });
if (!process.env.MONGODB_URI_LOCAL) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

const PlacementCompany = require('../models/hr/Company');
const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const User = require('../models/User');
const Department = require('../models/hr/Department');
const FinanceHelper = require('../utils/financeHelper');
const { getNextJournalEntryNumber } = require('../utils/journalEntryNumbering');

function excelDateToJSDate(serial) {
  if (serial instanceof Date) return serial;
  if (typeof serial === 'number') {
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }
  return new Date(serial);
}

async function run() {
  const isProduction = process.env.NODE_ENV === 'production';
  const uri = isProduction
    ? (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc_erp')
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp_local');

  console.log(`Connecting to MongoDB (${isProduction ? 'PRODUCTION' : 'LOCAL'}) at:`, uri.replace(/:[^:@]+@/, ':****@'));
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  // 1. Locate CICON PlacementCompany
  const cicon = await PlacementCompany.findOne({ name: new RegExp('cicon', 'i') });
  if (!cicon) {
    throw new Error('PlacementCompany "CICON" not found in database. Run import-cicon-chart-of-accounts.js first.');
  }
  const companyId = cicon._id;
  console.log(`Found CICON company: ${cicon.name} (${cicon.companyCode}) - ID: ${companyId}`);

  // 2. Locate Admin user and Finance department for audit fields
  const adminUser = (await User.findOne({ role: 'super_admin' })) ||
                    (await User.findOne({ role: 'admin' })) ||
                    (await User.findOne({}));
  if (!adminUser) throw new Error('No admin user found for authoring entries');
  const userId = adminUser._id;

  const financeDept = (await Department.findOne({ name: new RegExp('finance', 'i') })) ||
                      (await Department.findOne({ isActive: true }));
  if (!financeDept) throw new Error('No department found for journal entries');
  const departmentId = financeDept._id;

  // 3. Ensure all accounts for CICON exist
  const accounts = await Account.find({ companyId });
  const accMap = new Map();
  accounts.forEach((a) => accMap.set(String(a.accountNumber).trim(), a));

  // 4. Read Excel Document
  const filePath = path.join(__dirname, '../../docs/CICON Entries - 30 June 2025.xlsx');
  console.log('Reading Excel file:', filePath);
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const raw = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { raw: true });

  console.log(`Read ${raw.length} transaction rows from sheet: ${sheetName}`);

  // 5. Parse and group into balanced Journal Entry batches
  let currentBatch = [];
  const batches = [];
  let curDr = 0;
  let curCr = 0;

  raw.forEach((r) => {
    const dr = Number(r.Debit) || 0;
    const cr = Number(r.Credit) || 0;
    curDr += dr;
    curCr += cr;
    currentBatch.push(r);

    if (Math.abs(curDr - curCr) < 0.01 && currentBatch.length > 1) {
      batches.push(currentBatch);
      currentBatch = [];
      curDr = 0;
      curCr = 0;
    }
  });

  if (currentBatch.length > 0) {
    throw new Error(`Leftover unbalanced rows: ${currentBatch.length} rows (Dr: ${curDr}, Cr: ${curCr})`);
  }

  console.log(`Successfully grouped into ${batches.length} balanced Journal Entries.`);

  // 6. Check existing imported entries for CICON to avoid duplicate runs
  const existingCount = await JournalEntry.countDocuments({ companyId, referenceType: 'adjustment', notes: 'Imported from CICON Excel' });
  if (existingCount > 0) {
    console.log(`Found ${existingCount} already imported CICON entries. Cleaning up existing imported entries first...`);
    const existingJEs = await JournalEntry.find({ companyId, referenceType: 'adjustment', notes: 'Imported from CICON Excel' }).select('_id');
    const jeIds = existingJEs.map(e => e._id);
    await GeneralLedger.deleteMany({ journalEntry: { $in: jeIds } });
    await JournalEntry.deleteMany({ _id: { $in: jeIds } });
    console.log('Previous import cleaned up successfully.');
  }

  // 7. Process and insert each Journal Entry
  console.log('\n--- Importing Journal Entries & Posting to General Ledger ---');
  let importedCount = 0;
  let totalDrAmount = 0;
  let totalCrAmount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const entryDate = excelDateToJSDate(batch[0].Date);
    const mainDesc = batch[0].Description ||
                     batch.find((l) => l.Description)?.Description ||
                     'CICON Journal Entry';

    const lines = [];
    let bDr = 0;
    let bCr = 0;

    for (const r of batch) {
      const code = String(r['Account Code'] || '').trim();
      const acc = accMap.get(code);
      if (!acc) {
        throw new Error(`Account code ${code} (${r.Account}) not found in CICON chart of accounts!`);
      }

      const dr = Math.round((Number(r.Debit) || 0) * 100) / 100;
      const cr = Math.round((Number(r.Credit) || 0) * 100) / 100;

      if (dr === 0 && cr === 0) continue; // Skip blank zero lines

      bDr += dr;
      bCr += cr;

      lines.push({
        account: acc._id,
        description: r.Description ? String(r.Description).trim() : mainDesc,
        debit: dr,
        credit: cr,
        department: departmentId
      });
    }

    totalDrAmount += bDr;
    totalCrAmount += bCr;

    // Generate entry number
    const entryNumber = await getNextJournalEntryNumber('JV', cicon.companyCode);

    const je = new JournalEntry({
      entryNumber,
      date: entryDate,
      reference: `CICON-JE-${String(i + 1).padStart(4, '0')}`,
      description: mainDesc,
      department: departmentId,
      module: 'finance',
      referenceType: 'adjustment',
      companyId,
      status: 'posted',
      postedBy: userId,
      postedDate: new Date(),
      lines,
      totalDebits: bDr,
      totalCredits: bCr,
      createdBy: userId,
      notes: 'Imported from CICON Excel'
    });

    await je.save();

    // Post to General Ledger
    await FinanceHelper.postToGeneralLedger(je._id);

    importedCount++;
    if (importedCount % 20 === 0 || importedCount === batches.length) {
      console.log(`✓ Processed ${importedCount} / ${batches.length} entries (${entryNumber})`);
    }
  }

  // 8. Recalculate account balances
  console.log('\n--- Recalculating Account Balances for CICON ---');
  for (const acc of accounts) {
    const glEntries = await GeneralLedger.find({ account: acc._id, status: 'posted' });
    let debitSum = 0;
    let creditSum = 0;
    glEntries.forEach((g) => {
      debitSum += Number(g.debit) || 0;
      creditSum += Number(g.credit) || 0;
    });

    let balance = 0;
    if (['Asset', 'Expense'].includes(acc.type)) {
      balance = debitSum - creditSum;
    } else {
      balance = creditSum - debitSum;
    }

    acc.balance = Math.round(balance * 100) / 100;
    await acc.save();
  }

  console.log('\n======================================================');
  console.log('CICON Journal Entries Import Completed Successfully!');
  console.log(`Total Entries Created & Posted: ${importedCount}`);
  console.log(`Total Debits: PKR ${totalDrAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
  console.log(`Total Credits: PKR ${totalCrAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
  console.log('======================================================');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
