/**
 * Clean All Indents and Related Procurement Records Across All Departments
 *
 * Removes:
 *   - Indent (All indents from all departments, including comparative statements & approval chains)
 *   - Quotation & QuotationInvitation
 *   - CashApproval (Comparative statement cash approvals)
 *   - PurchaseOrder (POs)
 *   - GoodsReceive (GRNs)
 *   - GoodsIssue (SINs)
 *   - PurchaseReturn (Purchase Returns)
 *   - DeliveryChallan (Delivery Challans)
 *   - InwardGatePass (IGPs)
 *   - QualityInspection (QC Vouchers)
 *   - LandedCostVoucher (Landed Cost Vouchers)
 *
 * Preserves:
 *   - Chart of Accounts (Account), InventoryCategory, Store, Supplier/Vendor, Projects,
 *     Departments, Users, Inventory Item Master definitions.
 *
 * Usage:
 *   node scripts/clean-all-indents-and-related-records.js --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const root = path.join(__dirname, '..');

function loadModels() {
  return {
    GoodsIssue: require(path.join(root, 'server/models/procurement/GoodsIssue')),
    GoodsReceive: require(path.join(root, 'server/models/procurement/GoodsReceive')),
    PurchaseReturn: require(path.join(root, 'server/models/procurement/PurchaseReturn')),
    PurchaseOrder: require(path.join(root, 'server/models/procurement/PurchaseOrder')),
    QuotationInvitation: require(path.join(root, 'server/models/procurement/QuotationInvitation')),
    Quotation: require(path.join(root, 'server/models/procurement/Quotation')),
    CashApproval: require(path.join(root, 'server/models/procurement/CashApproval')),
    Indent: require(path.join(root, 'server/models/general/Indent')),
    InwardGatePass: require(path.join(root, 'server/models/procurement/InwardGatePass')),
    QualityInspection: require(path.join(root, 'server/models/procurement/QualityInspection')),
    LandedCostVoucher: require(path.join(root, 'server/models/procurement/LandedCostVoucher')),
    StockQuant: require(path.join(root, 'server/models/procurement/StockQuant')),
    StockTransaction: require(path.join(root, 'server/models/procurement/StockTransaction'))
  };
}

const DELETE_ORDER = [
  'InwardGatePass',
  'QualityInspection',
  'LandedCostVoucher',
  'GoodsIssue',
  'GoodsReceive',
  'PurchaseReturn',
  'PurchaseOrder',
  'QuotationInvitation',
  'Quotation',
  'CashApproval',
  'Indent',
  'StockQuant',
  'StockTransaction'
];

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error(
      'Refusing to run without --yes. This permanently deletes data.\n' +
        'Example: node scripts/clean-all-indents-and-related-records.js --yes'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI or MONGODB_URI_LOCAL in .env');
    process.exit(1);
  }

  console.log('Connecting:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  await mongoose.connect(uri);

  const models = loadModels();
  const summary = [];

  for (const key of DELETE_ORDER) {
    const Model = models[key];
    if (!Model || typeof Model.deleteMany !== 'function') {
      summary.push({ key, deleted: 0, error: 'model missing' });
      continue;
    }

    try {
      const res = await Model.deleteMany({});
      summary.push({ key, deleted: res.deletedCount });
      console.log(`  ${key}: deleted ${res.deletedCount} records`);
    } catch (error) {
      summary.push({ key, deleted: 0, error: error.message });
      console.error(`  ${key}: FAILED`, error.message);
    }
  }

  await mongoose.connection.close();
  console.log('\nDone. Cleanup Summary:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
