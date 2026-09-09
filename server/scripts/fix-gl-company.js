require('dotenv').config({ path: '.env.production' });
const mongoose = require('mongoose');
const GeneralLedger = require('../models/finance/GeneralLedger');
const Account = require('../models/finance/Account');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/sgc_erp_v2');
  console.log('Connected to MongoDB.');

  const gls = await GeneralLedger.find({ status: 'posted' }).lean();
  console.log(`Checking ${gls.length} GL entries...`);

  let count = 0;
  for (const gl of gls) {
    if (!gl.account) continue;
    const acct = await Account.findById(gl.account).select('companyId').lean();
    if (acct && acct.companyId && String(acct.companyId) !== String(gl.companyId)) {
      console.log(`GL ${gl._id} has wrong companyId. Expected: ${acct.companyId}, Found: ${gl.companyId}`);
      await GeneralLedger.updateOne({ _id: gl._id }, { $set: { companyId: acct.companyId } });
      count++;
    }
  }

  console.log(`Fixed ${count} GL entries.`);
  process.exit(0);
}

run();
