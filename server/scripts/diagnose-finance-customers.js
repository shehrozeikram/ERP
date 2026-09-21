#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  require('../models/sales/SalesCustomer');
  require('../models/finance/AccountsReceivable');
  const SalesCustomer = mongoose.model('SalesCustomer');
  const AR = mongoose.model('AccountsReceivable');

  const custCount = await SalesCustomer.countDocuments({});
  const arCount = await AR.countDocuments({});
  const withPaid = await AR.countDocuments({ amountPaid: { $gt: 0 } });
  const nullCompany = await AR.countDocuments({
    $or: [{ companyId: null }, { companyId: { $exists: false } }]
  });
  const withCompany = await AR.countDocuments({ companyId: { $ne: null } });
  const sampleAr = await AR.find({})
    .select('invoiceNumber totalAmount amountPaid paidAmount customer companyId')
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  const customers = await SalesCustomer.find({}).select('_id name').lean();
  const custIds = customers.map((c) => c._id);
  const linked = await AR.countDocuments({ 'customer.customerId': { $in: custIds } });
  const noCustId = await AR.countDocuments({
    $or: [{ 'customer.customerId': null }, { 'customer.customerId': { $exists: false } }]
  });

  // Name-match potential
  const names = customers.map((c) => c.name).filter(Boolean);
  const byName = names.length
    ? await AR.countDocuments({ 'customer.name': { $in: names } })
    : 0;

  // Company breakdown
  const byCompany = await AR.aggregate([
    { $group: { _id: '$companyId', n: { $sum: 1 }, paid: { $sum: { $ifNull: ['$amountPaid', 0] } }, invoiced: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
    { $sort: { n: -1 } },
    { $limit: 10 }
  ]);

  console.log(JSON.stringify({
    db: mongoose.connection.name,
    custCount,
    arCount,
    withPaid,
    nullCompany,
    withCompany,
    linkedToSalesCustomer: linked,
    arWithoutCustomerId: noCustId,
    arMatchingCustomerName: byName,
    byCompany,
    sampleAr,
    sampleCustomers: customers.slice(0, 5)
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
