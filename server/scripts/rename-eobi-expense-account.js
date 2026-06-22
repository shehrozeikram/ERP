#!/usr/bin/env node
/**
 * Rename any existing Account documents where accountNumber is '5015' from
 * 'EOBI Employer Contribution Expense' to 'EOBI Expense'.
 *
 * Usage:
 *   node server/scripts/rename-eobi-expense-account.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const Account = require('../models/finance/Account');

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));

  console.log('Connected to database. Renaming account 5015...');

  const result = await Account.updateMany(
    { accountNumber: '5015' },
    {
      $set: {
        name: 'EOBI Expense',
        description: 'EOBI Expense'
      }
    }
  );

  console.log(`Successfully updated ${result.modifiedCount} account(s) in the database.`);

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
