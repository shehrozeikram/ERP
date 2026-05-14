/**
 * Demo reset: removes all purchase orders and all store-related records
 * (returns, stock movements, goods issues/receives, delivery challans, store master).
 * Does not modify the Inventory collection or ItemMaster.
 *
 * If server/scripts/last-full-advance-demo.json exists, also deletes the Indent and
 * Quotation IDs stored there (the PO is already removed by the global PO wipe).
 *
 * Run from project root:
 *   node server/scripts/clear-full-advance-demo.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const STATE_FILE = path.join(__dirname, 'last-full-advance-demo.json');

require('../models/procurement/PurchaseOrder');
require('../models/procurement/Quotation');
require('../models/general/Indent');
require('../models/procurement/PurchaseReturn');
require('../models/procurement/StockTransaction');
require('../models/procurement/GoodsIssue');
require('../models/procurement/GoodsReceive');
require('../models/procurement/DeliveryChallan');
require('../models/procurement/Store');

const PurchaseOrder = mongoose.model('PurchaseOrder');
const Quotation = mongoose.model('Quotation');
const Indent = mongoose.model('Indent');
const PurchaseReturn = mongoose.model('PurchaseReturn');
const StockTransaction = mongoose.model('StockTransaction');
const GoodsIssue = mongoose.model('GoodsIssue');
const GoodsReceive = mongoose.model('GoodsReceive');
const DeliveryChallan = mongoose.model('DeliveryChallan');
const Store = mongoose.model('Store');

async function run() {
  const uri =
    process.env.NODE_ENV === 'production'
      ? process.env.MONGODB_URI
      : process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ Set MONGODB_URI or MONGODB_URI_LOCAL in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const pr = await PurchaseReturn.deleteMany({});
  console.log(`🗑️  PurchaseReturn removed: ${pr.deletedCount}`);

  const st = await StockTransaction.deleteMany({});
  console.log(`🗑️  StockTransaction removed: ${st.deletedCount}`);

  const gi = await GoodsIssue.deleteMany({});
  console.log(`🗑️  GoodsIssue removed: ${gi.deletedCount}`);

  const gr = await GoodsReceive.deleteMany({});
  console.log(`🗑️  GoodsReceive removed: ${gr.deletedCount}`);

  const dc = await DeliveryChallan.deleteMany({});
  console.log(`🗑️  DeliveryChallan removed: ${dc.deletedCount}`);

  const po = await PurchaseOrder.deleteMany({});
  console.log(`🗑️  PurchaseOrder removed: ${po.deletedCount}`);

  const stores = await Store.deleteMany({});
  console.log(`🗑️  Store (locations) removed: ${stores.deletedCount}`);
  console.log('   (Inventory collection was not modified.)');

  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const state = JSON.parse(raw);
    const { quotationId, indentId } = state;

    if (quotationId) {
      const q = await Quotation.findByIdAndDelete(quotationId);
      console.log(q ? `🗑️  Deleted Quotation ${quotationId}` : `⚠️  Quotation ${quotationId} not found`);
    }
    if (indentId) {
      const ind = await Indent.findByIdAndDelete(indentId);
      console.log(ind ? `🗑️  Deleted Indent ${indentId}` : `⚠️  Indent ${indentId} not found`);
    }

    fs.unlinkSync(STATE_FILE);
    console.log(`✅ Removed ${STATE_FILE}`);
  } else {
    console.log(`ℹ️  No state file at ${STATE_FILE} (skipped indent/quotation cleanup).`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌', err.message);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
