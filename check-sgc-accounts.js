require('dotenv').config();
const mongoose = require('mongoose');
const Account = require('./server/models/finance/Account');
const GeneralLedger = require('./server/models/finance/GeneralLedger');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const sgcCompanyId = new mongoose.Types.ObjectId("6a34d5818f72dc6ab5ef14fc");
  
  const accounts = await Account.find({ companyId: sgcCompanyId }).select('_id name accountNumber type').lean();
  console.log(`Found ${accounts.length} accounts under SARDAR GROUP OF COMPANIES`);
  accounts.forEach(a => {
    if (['2001', '5001', '6200'].includes(a.accountNumber) || /payable|expense/i.test(a.name)) {
      console.log(`- ${a.accountNumber}: ${a.name} (${a._id})`);
    }
  });

  const glCount = await GeneralLedger.countDocuments({
    $or: [{ voucherNumber: 'BILL-000110' }, { reference: 'OTH050493' }, { journalEntry: new mongoose.Types.ObjectId("6a9564fa8299f712d62ad779") }]
  });
  console.log('GL entries for BILL-000110:', glCount);

  process.exit(0);
})();
