/**
 * Migration: Seed default "Main Store" in the Store collection
 * and backfill existing GoodsReceive, GoodsIssue, and StockTransaction
 * documents to reference the new Store ObjectId.
 *
 * Run once:
 *   node server/scripts/seedMainStore.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Load models
const Store = require('../models/procurement/Store');
const GoodsReceive = require('../models/procurement/GoodsReceive');
const GoodsIssue = require('../models/procurement/GoodsIssue');
const StockTransaction = require('../models/procurement/StockTransaction');

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

  // ─── 1. Create default Main Store if not already present ──────────────────
  let mainStore = await Store.findOne({ type: 'main', name: 'Main Store' });
  if (!mainStore) {
    mainStore = new Store({
      name: 'Main Store',
      type: 'main',
      description: 'Default main warehouse store (migrated from legacy)',
      isActive: true
    });
    await mainStore.save();
    console.log(`✅ Created Main Store (ID: ${mainStore._id}, Code: ${mainStore.code})`);
  } else {
    console.log(`ℹ️  Main Store already exists (ID: ${mainStore._id})`);
  }

  const storeId = mainStore._id;

  // ─── 2. Backfill GoodsReceive ─────────────────────────────────────────────
  const grnWithoutStore = await GoodsReceive.countDocuments({ store: { $exists: false } });
  const grnWithStringStore = await GoodsReceive.countDocuments({ store: { $type: 'string' } });
  console.log(`ℹ️  GRN documents needing backfill: ${grnWithoutStore + grnWithStringStore}`);

  if (grnWithoutStore + grnWithStringStore > 0) {
    await GoodsReceive.updateMany(
      { $or: [{ store: { $exists: false } }, { store: { $type: 'string' } }] },
      { $set: { store: storeId, storeSnapshot: 'Main Store' } }
    );
    console.log(`✅ Backfilled ${grnWithoutStore + grnWithStringStore} GoodsReceive documents`);
  }

  // ─── 3. Backfill GoodsIssue ───────────────────────────────────────────────
  const sinWithoutStore = await GoodsIssue.countDocuments({ store: { $exists: false } });
  const sinWithStringStore = await GoodsIssue.countDocuments({ store: { $type: 'string' } });
  console.log(`ℹ️  SIN documents needing backfill: ${sinWithoutStore + sinWithStringStore}`);

  if (sinWithoutStore + sinWithStringStore > 0) {
    await GoodsIssue.updateMany(
      { $or: [{ store: { $exists: false } }, { store: { $type: 'string' } }] },
      { $set: { store: storeId, storeSnapshot: 'Main Store' } }
    );
    console.log(`✅ Backfilled ${sinWithoutStore + sinWithStringStore} GoodsIssue documents`);
  }

  // ─── 4. Backfill StockTransaction ─────────────────────────────────────────
  const txWithStringStore = await StockTransaction.countDocuments({ store: { $type: 'string' } });
  const txWithoutStore = await StockTransaction.countDocuments({ store: { $exists: false } });
  console.log(`ℹ️  StockTransaction documents needing backfill: ${txWithStringStore + txWithoutStore}`);

  if (txWithStringStore + txWithoutStore > 0) {
    await StockTransaction.updateMany(
      { $or: [{ store: { $exists: false } }, { store: { $type: 'string' } }] },
      { $set: { store: storeId, storeSnapshot: 'Main Store' } }
    );
    console.log(`✅ Backfilled ${txWithStringStore + txWithoutStore} StockTransaction documents`);
  }

  // ─── 5. Summary ───────────────────────────────────────────────────────────
  const storeCount = await Store.countDocuments();
  const grnCount = await GoodsReceive.countDocuments({ store: storeId });
  const sinCount = await GoodsIssue.countDocuments({ store: storeId });
  const txCount = await StockTransaction.countDocuments({ store: storeId });

  console.log('\n📊 Migration Summary:');
  console.log(`   Stores in collection: ${storeCount}`);
  console.log(`   GRN docs with Main Store ref: ${grnCount}`);
  console.log(`   SIN docs with Main Store ref: ${sinCount}`);
  console.log(`   StockTransaction docs with Main Store ref: ${txCount}`);
  console.log('\n✅ Migration complete!');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
