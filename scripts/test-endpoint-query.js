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

  const ciconAccounts = await db.collection('accounts').find({
    companyId: ciconCompany._id
  }).toArray();

  console.log('CICON Accounts count:', ciconAccounts.length);

  const bankAccounts = ciconAccounts.filter(a => {
    const isAsset = a.type === 'Asset';
    const matchesCat = a.category && (a.category.match(/cash|bank|current/i) || a.detailType?.match(/cash|bank/i) || a.accountCode === 'BANK' || a.accountCode === 'CASH');
    return isAsset || matchesCat;
  });

  console.log('CICON Bank/Asset Accounts matched by endpoint step 1 query:');
  bankAccounts.forEach(a => console.log(`Account [${a.accountNumber}] ${a.name} | Type: ${a.type} | Cat: ${a.category}`));

  const targetIds = bankAccounts.map(a => a._id);

  const glMatches = await db.collection('generalledgers').countDocuments({
    account: { $in: targetIds },
    $or: [{ clearanceStatus: 'cleared' }, { isReconciled: true }]
  });

  console.log('\nGL Entries matching target Bank/Asset account IDs:', glMatches);

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
