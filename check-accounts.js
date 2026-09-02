require('dotenv').config();
const mongoose = require('mongoose');
const Account = require('./server/models/finance/Account');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const acc1 = await Account.findById('6a42287745d4dd46f723e9e5').lean();
  const acc2 = await Account.findById('6a42287645d4dd46f723e9b8').lean();
  console.log('Account 1:', acc1 ? { name: acc1.name, number: acc1.accountNumber, companyId: acc1.companyId } : 'none');
  console.log('Account 2:', acc2 ? { name: acc2.name, number: acc2.accountNumber, companyId: acc2.companyId } : 'none');
  process.exit(0);
})();
