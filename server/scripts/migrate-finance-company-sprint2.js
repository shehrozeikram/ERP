#!/usr/bin/env node
/**
 * Sprint 2 migration: assign companyId to journals, GL, fiscal periods.
 *
 * Usage:
 *   node server/scripts/migrate-finance-company-sprint2.js
 *   node server/scripts/migrate-finance-company-sprint2.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const FiscalPeriod = require('../models/finance/FiscalPeriod');
const { findHistoricalCompany } = require('../utils/financeCompanyContext');

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));

  const historical = await findHistoricalCompany();
  if (!historical) {
    throw new Error('Historical company SARDAR GROUP OF COMPANIES not found');
  }

  const companyId = historical._id;
  console.log(`Assigning unscoped finance records to: ${historical.name} (${companyId})`);

  const [jeCount, glCount, fpCount] = await Promise.all([
    JournalEntry.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }),
    GeneralLedger.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }),
    FiscalPeriod.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] })
  ]);

  console.log('Unassigned journal entries:', jeCount);
  console.log('Unassigned GL rows:', glCount);
  console.log('Unassigned fiscal periods:', fpCount);

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  const jeResult = await JournalEntry.updateMany(
    { $or: [{ companyId: null }, { companyId: { $exists: false } }] },
    { $set: { companyId } }
  );
  console.log('Journal entries updated:', jeResult.modifiedCount ?? jeResult.nModified);

  const glFromJe = await GeneralLedger.find({
    $or: [{ companyId: null }, { companyId: { $exists: false } }]
  }).select('_id journalEntry').lean();

  const jeIds = [...new Set(glFromJe.map((r) => r.journalEntry).filter(Boolean))];
  const jeRows = await JournalEntry.find({ _id: { $in: jeIds } }).select('_id companyId').lean();
  const jeCompanyMap = new Map(jeRows.map((j) => [String(j._id), j.companyId]));

  if (glFromJe.length) {
    const bulkOps = glFromJe.map((row) => ({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { companyId: jeCompanyMap.get(String(row.journalEntry)) || companyId } }
      }
    }));
    const bulkResult = await GeneralLedger.bulkWrite(bulkOps);
    console.log('General ledger rows updated:', bulkResult.modifiedCount ?? bulkResult.nModified);
  } else {
    console.log('General ledger rows updated: 0');
  }

  const fpResult = await FiscalPeriod.updateMany(
    { $or: [{ companyId: null }, { companyId: { $exists: false } }] },
    { $set: { companyId } }
  );
  console.log('Fiscal periods updated:', fpResult.modifiedCount ?? fpResult.nModified);

  try {
    await FiscalPeriod.syncIndexes();
    console.log('Fiscal period indexes synced.');
  } catch (err) {
    console.warn('Fiscal period index sync warning:', err.message);
  }

  console.log('Sprint 2 migration complete.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
