#!/usr/bin/env node
/**
 * Link the Waqas AR invoice to the Finance SalesCustomer so View finance shows it.
 * Dry-run by default; pass --apply to write.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');

(async () => {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  require('../models/sales/SalesCustomer');
  require('../models/finance/AccountsReceivable');
  const SalesCustomer = mongoose.model('SalesCustomer');
  const AR = mongoose.model('AccountsReceivable');

  const sales = await SalesCustomer.findOne({
    name: /Waqas Satellite Town/i
  }).lean();
  if (!sales) {
    console.log(JSON.stringify({ error: 'SalesCustomer not found' }));
    process.exit(1);
  }

  const invoice = await AR.findOne({
    $or: [
      { invoiceNumber: 'INV-202609-9629' },
      { 'customer.name': /Waqas/i, companyId: { $ne: null } }
    ]
  }).lean();

  console.log(JSON.stringify({
    apply,
    sales: { _id: sales._id, name: sales.name },
    invoice: invoice
      ? {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customer,
        totalAmount: invoice.totalAmount
      }
      : null
  }, null, 2));

  if (apply && invoice) {
    await AR.updateOne(
      { _id: invoice._id },
      {
        $set: {
          'customer.customerId': sales._id,
          'customer.name': sales.name
        }
      }
    );
    console.log('LINKED_OK');
  } else if (!apply) {
    console.log('Dry-run only. Re-run with --apply to link.');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
