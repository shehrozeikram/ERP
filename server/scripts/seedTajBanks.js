/**
 * Migration: Seed TajBank collection from existing deposit records.
 *
 * This extracts every unique bank name stored in TajTransaction deposit
 * records (paymentMethod: Bank Transfer | Cheque | Online) and inserts
 * them into the TajBank collection so they appear in the Banks page and
 * all deposit form dropdowns immediately after the upgrade.
 *
 * Safe to run multiple times — duplicates are skipped.
 *
 * Run once:
 *   node server/scripts/seedTajBanks.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const TajTransaction = require('../models/tajResidencia/TajTransaction');
const TajBank = require('../models/tajResidencia/TajBank');

const BANK_REQUIRED_METHODS = new Set(['Bank Transfer', 'Cheque', 'Online']);

async function run() {
  const isProduction = process.env.NODE_ENV === 'production';
  const uri = isProduction
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('ERROR: No MongoDB URI found. Set MONGODB_URI_LOCAL for local dev or MONGODB_URI for production.');
    process.exit(1);
  }

  console.log(`Environment: ${isProduction ? 'production' : 'local'}`);
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Pull unique bank names from all deposit transactions
  const deposits = await TajTransaction.find({
    transactionType: 'deposit',
    bank: { $exists: true, $ne: '' }
  })
    .select('bank paymentMethod')
    .lean();

  const names = new Set();
  deposits.forEach((d) => {
    const method = String(d.paymentMethod || '').trim();
    const bank = String(d.bank || '').trim();
    if (bank && BANK_REQUIRED_METHODS.has(method)) {
      names.add(bank);
    }
  });

  console.log(`Found ${names.size} unique bank name(s) from deposits:`);
  for (const name of [...names].sort()) {
    console.log(`  • ${name}`);
  }

  if (names.size === 0) {
    console.log('Nothing to seed.');
    await mongoose.disconnect();
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const name of names) {
    try {
      await TajBank.create({ name });
      console.log(`  ✓ Inserted: ${name}`);
      inserted++;
    } catch (err) {
      if (err.code === 11000) {
        console.log(`  – Skipped (already exists): ${name}`);
        skipped++;
      } else {
        console.error(`  ✗ Error inserting "${name}":`, err.message);
      }
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
