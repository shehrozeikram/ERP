/**
 * One-time cleanup: removes all GRN, SIN, Inventory, StockTransaction,
 * Indent, and procurement-related Payment records from the database.
 *
 * Run:  node server/scripts/clearProcurementData.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Load models so their collections are registered
require('../models/procurement/GoodsReceive');
require('../models/procurement/GoodsIssue');
require('../models/procurement/Inventory');
require('../models/procurement/StockTransaction');
require('../models/general/Indent');

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('❌ No MongoDB URI found in environment variables');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const results = {};

  // GRNs
  const grn = await mongoose.connection.collection('goodsreceives').deleteMany({});
  results['GoodsReceives (GRNs)'] = grn.deletedCount;

  // SINs
  const sin = await mongoose.connection.collection('goodsissues').deleteMany({});
  results['GoodsIssues (SINs)'] = sin.deletedCount;

  // Inventory
  const inv = await mongoose.connection.collection('inventories').deleteMany({});
  results['Inventory'] = inv.deletedCount;

  // StockTransactions
  const tx = await mongoose.connection.collection('stocktransactions').deleteMany({});
  results['StockTransactions'] = tx.deletedCount;

  // Indents
  const indent = await mongoose.connection.collection('indents').deleteMany({});
  results['Indents'] = indent.deletedCount;

  // Payments (procurement-related — collection name may be 'payments')
  const pay = await mongoose.connection.collection('payments').deleteMany({});
  results['Payments'] = pay.deletedCount;

  console.log('\n🗑️  Deleted records:');
  for (const [col, count] of Object.entries(results)) {
    console.log(`   ${col}: ${count} document(s) deleted`);
  }

  console.log('\n✅ Cleanup complete!');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Cleanup failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
