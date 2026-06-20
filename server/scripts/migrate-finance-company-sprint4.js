#!/usr/bin/env node
/**
 * Sprint 4 migration: backfill companyId on cash approvals.
 *
 * Usage:
 *   node server/scripts/migrate-finance-company-sprint4.js
 *   node server/scripts/migrate-finance-company-sprint4.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const CashApproval = require('../models/procurement/CashApproval');
const { resolveDocumentCompanyId, findHistoricalCompany } = require('../utils/financeCompanyContext');

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  const { uri: mongoUri, isLocal } = getMongoUri();
  await mongoose.connect(mongoUri, getMongooseClientOptions(mongoUri, isLocal));

  const historical = await findHistoricalCompany();
  const unassigned = await CashApproval.find({
    $or: [{ companyId: null }, { companyId: { $exists: false } }]
  }).select('advanceToEmployee indent').lean();

  console.log(`Cash approvals without companyId: ${unassigned.length}`);

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const ca of unassigned) {
    const companyId = await resolveDocumentCompanyId({
      employeeId: ca.advanceToEmployee,
      indentId: ca.indent
    }) || historical?._id;
    if (companyId) {
      await CashApproval.updateOne({ _id: ca._id }, { $set: { companyId } });
      updated += 1;
    }
  }

  console.log('Cash approvals updated:', updated);
  console.log('Sprint 4 migration complete.');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
