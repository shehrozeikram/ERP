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
  console.log('CICON Company ID:', ciconCompany ? ciconCompany._id : null);

  // Check accounts under CICON
  const ciconAccounts = await db.collection('accounts').find({ companyId: ciconCompany._id }).toArray();
  console.log('Total CICON Accounts:', ciconAccounts.length);
  ciconAccounts.forEach(a => console.log(`Account [${a.accountNumber}] ${a.name} | Type: ${a.type} | Category: ${a.category} | DetailType: ${a.detailType}`));

  // Check GL entries by account
  const glEntries = await db.collection('generalledgers').find({ companyId: ciconCompany._id }).toArray();
  console.log('\nTotal CICON GL Entries in DB:', glEntries.length);

  const glAccountIds = new Set(glEntries.map(g => String(g.account)));
  console.log('Unique GL Account IDs count:', glAccountIds.size);

  for (const accIdStr of glAccountIds) {
    const accDoc = ciconAccounts.find(a => String(a._id) === accIdStr);
    const count = glEntries.filter(g => String(g.account) === accIdStr).length;
    console.log(`GL Account [${accDoc ? accDoc.accountNumber : 'UNKNOWN'}] ${accDoc ? accDoc.name : accIdStr}: ${count} GL entries`);
  }

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
