#!/usr/bin/env node
/**
 * Sprint 1 migration: company-wise Chart of Accounts foundation.
 *
 * 1) Assign companyCode to all active legal companies
 * 2) Assign all existing accounts without companyId → SARDAR GROUP OF COMPANIES
 * 3) Seed standard COA for other active companies (empty balances)
 *
 * Usage:
 *   node server/scripts/migrate-finance-company-sprint1.js
 *   node server/scripts/migrate-finance-company-sprint1.js --dry-run
 *   node server/scripts/migrate-finance-company-sprint1.js --skip-seed
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const PlacementCompany = require('../models/hr/Company');
const Account = require('../models/finance/Account');
const {
  findHistoricalCompany,
  ensureCompanyCodes,
  HISTORICAL_COMPANY_NAME
} = require('../utils/financeCompanyContext');
const {
  assignHistoricalAccountsToCompany,
  seedChartOfAccountsForCompany
} = require('../utils/companyChartOfAccounts');

const dryRun = process.argv.includes('--dry-run');
const skipSeed = process.argv.includes('--skip-seed');

const fixAccountIndexes = async () => {
  const indexes = await Account.collection.indexes();
  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    if (
      index.unique
      && keys.length === 1
      && keys[0] === 'accountNumber'
    ) {
      try {
        await Account.collection.dropIndex(index.name);
        console.log(`Dropped legacy global index: ${index.name}`);
      } catch (err) {
        console.warn(`Could not drop index ${index.name}:`, err.message);
      }
    }
  }
  await Account.syncIndexes();
  console.log('Account indexes synced (companyId + accountNumber unique).');
};

const run = async () => {
  const { uri, isLocal } = getMongoUri();
  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  console.log(`Finance company migration${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`Historical entity target: ${HISTORICAL_COMPANY_NAME}`);

  const historical = await findHistoricalCompany();
  if (!historical) {
    throw new Error(`Historical company not found: ${HISTORICAL_COMPANY_NAME}`);
  }
  console.log(`Found historical company: ${historical.name} (${historical._id})`);

  if (dryRun) {
    const unassigned = await Account.countDocuments({
      $or: [{ companyId: null }, { companyId: { $exists: false } }]
    });
    const companies = await PlacementCompany.find({ isActive: { $ne: false } }).select('name companyCode').lean();
    console.log('Unassigned accounts:', unassigned);
    console.log('Active companies:', companies.length);
    companies.forEach((c) => console.log(` - ${c.name} | code: ${c.companyCode || '(none)'}`));
    await mongoose.disconnect();
    return;
  }

  await fixAccountIndexes();

  const codesUpdated = await ensureCompanyCodes();
  console.log(`Company codes assigned/verified: ${codesUpdated}`);

  const assignResult = await assignHistoricalAccountsToCompany(historical._id);
  console.log(`Historical accounts assigned to ${historical.name}: ${assignResult.modified}`);

  if (!skipSeed) {
    const activeCompanies = await PlacementCompany.find({ isActive: { $ne: false } })
      .select('_id name companyCode')
      .sort({ name: 1 })
      .lean();

    for (const company of activeCompanies) {
      if (String(company._id) === String(historical._id)) {
        console.log(`Skip seed for historical company: ${company.name}`);
        continue;
      }
      const existingCount = await Account.countDocuments({ companyId: company._id, isActive: true });
      if (existingCount > 0) {
        console.log(`Skip seed for ${company.name} — already has ${existingCount} account(s)`);
        continue;
      }
      const seeded = await seedChartOfAccountsForCompany(company._id, { skipExisting: true });
      console.log(`Seeded ${company.name}: ${seeded.created} created, ${seeded.existing} existing`);
    }
  }

  const summary = await Account.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$companyId', count: { $sum: 1 } } }
  ]);
  console.log('\nAccount counts by company:');
  for (const row of summary) {
    const company = row._id
      ? await PlacementCompany.findById(row._id).select('name companyCode').lean()
      : null;
    console.log(` - ${company?.name || 'UNASSIGNED'}: ${row.count}`);
  }

  console.log('\nMigration complete.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
