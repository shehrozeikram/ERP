require('dotenv').config();
const mongoose = require('mongoose');
const AccountsPayable = require('./server/models/finance/AccountsPayable');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const bill = await AccountsPayable.findOne({ billNumber: /OTH050493/i }).lean();
  console.log('Company:', bill.companyId);
  const filters = { 
    companyId: bill.companyId, 
    status: { $nin: ['Pending Audit', 'Forwarded to Audit Director', 'Returned from Audit'] },
    'vendor.name': { $regex: 'Mohammad Ali', $options: 'i' }
  };
  const matches = await AccountsPayable.find(filters).lean();
  console.log('Matches with vendor name:', matches.length);
  process.exit(0);
})();
