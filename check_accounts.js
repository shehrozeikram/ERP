const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const Account = require('./server/models/finance/Account');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sgc_erp').then(async () => {
  console.log('Connected to DB');
  const accounts = await Account.find({
    $or: [
      { accountNumber: '2001' },
      { _id: '6a3294555f9277b5a63f660c' }
    ]
  }).lean();
  console.log('Found Accounts:', accounts);
  process.exit(0);
}).catch(console.error);
