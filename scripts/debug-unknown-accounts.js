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

  const unknownIds = [
    '6a1047d91b55c925be779579',
    '6a3294555f9277b5a63f660c',
    '69d34a1cb56623be69d26488',
    '6a362acd0f58038d9e0910bb',
    '69d34a1cb56623be69d26486',
    '69d34a1cb56623be69d26494',
    '69d34a1cb56623be69d26462',
    '69d34a1cb56623be69d2646c',
    '69d34a1cb56623be69d2645f',
    '69d34a1cb56623be69d2647f'
  ].map(id => new mongoose.Types.ObjectId(id));

  const accounts = await db.collection('accounts').find({ _id: { $in: unknownIds } }).toArray();
  console.log('=== Unknown Accounts details ===');
  accounts.forEach(a => {
    console.log(`ID: ${a._id} | AccNum: ${a.accountNumber} | Name: ${a.name} | Type: ${a.type} | Cat: ${a.category} | DetailType: ${a.detailType} | CompId: ${a.companyId}`);
  });

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
