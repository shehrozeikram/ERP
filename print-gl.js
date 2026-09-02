require('dotenv').config();
const mongoose = require('mongoose');
const GeneralLedger = require('./server/models/finance/GeneralLedger');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const gl = await GeneralLedger.find({ voucherNumber: 'BILL-000110' }).lean();
  console.log(JSON.stringify(gl, null, 2));
  process.exit(0);
})();
