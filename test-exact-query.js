require('dotenv').config();
const mongoose = require('mongoose');
const AccountsPayable = require('./server/models/finance/AccountsPayable');
const { companyQuery } = require('./server/utils/financePosting');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Construct filters identically to the route
  const baseFilters = {};
  baseFilters.status = { $nin: ['Pending Audit', 'Forwarded to Audit Director', 'Returned from Audit'] };
  
  const start = new Date('2026-07-01');
  start.setHours(0, 0, 0, 0);
  const end = new Date('2026-09-01');
  end.setHours(23, 59, 59, 999);
  
  baseFilters.billDate = { $gte: start, $lte: end };
  
  // We assume the user has the correct company selected
  baseFilters.companyId = new mongoose.Types.ObjectId("6a34d5b68f72dc6ab5ef1dba"); 
  
  const totalBills = await AccountsPayable.countDocuments(baseFilters);
  const bills = await AccountsPayable.find(baseFilters).sort({ billDate: -1 }).limit(100).lean();
  
  console.log('Total bills matching default filters:', totalBills);
  console.log('Are there bills?');
  bills.forEach(b => {
    if (b.billNumber === 'OTH050493') {
      console.log('FOUND OTH050493! Date:', b.billDate, 'Status:', b.status);
    }
  });
  
  process.exit(0);
})();
