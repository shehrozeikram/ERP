require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const utilBill = await db.collection('utilitybills').findOne({ _id: new mongoose.Types.ObjectId("6a9562ca8299f712d629426e") });
  console.log('Utility bill:', utilBill ? {
    _id: utilBill._id,
    billNumber: utilBill.billNumber,
    company: utilBill.company,
    companyId: utilBill.companyId,
    location: utilBill.location,
    department: utilBill.department
  } : 'NOT FOUND');
  process.exit(0);
})();
