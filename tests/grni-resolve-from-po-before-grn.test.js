/**
 * Verifies AP bill GRNI clearing uses the same GRNI as the inventory master when
 * the PO is approved before any GRN exists (no GoodsReceive row yet).
 *
 * Run: node tests/grni-resolve-from-po-before-grn.test.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const root = path.join(__dirname, '..');
const Account = require(path.join(root, 'server/models/finance/Account'));
const Inventory = require(path.join(root, 'server/models/procurement/Inventory'));
const PurchaseOrder = require(path.join(root, 'server/models/procurement/PurchaseOrder'));
require(path.join(root, 'server/models/procurement/GoodsReceive')); // register for FinanceHelper
require(path.join(root, 'server/models/procurement/InventoryCategory'));
const Supplier = require(path.join(root, 'server/models/hr/Supplier'));
const User = require(path.join(root, 'server/models/User'));
const FinanceHelper = require(path.join(root, 'server/utils/financeHelper'));

async function main() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI or MONGODB_URI_LOCAL');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const grni2140 = await Account.findOne({ accountNumber: '2140' });
  if (!grni2140) {
    console.error('SKIP: account 2140 not found in chart — cannot assert GRNI mapping');
    process.exit(0);
  }

  const user = await User.findOne().select('_id').lean();
  const supplier = await Supplier.findOne().select('_id').lean();
  if (!user || !supplier) {
    console.error('SKIP: need at least one User and one Supplier');
    process.exit(0);
  }

  const stamp = Date.now();
  const itemName = `GRNI-PO-TEST-${stamp}`;
  const itemCode = `GPO-${stamp}`;

  const inv = await Inventory.create({
    itemCode,
    name: itemName,
    category: 'Raw Materials',
    unit: 'bag',
    quantity: 0,
    unitPrice: 50,
    grniAccount: grni2140._id,
    createdBy: user._id
  });

  const po = await PurchaseOrder.create({
    vendor: supplier._id,
    createdBy: user._id,
    orderDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 7 * 864e5),
    status: 'Draft',
    items: [
      {
        description: itemName,
        quantity: 10,
        unit: 'bag',
        unitPrice: 50,
        amount: 500,
        taxRate: 0
      }
    ],
    subtotal: 500,
    totalAmount: 500
  });

  try {
    const resolved = await FinanceHelper.resolveGrniAccountForBill({
      referenceType: 'purchase_order',
      referenceId: po._id
    });

    if (!resolved) {
      console.error('FAIL: resolveGrniAccountForBill returned null');
      process.exit(1);
    }

    if (resolved.accountNumber !== '2140') {
      console.error('FAIL: expected debit GRNI account 2140, got', resolved.accountNumber, resolved.name);
      process.exit(1);
    }

    console.log('PASS: PO-only (no GRN) resolves GRNI from inventory line match →', resolved.accountNumber, resolved.name);
  } finally {
    await PurchaseOrder.deleteOne({ _id: po._id });
    await Inventory.deleteOne({ _id: inv._id });
    await mongoose.connection.close();
  }
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.connection.close();
  } catch (_) {}
  process.exit(1);
});
