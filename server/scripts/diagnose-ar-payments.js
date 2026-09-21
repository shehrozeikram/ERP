#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  require('../models/finance/AccountsReceivable');
  const AR = mongoose.model('AccountsReceivable');

  const withPaymentsArr = await AR.countDocuments({ 'payments.0': { $exists: true } });
  const paymentSum = await AR.aggregate([
    { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: null,
        n: { $sum: 1 },
        total: { $sum: { $ifNull: ['$payments.amount', 0] } }
      }
    }
  ]);
  const installmentPaid = await AR.aggregate([
    { $unwind: { path: '$installments', preserveNullAndEmptyArrays: false } },
    { $match: { 'installments.paidAmount': { $gt: 0 } } },
    {
      $group: {
        _id: null,
        n: { $sum: 1 },
        total: { $sum: '$installments.paidAmount' }
      }
    }
  ]);
  const topCustomers = await AR.aggregate([
    {
      $group: {
        _id: {
          id: '$customer.customerId',
          name: '$customer.name'
        },
        invoices: { $sum: 1 },
        invoiced: { $sum: { $ifNull: ['$totalAmount', 0] } },
        amountPaid: { $sum: { $ifNull: ['$amountPaid', 0] } },
        paymentsLen: { $sum: { $size: { $ifNull: ['$payments', []] } } }
      }
    },
    { $sort: { invoiced: -1 } },
    { $limit: 15 }
  ]);

  // Compare payment array sum vs amountPaid on a few invoices that have payments
  const samples = await AR.find({ 'payments.0': { $exists: true } })
    .select('invoiceNumber customer totalAmount amountPaid payments')
    .limit(5)
    .lean();
  const sampleMapped = samples.map((i) => ({
    invoiceNumber: i.invoiceNumber,
    customer: i.customer,
    totalAmount: i.totalAmount,
    amountPaid: i.amountPaid,
    paymentsSum: (i.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0),
    paymentsCount: (i.payments || []).length
  }));

  console.log(JSON.stringify({
    withPaymentsArr,
    paymentSum: paymentSum[0] || null,
    installmentPaid: installmentPaid[0] || null,
    topCustomers,
    sampleMapped
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
