require('dotenv').config();
const mongoose = require('mongoose');
const GeneralLedger = require('./server/models/finance/GeneralLedger');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const gl = await GeneralLedger.find({
    $or: [
      { voucherNumber: 'BILL-000110' },
      { reference: 'OTH050493' },
      { journalEntry: new mongoose.Types.ObjectId("6a9564fa8299f712d62ad779") }
    ]
  }).lean();
  console.log(JSON.stringify(gl, null, 2));
  process.exit(0);
})();
