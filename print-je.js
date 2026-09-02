require('dotenv').config();
const mongoose = require('mongoose');
const JournalEntry = require('./server/models/finance/JournalEntry');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const je = await JournalEntry.findOne({ entryNumber: 'BILL-000110' }).lean();
  console.log(JSON.stringify(je, null, 2));
  process.exit(0);
})();
