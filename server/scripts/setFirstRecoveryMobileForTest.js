/**
 * One-time: set the first recovery assignment's mobileNumber to 16315551181
 * so the test webhook message (from 16315551181) shows in My Tasks / Recovery Assignments.
 * Run: node server/scripts/setFirstRecoveryMobileForTest.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');

const TEST_MOBILE = '16315551181';

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('❌ No MongoDB URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const first = await RecoveryAssignment.findOne().sort({ sortOrder: 1, orderCode: 1 });
  if (!first) {
    console.log('No recovery assignment found.');
    await mongoose.disconnect();
    process.exit(0);
  }
  first.mobileNumber = TEST_MOBILE;
  await first.save();
  console.log('✅ Updated first assignment mobileNumber to', TEST_MOBILE, '(orderCode:', first.orderCode + ')');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
