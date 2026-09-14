const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');

async function run() {
  try {
    // Determine URI (use local development DB as requested)
    let uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
    // Force to sgc_erp_local if it's pointing to sgc_erp by mistake
    if (uri && uri.includes('127.0.0.1') && uri.endsWith('sgc_erp')) {
      uri = uri.replace('sgc_erp', 'sgc_erp_local');
    }
    console.log(`Connecting to database: ${uri.split('@').pop()}`); // hide password if any
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const filePath = path.join(__dirname, '../../docs/CICON Full data.xlsx');
    console.log(`Reading Excel file: ${filePath}`);
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Build a map of Voucher No -> Cheque No.
    const chequeMap = new Map();
    let mappedCount = 0;

    data.forEach(row => {
      const voucherNo = row['Voucher No'];
      const chequeNo = row['Cheque No.'];
      
      if (voucherNo && chequeNo) {
        const cleanVoucher = String(voucherNo).trim();
        const cleanCheque = String(chequeNo).trim();
        
        // If we haven't mapped this voucher yet, or we found a non-empty cheque, map it.
        if (cleanCheque && !chequeMap.has(cleanVoucher)) {
          chequeMap.set(cleanVoucher, cleanCheque);
          mappedCount++;
        }
      }
    });

    console.log(`Found ${mappedCount} unique vouchers with cheque numbers in Excel.`);

    let jeUpdated = 0;
    let glUpdated = 0;

    // We will find all Journal Entries that have "Excel Import"
    const journalEntries = await JournalEntry.find({ reference: /Excel Import/i });
    console.log(`Found ${journalEntries.length} Journal Entries with 'Excel Import' as reference.`);

    for (const je of journalEntries) {
      if (chequeMap.has(je.entryNumber)) {
        const cheque = chequeMap.get(je.entryNumber);
        je.reference = cheque;
        await je.save();
        jeUpdated++;
      }
    }

    // Now update General Ledger (if applicable)
    // GeneralLedger might not exist or might not have 'Excel Import', but we check just in case.
    if (GeneralLedger) {
      const glEntries = await GeneralLedger.find({ reference: /Excel Import/i });
      console.log(`Found ${glEntries.length} General Ledger entries with 'Excel Import' as reference.`);
      
      for (const gl of glEntries) {
        if (chequeMap.has(gl.entryNumber)) {
          const cheque = chequeMap.get(gl.entryNumber);
          gl.reference = cheque;
          await gl.save();
          glUpdated++;
        }
      }
    }

    console.log('--- Summary ---');
    console.log(`Journal Entries updated: ${jeUpdated}`);
    console.log(`General Ledger lines updated: ${glUpdated}`);
    console.log('Migration completed successfully.');

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

run();
