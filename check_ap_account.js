const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });
const Account = require('./server/models/finance/Account');

mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI).then(async () => {
  console.log('Connected to DB');
  const accounts2001 = await Account.find({ accountNumber: '2001' }).lean();
  console.log('Accounts with 2001:', accounts2001);
  
  const apAccounts = await Account.find({ 
    $or: [
      { name: /payable/i },
      { name: /ap/i },
      { accountCode: 'PAYABLE' }
    ] 
  }).lean();
  console.log('Other AP accounts:', apAccounts);
  process.exit(0);
}).catch(console.error);
