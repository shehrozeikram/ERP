require('dotenv').config();
const mongoose = require('mongoose');
const JournalEntry = require('./server/models/finance/JournalEntry');
const AccountsPayable = require('./server/models/finance/AccountsPayable');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const bill = await AccountsPayable.findOne({ billNumber: /OTH050493/i }).lean();
  console.log('Bill ID:', bill?._id);
  console.log('Bill Reference ID:', bill?.referenceId);
  console.log('Bill Reference Type:', bill?.referenceType);

  const jes = await JournalEntry.find({
    $or: [
      { referenceId: bill?._id },
      { referenceNumber: bill?.billNumber },
      { notes: /OTH050493/i },
      { description: /OTH050493/i },
      { referenceId: bill?.referenceId }
    ]
  }).lean();

  console.log('Linked JEs count:', jes.length);
  jes.forEach(j => {
    console.log(`JE: ${j.entryNumber}, Type: ${j.referenceType}, Status: ${j.status}, Company: ${j.companyId}, Amount: ${j.totalDebit}`);
  });

  process.exit(0);
})();
