#!/usr/bin/env node
/**
 * Sprint 6 migration: backfill companyId on Banking and VendorAdvance.
 *
 * Usage:
 *   node server/scripts/migrate-finance-company-sprint6.js
 *   node server/scripts/migrate-finance-company-sprint6.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const Banking = require('../models/finance/Banking');
const VendorAdvance = require('../models/finance/VendorAdvance');
const JournalEntry = require('../models/finance/JournalEntry');
const { findHistoricalCompany } = require('../utils/financeCompanyContext');

const dryRun = process.argv.includes('--dry-run');
const missingCompanyFilter = {
  $or: [{ companyId: null }, { companyId: { $exists: false } }]
};

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));

  const historical = await findHistoricalCompany();
  if (!historical?._id) throw new Error('Historical company not found');
  const historicalId = historical._id;

  const bankingCount = await Banking.countDocuments(missingCompanyFilter);
  const vaCount = await VendorAdvance.countDocuments(missingCompanyFilter);
  console.log(`Banking without companyId: ${bankingCount}`);
  console.log(`VendorAdvance without companyId: ${vaCount}`);

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  if (bankingCount) {
    await Banking.updateMany(missingCompanyFilter, { $set: { companyId: historicalId } });
    console.log('Banking updated:', bankingCount);
  }

  const advances = await VendorAdvance.find(missingCompanyFilter).select('journalEntryId').lean();
  let vaUpdated = 0;
  for (const row of advances) {
    let companyId = historicalId;
    if (row.journalEntryId) {
      const je = await JournalEntry.findById(row.journalEntryId).select('companyId').lean();
      if (je?.companyId) companyId = je.companyId;
    }
    await VendorAdvance.updateOne({ _id: row._id }, { $set: { companyId } });
    vaUpdated += 1;
  }
  console.log('VendorAdvance updated:', vaUpdated);
  console.log('Sprint 6 migration complete.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
