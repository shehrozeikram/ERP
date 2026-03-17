/**
 * One-time fix: update RecoveryAssignment for orderCode 104981
 * Change mobileNumber from old value to new value 923441518890.
 * Run: node server/scripts/updateRecoveryMobile_104981.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');

const TARGET_ORDER_CODE = '104981';
const NEW_MOBILE = '923441518890';

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('❌ No MongoDB URI');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const doc = await RecoveryAssignment.findOne({ orderCode: TARGET_ORDER_CODE });
  if (!doc) {
    console.log('No recovery assignment found for orderCode', TARGET_ORDER_CODE);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('Current mobileNumber:', doc.mobileNumber, 'for orderCode:', doc.orderCode);
  doc.mobileNumber = NEW_MOBILE;
  await doc.save();
  console.log('✅ Updated mobileNumber to', NEW_MOBILE, 'for orderCode:', doc.orderCode);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

