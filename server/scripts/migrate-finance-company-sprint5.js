#!/usr/bin/env node
/**
 * Sprint 5 migration: backfill companyId on deferred entries, recurring journals,
 * fixed assets, and budgets → historical company (SARDAR GROUP OF COMPANIES).
 *
 * Usage:
 *   node server/scripts/migrate-finance-company-sprint5.js
 *   node server/scripts/migrate-finance-company-sprint5.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const DeferredEntry = require('../models/finance/DeferredEntry');
const RecurringJournal = require('../models/finance/RecurringJournal');
const FixedAsset = require('../models/finance/FixedAsset');
const Budget = require('../models/finance/Budget');
const Account = require('../models/finance/Account');
const { findHistoricalCompany } = require('../utils/financeCompanyContext');

const dryRun = process.argv.includes('--dry-run');

const missingCompanyFilter = {
  $or: [{ companyId: null }, { companyId: { $exists: false } }]
};

const companyFromAccount = async (accountId, historicalId) => {
  if (!accountId) return historicalId;
  const acct = await Account.findById(accountId).select('companyId').lean();
  return acct?.companyId || historicalId;
};

const backfillModel = async (Model, label, resolveCompany) => {
  const rows = await Model.find(missingCompanyFilter).lean();
  console.log(`${label} without companyId: ${rows.length}`);
  if (dryRun || !rows.length) return 0;

  let updated = 0;
  for (const row of rows) {
    const companyId = await resolveCompany(row);
    if (companyId) {
      await Model.updateOne({ _id: row._id }, { $set: { companyId } });
      updated += 1;
    }
  }
  console.log(`${label} updated:`, updated);
  return updated;
};

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));

  const historical = await findHistoricalCompany();
  if (!historical?._id) {
    throw new Error('Historical company (SARDAR GROUP OF COMPANIES) not found');
  }
  const historicalId = historical._id;

  await backfillModel(DeferredEntry, 'Deferred entries', async (row) =>
    companyFromAccount(row.deferredAccount, historicalId)
  );
  await backfillModel(RecurringJournal, 'Recurring journals', async (row) =>
    companyFromAccount(row.lines?.[0]?.account, historicalId)
  );
  await backfillModel(FixedAsset, 'Fixed assets', async (row) =>
    companyFromAccount(row.assetAccount, historicalId)
  );
  await backfillModel(Budget, 'Budgets', async (row) =>
    companyFromAccount(row.lines?.[0]?.account, historicalId)
  );

  console.log('Sprint 5 migration complete.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
