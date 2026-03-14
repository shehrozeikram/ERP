#!/usr/bin/env node
/**
 * Update recovery assignments with mobile 16315551181 to 923214554035
 * Run: node scripts/update-recovery-mobile-to-923214554035.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env.production') });
}

const mongoose = require('mongoose');
const RecoveryAssignment = require('../server/models/finance/RecoveryAssignment');

const NEW_NUMBER = '923214554035';

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('❌ No MongoDB URI');
    process.exit(1);
  }

  await mongoose.connect(uri);

  // Match records with 16315551181 (wrong number) - update to 923214554035
  const res = await RecoveryAssignment.updateMany(
    { mobileNumber: { $regex: /16315551181|6315551181/ } },
    { $set: { mobileNumber: NEW_NUMBER } }
  );

  console.log('✅ Updated', res.modifiedCount, 'recovery assignment(s) from 16315551181 to', NEW_NUMBER);

  if (res.modifiedCount === 0) {
    const count = await RecoveryAssignment.countDocuments({});
    const sample = await RecoveryAssignment.findOne().select('orderCode customerName mobileNumber').lean();
    console.log('   Total assignments:', count);
    if (sample) console.log('   Sample:', sample.orderCode, sample.customerName, sample.mobileNumber);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
