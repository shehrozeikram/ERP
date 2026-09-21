#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  require('../models/finance/AccountsReceivable');
  const AR = mongoose.model('AccountsReceivable');

  const byStatus = await AR.aggregate([
    {
      $group: {
        _id: '$status',
        n: { $sum: 1 },
        invoiced: { $sum: { $ifNull: ['$totalAmount', 0] } },
        paid: { $sum: { $ifNull: ['$amountPaid', 0] } }
      }
    },
    { $sort: { n: -1 } }
  ]);

  const distinctCustomers = await AR.aggregate([
    {
      $group: {
        _id: {
          $cond: [
            { $ifNull: ['$customer.customerId', false] },
            { $toString: '$customer.customerId' },
            { $concat: ['name:', { $toLower: { $ifNull: ['$customer.name', ''] } }] }
          ]
        }
      }
    },
    { $count: 'n' }
  ]);

  console.log(JSON.stringify({ byStatus, distinctCustomers: distinctCustomers[0]?.n || 0 }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
