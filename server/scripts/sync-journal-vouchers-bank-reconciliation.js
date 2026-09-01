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

  // ============================================================
  // STEP 1: REVERT ALL GL entries & JEs for this ABL bank account to pending
  // ============================================================
  console.log('\n=== STEP 1: Reverting ALL GL entries on ABL account to pending ===');
  const revertGLResult = await GeneralLedger.updateMany(
    { account: ablAccount._id },
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

  // Also revert all CICON JEs that were cleared
  const revertJEResult = await JournalEntry.updateMany(
    { companyId: ciconCompany._id, clearanceStatus: 'cleared' },
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

  // Also revert ALL GL entries for any CICON JE (non-bank GL entries that got cleared by mistake)
  const ciconJeIds = await JournalEntry.find({ companyId: ciconCompany._id }).select('_id').lean();
  const ciconJeIdList = ciconJeIds.map(j => j._id);
  const revertAllGLResult = await GeneralLedger.updateMany(
    { journalEntry: { $in: ciconJeIdList }, clearanceStatus: 'cleared' },
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
  const filePath = path.join(__dirname, '..', '..', 'docs', 'Journal_Vouchers_Statement.xlsx');
  console.log('\n=== STEP 2: Reading Excel file ===');
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false });

  const excelRows = [];
  for (let i = 4; i < data.length; i++) {
    const r = data[i];
    if (!r || !r[0] || r[0] === 'Total') continue;
    const rawAmount = parseAmount(r[4]);
    excelRows.push({
      rowIdx: i + 1,
      date: parseExcelDate(r[0]),
      vrNo: String(r[1] || '').trim(),
      narration: String(r[2] || '').trim(),
      reference: String(r[3] || '').trim(),
      amount: Math.abs(rawAmount),
      isCredit: rawAmount < 0,       // Negative = credit (payment out)
      clearingDate: parseExcelDate(r[6]),
      paymentType: String(r[7] || '').trim(),
      mainAccountHead: String(r[8] || '').trim(),
      subAccountHead: String(r[9] || '').trim(),
      company: String(r[10] || '').trim(),
      project: String(r[11] || '').trim()
    });
  }
  console.log(`Loaded ${excelRows.length} transaction rows from Excel.`);

  // ============================================================
  // STEP 3: For each Excel row, find the EXACT matching GL entry
  // ============================================================
  console.log('\n=== STEP 3: Matching Excel rows to specific GL entries ===');
  
  // Cache all CICON JEs by entryNumber
  const allCiconJEs = await JournalEntry.find({ companyId: ciconCompany._id }).lean();
  const jeByEntryNumber = {};
  allCiconJEs.forEach(je => {
    jeByEntryNumber[je.entryNumber] = je;
  });

  let matchedCount = 0;
  let unmatchedCount = 0;
  const matchedGlIds = new Set(); // Track which GL IDs have been matched to avoid double-matching

  for (const row of excelRows) {
    const je = jeByEntryNumber[row.vrNo];
    if (!je) {
      console.warn(`  WARNING: JE ${row.vrNo} not found in DB!`);
      unmatchedCount++;
      continue;
    }

    // Find GL entries for this JE that hit the ABL bank account
    const glEntries = await GeneralLedger.find({
      journalEntry: je._id,
      account: ablAccount._id
    }).lean();

    // Match by: amount AND debit/credit direction
    // Excel: isCredit=true means amount is in credit column (payment out of bank)
    //         isCredit=false means amount is in debit column (receipt into bank)
    let matchedGl = null;
    for (const gl of glEntries) {
      if (matchedGlIds.has(String(gl._id))) continue; // Already used

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

    // Update ONLY this specific GL entry
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

    // Update the parent JE with custom metadata (these are display fields on JE level)
    await JournalEntry.updateOne(
      { _id: je._id },
      {
        $set: {
          customPaymentType: row.paymentType || (row.isCredit ? 'Payment' : 'Receipt'),
          customMainAccountHead: row.mainAccountHead || 'General',
          customSubAccountHead: row.subAccountHead || '—',
          customCompany: row.company || 'CHC',
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
  // STEP 4: Sync JE clearance status based on whether ALL its GL entries are cleared
  // ============================================================
  console.log('\n=== STEP 4: Syncing JE clearance status ===');
  for (const je of allCiconJEs) {
    const totalGLCount = await GeneralLedger.countDocuments({ journalEntry: je._id });
    const clearedGLCount = await GeneralLedger.countDocuments({ journalEntry: je._id, clearanceStatus: 'cleared' });

    if (totalGLCount > 0 && clearedGLCount === totalGLCount) {
      // ALL GL entries cleared → mark JE as cleared
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
    // Otherwise JE stays pending (individual GL entries may be cleared)
  }

  // ============================================================
  // STEP 5: Verification
  // ============================================================
  console.log('\n=== VERIFICATION ===');
  const finalClearedGL = await GeneralLedger.countDocuments({ account: ablAccount._id, clearanceStatus: 'cleared' });
  const finalTotalGL = await GeneralLedger.countDocuments({ account: ablAccount._id });
  const finalPendingGL = finalTotalGL - finalClearedGL;
  console.log(`ABL account GL: ${finalClearedGL} cleared, ${finalPendingGL} pending, ${finalTotalGL} total`);
  console.log(`Expected cleared: ${excelRows.length} (from Excel)`);

  const finalClearedJE = await JournalEntry.countDocuments({ companyId: ciconCompany._id, clearanceStatus: 'cleared' });
  console.log(`CICON JEs cleared: ${finalClearedJE}`);

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});
