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

  // Find Sardar Prime Builder Company
  const targetCompany = await Company.findOne({ name: { $regex: /sardar prime builder/i } });
  if (!targetCompany) {
    console.error('Sardar Prime Builder Company not found in database!');
    process.exit(1);
  }
  console.log(`Target Company: ${targetCompany.name} (${targetCompany._id})`);

  // Target Bank Account: 1000 — Bank Alfalah
  const targetAccount = await Account.findOne({ companyId: targetCompany._id, accountNumber: '1000' });
  if (!targetAccount) {
    console.error('Account 1000 not found for Sardar Prime Builder!');
    process.exit(1);
  }
  console.log(`Target Bank Account: ${targetAccount.name} (${targetAccount.accountNumber}, ID: ${targetAccount._id})`);

  // ============================================================
  // STEP 1: REVERT ALL GL entries & JEs for this bank account to pending
  // ============================================================
  console.log('\n=== STEP 1: Reverting ALL GL entries on target account to pending ===');
  const revertGLResult = await GeneralLedger.updateMany(
    { account: targetAccount._id },
    {
      $set: {
        clearanceStatus: 'pending',
        isReconciled: false,
        reconciledAt: null,
        clearedAt: null
      }
    }
  );
  console.log(`Reverted ${revertGLResult.modifiedCount} GL entries to pending.`);

  const revertJEResult = await JournalEntry.updateMany(
    { companyId: targetCompany._id, clearanceStatus: 'cleared' },
    {
      $set: {
        clearanceStatus: 'pending',
        isReconciled: false,
        reconciledAt: null,
        clearedAt: null
      }
    }
  );
  console.log(`Reverted ${revertJEResult.modifiedCount} JEs to pending.`);

  const jeIds = await JournalEntry.find({ companyId: targetCompany._id }).select('_id').lean();
  const jeIdList = jeIds.map(j => j._id);
  const revertAllGLResult = await GeneralLedger.updateMany(
    { journalEntry: { $in: jeIdList }, clearanceStatus: 'cleared' },
    {
      $set: {
        clearanceStatus: 'pending',
        isReconciled: false,
        reconciledAt: null,
        clearedAt: null
      }
    }
  );
  console.log(`Reverted ${revertAllGLResult.modifiedCount} additional non-bank GL entries to pending.`);

  // ============================================================
  // STEP 2: Read Excel and match each row to a SPECIFIC GL entry
  // ============================================================
  const filePath = path.join(__dirname, '..', '..', 'docs', 'Sardar Prime Builders.xlsx');
  console.log('\n=== STEP 2: Reading Excel file ===');
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false });

  const excelRows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || !r[0] || r[0] === 'Total') continue;
    
    // Only process lines that have a clearing date (the actual bank account lines)
    if (!r[7]) continue;

    const rawDr = parseAmount(r[5]);
    const rawCr = parseAmount(r[6]);
    const amount = rawDr > 0 ? rawDr : rawCr;
    const isCredit = rawCr > 0;

    excelRows.push({
      rowIdx: i + 1,
      date: parseExcelDate(r[0]),
      vrNo: String(r[1] || '').trim(),
      narration: String(r[4] || '').trim(), // VrNarration
      reference: String(r[3] || '').trim(), // DocRef
      amount: Math.abs(amount),
      isCredit,
      clearingDate: parseExcelDate(r[7]), // ClearingDate
      paymentType: String(r[9] || '').trim(),
      mainAccountHead: String(r[10] || '').trim(),
      subAccountHead: String(r[11] || '').trim(),
      company: String(r[12] || '').trim(),
      project: String(r[13] || '').trim()
    });
  }
  console.log(`Loaded ${excelRows.length} transaction rows from Excel.`);

  // ============================================================
  // STEP 3: For each Excel row, find the EXACT matching GL entry
  // ============================================================
  console.log('\n=== STEP 3: Matching Excel rows to specific GL entries ===');
  
  const allTargetJEs = await JournalEntry.find({ companyId: targetCompany._id }).lean();
  const jeByEntryNumber = {};
  allTargetJEs.forEach(je => {
    jeByEntryNumber[je.entryNumber] = je;
  });

  let matchedCount = 0;
  let unmatchedCount = 0;
  const matchedGlIds = new Set(); 

  for (const row of excelRows) {
    const je = jeByEntryNumber[row.vrNo];
    if (!je) {
      console.warn(`  WARNING: JE ${row.vrNo} not found in DB!`);
      unmatchedCount++;
      continue;
    }

    const glEntries = await GeneralLedger.find({
      journalEntry: je._id,
      account: targetAccount._id
    }).lean();

    let matchedGl = null;
    for (const gl of glEntries) {
      if (matchedGlIds.has(String(gl._id))) continue;

      const glIsCredit = (Number(gl.credit) || 0) > 0;
      const glAmount = glIsCredit ? Number(gl.credit) : Number(gl.debit);

      if (glIsCredit === row.isCredit && Math.abs(glAmount - row.amount) < 1.0) {
        matchedGl = gl;
        break;
      }
    }

    if (!matchedGl) {
      console.warn(`  WARNING: No matching GL for Excel row ${row.rowIdx} (${row.vrNo}, ${row.isCredit ? 'Cr' : 'Dr'} ${row.amount})`);
      unmatchedCount++;
      continue;
    }

    matchedGlIds.add(String(matchedGl._id));

    const clearingDate = row.clearingDate || row.date || new Date();
    await GeneralLedger.updateOne(
      { _id: matchedGl._id },
      {
        $set: {
          clearanceStatus: 'cleared',
          isReconciled: true,
          reconciledAt: clearingDate,
          clearedAt: clearingDate
        }
      }
    );

    await JournalEntry.updateOne(
      { _id: je._id },
      {
        $set: {
          customPaymentType: row.paymentType || (row.isCredit ? 'Payment' : 'Receipt'),
          customMainAccountHead: row.mainAccountHead || 'General',
          customSubAccountHead: row.subAccountHead || '—',
          customCompany: row.company || 'SPB',
          customProject: row.project || '—',
          signedDocumentStatus: 'signed',
          signedDocumentAt: je.signedDocumentAt || clearingDate
        }
      }
    );

    matchedCount++;
  }

  console.log(`\nMatched and cleared: ${matchedCount} GL entries`);
  console.log(`Unmatched: ${unmatchedCount} Excel rows`);

  // ============================================================
  // STEP 4: Sync JE clearance status 
  // ============================================================
  console.log('\n=== STEP 4: Syncing JE clearance status ===');
  for (const je of allTargetJEs) {
    const totalGLCount = await GeneralLedger.countDocuments({ journalEntry: je._id });
    const clearedGLCount = await GeneralLedger.countDocuments({ journalEntry: je._id, clearanceStatus: 'cleared' });

    if (totalGLCount > 0 && clearedGLCount === totalGLCount) {
      await JournalEntry.updateOne(
        { _id: je._id },
        {
          $set: {
            clearanceStatus: 'cleared',
            isReconciled: true,
            reconciledAt: je.reconciledAt || new Date(),
            clearedAt: je.clearedAt || new Date()
          }
        }
      );
    }
  }

  // ============================================================
  // STEP 5: Verification
  // ============================================================
  console.log('\n=== VERIFICATION ===');
  const finalClearedGL = await GeneralLedger.countDocuments({ account: targetAccount._id, clearanceStatus: 'cleared' });
  const finalTotalGL = await GeneralLedger.countDocuments({ account: targetAccount._id });
  const finalPendingGL = finalTotalGL - finalClearedGL;
  console.log(`Target account GL: ${finalClearedGL} cleared, ${finalPendingGL} pending, ${finalTotalGL} total`);
  console.log(`Expected cleared: ${excelRows.length} (from Excel)`);

  const finalClearedJE = await JournalEntry.countDocuments({ companyId: targetCompany._id, clearanceStatus: 'cleared' });
  console.log(`Target JEs cleared: ${finalClearedJE}`);

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});
