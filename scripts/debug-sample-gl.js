const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

const envPathServer = path.join(__dirname, '../server/.env');
const envPathRoot = path.join(__dirname, '../.env');
if (require('fs').existsSync(envPathServer)) {
  dotenv.config({ path: envPathServer });
} else {
  dotenv.config({ path: envPathRoot });
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://127.0.0.1:27017/sgc_erp';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const ciconCompany = await db.collection('companies').findOne({ name: /CICON/i });
  console.log('CICON Company ID:', ciconCompany._id);

  const sampleGl = await db.collection('generalledgers').findOne({ companyId: ciconCompany._id });
  console.log('Sample GL Account ID:', sampleGl ? sampleGl.account : null);

  const acc = await db.collection('accounts').findOne({ _id: sampleGl.account });
  console.log('Account for Sample GL:', acc);

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
