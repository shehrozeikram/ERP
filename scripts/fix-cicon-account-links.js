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

  const ciconAccounts = await db.collection('accounts').find({ companyId: ciconCompany._id }).toArray();
  const ciconAccMap = new Map();
  ciconAccounts.forEach(a => ciconAccMap.set(String(a.accountNumber).trim(), a));

  const allAccounts = await db.collection('accounts').find({}).toArray();
  const allAccById = new Map();
  allAccounts.forEach(a => allAccById.set(String(a._id), a));

  const ciconGLs = await db.collection('generalledgers').find({ companyId: ciconCompany._id }).toArray();
  console.log(`Processing ${ciconGLs.length} CICON GL entries...`);

  let relinkedGL = 0;
  for (const gle of ciconGLs) {
    const accDoc = allAccById.get(String(gle.account));
    if (accDoc) {
      const code = String(accDoc.accountNumber || '').trim();
      const targetCiconAcc = ciconAccMap.get(code);
      if (targetCiconAcc && String(targetCiconAcc._id) !== String(gle.account)) {
        await db.collection('generalledgers').updateOne(
          { _id: gle._id },
          { $set: { account: targetCiconAcc._id } }
        );
        relinkedGL++;
      }
    }
  }
  console.log(`✅ Relinked ${relinkedGL} GL entries to CICON company-specific accounts.`);

  const ciconJEs = await db.collection('journalentries').find({ companyId: ciconCompany._id }).toArray();
  let relinkedJE = 0;

  for (const je of ciconJEs) {
    let updated = false;
    const newLines = (je.lines || []).map(line => {
      const accDoc = allAccById.get(String(line.account));
      if (accDoc) {
        const code = String(accDoc.accountNumber || '').trim();
        const targetCiconAcc = ciconAccMap.get(code);
        if (targetCiconAcc && String(targetCiconAcc._id) !== String(line.account)) {
          updated = true;
          return { ...line, account: targetCiconAcc._id };
        }
      }
      return line;
    });

    if (updated) {
      await db.collection('journalentries').updateOne(
        { _id: je._id },
        { $set: { lines: newLines } }
      );
      relinkedJE++;
    }
  }
  console.log(`✅ Relinked ${relinkedJE} JournalEntries to CICON company-specific accounts.`);

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
