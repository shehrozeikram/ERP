'use strict';
/**
 * Script to import SPB Journal Entries from Excel (docs/Sardar Prime Builders.xlsx)
 * into JournalEntry and GeneralLedger collections for Company "Sardar Prime Builder".
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const xlsx = require('xlsx');

dotenv.config({ path: path.join(__dirname, '../../.env') });
if (!process.env.MONGODB_URI_LOCAL) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

const Company = require('../models/hr/Company');
const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const User = require('../models/User');
const Department = require('../models/hr/Department');
const FinanceHelper = require('../utils/financeHelper');
const { getNextJournalEntryNumber } = require('../utils/journalEntryNumbering');

function parseAmount(val) {
  if (val === undefined || val === null || val === '') return 0;
  let str = String(val).trim().replace(/,/g, '');
  let isNeg = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNeg = true;
    str = str.slice(1, -1).trim();
  }
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNeg ? -num : num;
}

function parseExcelDate(val) {
  if (!val) return null;
  val = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(val + 'T12:00:00.000Z');
  }
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const parts = val.split('-');
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let mon = monthMap[parts[1].toLowerCase().slice(0, 3)];
    let yr = parts[2];
    if (yr.length === 2) yr = '20' + yr;
    if (mon) return new Date(`${yr}-${mon}-${day}T12:00:00.000Z`);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function run() {
  const isProduction = process.env.NODE_ENV === 'production' || !process.env.MONGODB_URI_LOCAL;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sgc_erp';

  console.log(`Connecting to MongoDB at:`, uri.replace(/:[^:@]+@/, ':****@'));
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  // 1. Locate SPB Company
  const spb = await Company.findOne({ name: /sardar prime builder/i });
  if (!spb) {
    throw new Error('Company "Sardar Prime Builder" not found in database.');
  }
  const companyId = spb._id;
  console.log(`Found company: ${spb.name} - ID: ${companyId}`);

  // 2. Locate Admin user and Finance department
  const adminUser = (await User.findOne({ role: 'super_admin' })) ||
                    (await User.findOne({ role: 'admin' })) ||
                    (await User.findOne({}));
  if (!adminUser) throw new Error('No admin user found for authoring entries');
  const userId = adminUser._id;

  const financeDept = (await Department.findOne({ name: new RegExp('finance', 'i') })) ||
                      (await Department.findOne({ isActive: true }));
  if (!financeDept) throw new Error('No department found for journal entries');
  const departmentId = financeDept._id;

  // 3. Ensure all accounts for SPB exist
  const accounts = await Account.find({ companyId });
  const accMap = new Map();
  accounts.forEach((a) => accMap.set(String(a.accountNumber).trim(), a));

  // 4. Read Excel Document
  const filePath = path.join(__dirname, '../../docs/Sardar Prime Builders.xlsx');
  console.log('Reading Excel file:', filePath);
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false });

  // 5. Group rows by VrNo
  const groupedJEs = {};
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || !r[0] || r[0] === 'Total' || !r[1]) continue;
    
    const vrNo = String(r[1]).trim();
    if (!groupedJEs[vrNo]) {
      groupedJEs[vrNo] = [];
    }
    groupedJEs[vrNo].push(r);
  }
  
  const vrList = Object.keys(groupedJEs);
  console.log(`Found ${vrList.length} unique Journal Entries in Excel.`);

  // 6. Check existing imported entries for SPB
  const existingCount = await JournalEntry.countDocuments({ companyId, notes: 'Imported from SPB Excel' });
  if (existingCount > 0) {
    console.log(`Found ${existingCount} already imported SPB entries. Cleaning up existing imported entries first...`);
    const existingJEs = await JournalEntry.find({ companyId, notes: 'Imported from SPB Excel' }).select('_id');
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

  for (const vrNo of vrList) {
    const batch = groupedJEs[vrNo];
    const entryDate = parseExcelDate(batch[0][0]);
    const mainDesc = String(batch[0][4] || '').trim() || 'SPB Journal Entry';
    const docRef = String(batch[0][3] || '').trim();

    const lines = [];
    let bDr = 0;
    let bCr = 0;

    for (const r of batch) {
      const accountHeadStr = String(r[2] || '');
      const code = accountHeadStr.split('—')[0].trim();
      const acc = accMap.get(code);
      if (!acc) {
        throw new Error(`Account code ${code} (${accountHeadStr}) not found in SPB chart of accounts!`);
      }

      const dr = Math.round((parseAmount(r[5]) || 0) * 100) / 100;
      const cr = Math.round((parseAmount(r[6]) || 0) * 100) / 100;

      if (dr === 0 && cr === 0) continue; 

      bDr += dr;
      bCr += cr;

      lines.push({
        account: acc._id,
        description: r[4] ? String(r[4]).trim() : mainDesc,
        debit: dr,
        credit: cr,
        department: departmentId
      });
    }

    if (Math.abs(bDr - bCr) > 0.01) {
      console.warn(`WARNING: JE ${vrNo} is not balanced! Dr: ${bDr}, Cr: ${bCr}. Difference: ${bDr - bCr}`);
    }

    totalDrAmount += bDr;
    totalCrAmount += bCr;

    // Use the VrNo from Excel directly as entryNumber (e.g., BPV-1)
    const je = new JournalEntry({
      entryNumber: vrNo,
      date: entryDate,
      reference: docRef || `SPB-JE-${vrNo}`,
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
      notes: 'Imported from SPB Excel'
    });

    await je.save();

    // Post to General Ledger
    await FinanceHelper.postToGeneralLedger(je._id);

    importedCount++;
  }

  // 8. Recalculate account balances
  console.log('\n--- Recalculating Account Balances for SPB ---');
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
  console.log('SPB Journal Entries Import Completed Successfully!');
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
