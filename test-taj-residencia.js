require('dotenv').config();
const mongoose = require('mongoose');
const AccountsPayable = require('./server/models/finance/AccountsPayable');
const JournalEntry = require('./server/models/finance/JournalEntry');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const tajId = new mongoose.Types.ObjectId("6a34d5b68f72dc6ab5ef1dba");

  const bills = await AccountsPayable.find({ companyId: tajId, billNumber: /OTH050493/i }).lean();
  console.log('AP bills under Taj Residencia matching OTH050493:', bills.length);

  const vouchers = await JournalEntry.find({ companyId: tajId, reference: /OTH050493/i }).lean();
  console.log('Vouchers under Taj Residencia matching OTH050493:', vouchers.map(v => ({ entryNumber: v.entryNumber, referenceType: v.referenceType, status: v.status })));

  process.exit(0);
})();
