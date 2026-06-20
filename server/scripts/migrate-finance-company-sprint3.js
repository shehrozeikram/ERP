#!/usr/bin/env node
/**
 * Sprint 3 migration: assign companyId to AP/AR and fiscal periods.
 *
 * Usage:
 *   node server/scripts/migrate-finance-company-sprint3.js
 *   node server/scripts/migrate-finance-company-sprint3.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const AccountsPayable = require('../models/finance/AccountsPayable');
const AccountsReceivable = require('../models/finance/AccountsReceivable');
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
  console.log(`Assigning unscoped AP/AR/fiscal periods to: ${historical.name} (${companyId})`);

  const [apCount, arCount, fpCount] = await Promise.all([
    AccountsPayable.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }),
    AccountsReceivable.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] }),
    FiscalPeriod.countDocuments({ $or: [{ companyId: null }, { companyId: { $exists: false } }] })
  ]);

  console.log('Unassigned AP bills:', apCount);
  console.log('Unassigned AR invoices:', arCount);
  console.log('Unassigned fiscal periods:', fpCount);

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  const [apResult, arResult, fpResult] = await Promise.all([
    AccountsPayable.updateMany(
      { $or: [{ companyId: null }, { companyId: { $exists: false } }] },
      { $set: { companyId } }
    ),
    AccountsReceivable.updateMany(
      { $or: [{ companyId: null }, { companyId: { $exists: false } }] },
      { $set: { companyId } }
    ),
    FiscalPeriod.updateMany(
      { $or: [{ companyId: null }, { companyId: { $exists: false } }] },
      { $set: { companyId } }
    )
  ]);

  console.log('AP updated:', apResult.modifiedCount ?? apResult.nModified);
  console.log('AR updated:', arResult.modifiedCount ?? arResult.nModified);
  console.log('Fiscal periods updated:', fpResult.modifiedCount ?? fpResult.nModified);
  console.log('Sprint 3 migration complete.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
