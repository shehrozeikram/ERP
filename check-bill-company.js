require('dotenv').config();
const mongoose = require('mongoose');
const PlacementCompany = require('./server/models/hr/Company');
const AccountsPayable = require('./server/models/finance/AccountsPayable');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const bill = await AccountsPayable.findOne({ billNumber: /OTH050493/i }).lean();
  console.log('bill.company (string):', bill.company);
  console.log('bill.companyId (ObjectId):', bill.companyId);
  const comp = await PlacementCompany.findById(bill.companyId).lean();
  console.log('PlacementCompany found by bill.companyId:', comp?.name);
  process.exit(0);
})();
