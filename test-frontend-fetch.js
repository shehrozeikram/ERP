require('dotenv').config();
const mongoose = require('mongoose');
const { companyQuery } = require('./server/utils/financePosting');
const AccountsPayable = require('./server/models/finance/AccountsPayable');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const companyId = "6a34d5b68f72dc6ab5ef1dba";
  
  // This is what loadOutstandingByEmployee uses
  const employeeName = "Mohammad Ali";
  const limit = 500;
  
  const baseFilters = {};
  baseFilters.status = { $nin: ['Pending Audit', 'Forwarded to Audit Director', 'Returned from Audit'] };
  baseFilters.$or = [
        { billNumber: { $regex: employeeName, $options: 'i' } },
        { vendorInvoiceNumber: { $regex: employeeName, $options: 'i' } },
        { 'vendor.name': { $regex: employeeName, $options: 'i' } },
        { notes: { $regex: employeeName, $options: 'i' } },
        { 'lineItems.description': { $regex: employeeName, $options: 'i' } }
  ];
  
  const filters = companyQuery(baseFilters, { _id: companyId });
  const bills = await AccountsPayable.find(filters).lean();
  
  console.log("Bills found by search:", bills.map(b => b.billNumber));
  
  process.exit(0);
})();
