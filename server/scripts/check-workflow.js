const mongoose = require('mongoose');
require('dotenv').config();
const AccountsPayable = require('../models/finance/AccountsPayable');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const bills = await AccountsPayable.find({ workflowHistory: { $exists: true, $not: { $size: 0 } } }).sort({ _id: -1 }).limit(5).lean();
  if (bills.length > 0) {
    for (const bill of bills) {
      console.log(`--- Bill ${bill.billNumber} ---`);
      console.log(JSON.stringify(bill.workflowHistory, null, 2));
    }
  } else {
    console.log("No bill with workflow history found");
  }
  process.exit(0);
}
check().catch(console.error);
