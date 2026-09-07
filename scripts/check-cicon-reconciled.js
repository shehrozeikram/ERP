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

  if (ciconCompany) {
    const glTotal = await db.collection('generalledgers').countDocuments({ companyId: ciconCompany._id });
    const glReconciled = await db.collection('generalledgers').countDocuments({
      companyId: ciconCompany._id,
      $or: [{ clearanceStatus: 'cleared' }, { isReconciled: true }]
    });
    console.log('CICON Total GL Entries:', glTotal);
    console.log('CICON Reconciled GL Entries:', glReconciled);

    const jeTotal = await db.collection('journalentries').countDocuments({ companyId: ciconCompany._id });
    const jeReconciled = await db.collection('journalentries').countDocuments({
      companyId: ciconCompany._id,
      $or: [{ clearanceStatus: 'cleared' }, { isReconciled: true }]
    });
    console.log('CICON Total Journal Entries:', jeTotal);
    console.log('CICON Reconciled Journal Entries:', jeReconciled);

    const sampleJe = await db.collection('journalentries').findOne({ companyId: ciconCompany._id });
    console.log('Sample JE:', sampleJe ? { id: sampleJe._id, entryNumber: sampleJe.entryNumber, clearanceStatus: sampleJe.clearanceStatus, isReconciled: sampleJe.isReconciled } : null);

    const sampleGl = await db.collection('generalledgers').findOne({ companyId: ciconCompany._id });
    console.log('Sample GL:', sampleGl ? { id: sampleGl._id, clearanceStatus: sampleGl.clearanceStatus, isReconciled: sampleGl.isReconciled } : null);
  }

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
