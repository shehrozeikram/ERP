#!/usr/bin/env node
/**
 * Create EOBI Payable sub-accounts (2211-01 employee, 2211-02 employer) for all finance companies.
 *
 * Usage:
 *   node server/scripts/migrate-eobi-payable-subaccounts.js
 *   node server/scripts/migrate-eobi-payable-subaccounts.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const PlacementCompany = require('../models/hr/Company');
const Account = require('../models/finance/Account');
const { ensureEobiPayableAccounts } = require('../utils/eobiPayableAccount');

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));

  const companies = await PlacementCompany.find({ isActive: { $ne: false } })
    .select('_id name')
    .lean();

  console.log(`Companies: ${companies.length}${dryRun ? ' (dry run)' : ''}`);

  for (const company of companies) {
    const parentBefore = await Account.findOne({
      companyId: company._id,
      accountNumber: '2211'
    }).select('accountNumber balance allowTransactions').lean();

    if (dryRun) {
      const empExists = await Account.exists({
        companyId: company._id,
        accountNumber: '2211-01'
      });
      const erExists = await Account.exists({
        companyId: company._id,
        accountNumber: '2211-02'
      });
      console.log(
        `[dry-run] ${company.name}: parent=${parentBefore ? 'yes' : 'no'}, emp=${empExists ? 'yes' : 'create'}, er=${erExists ? 'yes' : 'create'}`
      );
      continue;
    }

    const { parent, employee, employer } = await ensureEobiPayableAccounts(company._id);
    console.log(
      `${company.name}: parent ${parent.accountNumber}, emp ${employee.accountNumber}, er ${employer.accountNumber}`
    );

    if (parentBefore && Math.abs(Number(parentBefore.balance) || 0) > 0.009) {
      console.warn(
        `  ⚠ Parent 2211 has balance ${parentBefore.balance} — review and reclassify to sub-accounts manually if needed.`
      );
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
