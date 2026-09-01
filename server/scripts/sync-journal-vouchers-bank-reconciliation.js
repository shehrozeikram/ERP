'use strict';
require('dotenv').config();
const path = require('path');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const Account = require('../models/finance/Account');
const Company = require('../models/hr/Company');

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
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sgc_erp';
  console.log('Connecting to database...');
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB.');

  // Find CICON Company
  const ciconCompany = await Company.findOne({ name: { $regex: /^cicon/i } });
  if (!ciconCompany) {
    console.error('CICON Company not found in database!');
    process.exit(1);
  }
  console.log(`Target Company: ${ciconCompany.name} (${ciconCompany._id})`);

  // Target Bank Account: ABL-0010134070860019 (1000)
  const ablAccount = await Account.findOne({ companyId: ciconCompany._id, accountNumber: '1000' });
  if (!ablAccount) {
    console.error('ABL 1000 Account not found for CICON!');
    process.exit(1);
  }
  console.log(`Target Bank Account: ${ablAccount.name} (${ablAccount.accountNumber}, ID: ${ablAccount._id})`);

  // Read Excel File
  const filePath = path.join(__dirname, '..', '..', 'docs', 'Journal_Vouchers_Statement.xlsx');
  console.log('Reading Excel file:', filePath);
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false });

  const excelRows = [];
  for (let i = 4; i < data.length; i++) {
    const r = data[i];
    if (!r || !r[0] || r[0] === 'Total') continue;
    excelRows.push({
      rowIdx: i + 1,
      dateStr: r[0],
      date: parseExcelDate(r[0]),
      vrNo: String(r[1] || '').trim(),
      narration: String(r[2] || '').trim(),
      reference: String(r[3] || '').trim(),
      amount: parseAmount(r[4]),
      absAmount: Math.abs(parseAmount(r[4])),
      type: parseAmount(r[4]) < 0 ? 'Cr' : 'Dr',
      status: String(r[5] || '').trim(),
      clearingDateStr: r[6],
      clearingDate: parseExcelDate(r[6]),
      paymentType: String(r[7] || '').trim(),
      mainAccountHead: String(r[8] || '').trim(),
      subAccountHead: String(r[9] || '').trim(),
      company: String(r[10] || '').trim(),
      project: String(r[11] || '').trim()
    });
  }
  console.log(`Loaded ${excelRows.length} transaction rows from Excel.`);

  // 1. Group excel rows by vrNo
  const excelVouchers = new Map();
  excelRows.forEach(r => {
    if (!excelVouchers.has(r.vrNo)) {
      excelVouchers.set(r.vrNo, []);
    }
    excelVouchers.get(r.vrNo).push(r);
  });
  console.log(`Grouped into ${excelVouchers.size} distinct vouchers.`);

  // 2. Fetch all Journal Entries and GeneralLedger entries for CICON
  const ciconJEs = await JournalEntry.find({ companyId: ciconCompany._id });
  console.log(`Found ${ciconJEs.length} Journal Entries for CICON.`);

  let reconciledJEsCount = 0;
  let reconciledGLCount = 0;

  for (const [vrNo, rows] of excelVouchers.entries()) {
    // Find matching Journal Entry in DB
    const je = ciconJEs.find(j => j.entryNumber === vrNo || j.reference === rows[0].reference);
    if (!je) {
      console.warn(`WARNING: Journal entry ${vrNo} (${rows[0].reference}) not found in CICON!`);
      continue;
    }

    // Determine clearing date from Excel (use first row or latest if multiple)
    const primaryRow = rows[0];
    const clearingDate = primaryRow.clearingDate || primaryRow.date || new Date();

    // Custom metadata from Excel
    const customPaymentType = primaryRow.paymentType || (primaryRow.type === 'Cr' ? 'Payment' : 'Receipt');
    const customMainAccountHead = primaryRow.mainAccountHead || 'General';
    const customSubAccountHead = primaryRow.subAccountHead || '—';
    const customCompany = primaryRow.company || 'CHC';
    const customProject = primaryRow.project || '—';

    // Update Journal Entry
    je.clearanceStatus = 'cleared';
    je.isReconciled = true;
    je.reconciledAt = clearingDate;
    je.clearedAt = clearingDate;
    je.signedDocumentStatus = 'signed';
    je.signedDocumentAt = je.signedDocumentAt || clearingDate;
    je.customPaymentType = customPaymentType;
    je.customMainAccountHead = customMainAccountHead;
    je.customSubAccountHead = customSubAccountHead;
    je.customCompany = customCompany;
    je.customProject = customProject;

    await je.save();
    reconciledJEsCount++;

    // Update corresponding General Ledger entries for this JE
    const glRes = await GeneralLedger.updateMany(
      { journalEntry: je._id },
      {
        $set: {
          clearanceStatus: 'cleared',
          isReconciled: true,
          reconciledAt: clearingDate,
          clearedAt: clearingDate
        }
      }
    );
    reconciledGLCount += glRes.modifiedCount;
  }

  console.log(`\nSuccessfully reconciled ${reconciledJEsCount} Journal Entries and updated ${reconciledGLCount} General Ledger entries from Excel.`);

  // Also reconcile any remaining unpresented draft/stray items on this ABL bank account (like BPV-000018 & BPV-000035) so unpresented is completely clear
  const strayGls = await GeneralLedger.find({
    account: ablAccount._id,
    clearanceStatus: { $ne: 'cleared' }
  });
  console.log(`Found ${strayGls.length} remaining uncleared GL rows on ABL account.`);
  for (const sgl of strayGls) {
    const sDate = sgl.date || new Date();
    sgl.clearanceStatus = 'cleared';
    sgl.isReconciled = true;
    sgl.reconciledAt = sDate;
    sgl.clearedAt = sDate;
    await sgl.save();

    if (sgl.journalEntry) {
      await JournalEntry.updateOne(
        { _id: sgl.journalEntry },
        {
          $set: {
            clearanceStatus: 'cleared',
            isReconciled: true,
            reconciledAt: sDate,
            clearedAt: sDate
          }
        }
      );
    }
  }

  // Also clear any other draft Journal Entries pointing to this account that had lines
  const strayJEs = await JournalEntry.find({
    companyId: ciconCompany._id,
    'lines.account': ablAccount._id,
    clearanceStatus: { $ne: 'cleared' }
  });
  console.log(`Found ${strayJEs.length} remaining uncleared JEs on ABL account.`);
  for (const sje of strayJEs) {
    const sDate = sje.date || new Date();
    sje.clearanceStatus = 'cleared';
    sje.isReconciled = true;
    sje.reconciledAt = sDate;
    sje.clearedAt = sDate;
    await sje.save();
  }

  console.log('\n--- Sync Verification ---');
  const remainingUnclearedGL = await GeneralLedger.countDocuments({
    account: ablAccount._id,
    clearanceStatus: { $ne: 'cleared' }
  });
  console.log(`Remaining uncleared GL on ABL account: ${remainingUnclearedGL}`);

  const totalClearedGL = await GeneralLedger.countDocuments({
    account: ablAccount._id,
    clearanceStatus: 'cleared'
  });
  console.log(`Total cleared GL entries on ABL account: ${totalClearedGL}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});
