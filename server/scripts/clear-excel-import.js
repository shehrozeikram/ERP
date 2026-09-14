const mongoose = require('mongoose');
require('dotenv').config();

const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');

async function run() {
  try {
    let uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
    if (uri && uri.includes('127.0.0.1') && uri.endsWith('sgc_erp')) {
      uri = uri.replace('sgc_erp', 'sgc_erp_local');
    }
    await mongoose.connect(uri);
    
    // Update all remaining JEs
    const jeRes = await JournalEntry.updateMany(
      { reference: /Excel Import/i },
      { $set: { reference: '' } }
    );
    console.log(`Cleared 'Excel Import' from ${jeRes.modifiedCount} Journal Entries.`);

    // Update all remaining GLs
    if (GeneralLedger) {
      const glRes = await GeneralLedger.updateMany(
        { reference: /Excel Import/i },
        { $set: { reference: '' } }
      );
      console.log(`Cleared 'Excel Import' from ${glRes.modifiedCount} General Ledger lines.`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}
run();
