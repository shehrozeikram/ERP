/**
 * Deletes the Indent, Quotation, and Purchase Order created by
 * seed-full-advance-po-pending-finance.js using server/scripts/last-full-advance-demo.json.
 *
 * Does not delete vendors, departments, or finance postings (none are created by the seed script).
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

const PurchaseOrder = mongoose.model('PurchaseOrder');
const Quotation = mongoose.model('Quotation');
const Indent = mongoose.model('Indent');

async function run() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error(`❌ State file not found: ${STATE_FILE}`);
    console.error('   Run seed-full-advance-po-pending-finance.js first, or delete records manually in MongoDB.');
    process.exit(1);
  }

  const raw = fs.readFileSync(STATE_FILE, 'utf8');
  const state = JSON.parse(raw);
  const { purchaseOrderId, quotationId, indentId } = state;
  if (!purchaseOrderId || !quotationId || !indentId) {
    console.error('❌ State file missing purchaseOrderId, quotationId, or indentId');
    process.exit(1);
  }

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

  const po = await PurchaseOrder.findByIdAndDelete(purchaseOrderId);
  console.log(po ? `🗑️  Deleted PurchaseOrder ${purchaseOrderId}` : `⚠️  PurchaseOrder ${purchaseOrderId} not found`);

  const q = await Quotation.findByIdAndDelete(quotationId);
  console.log(q ? `🗑️  Deleted Quotation ${quotationId}` : `⚠️  Quotation ${quotationId} not found`);

  const ind = await Indent.findByIdAndDelete(indentId);
  console.log(ind ? `🗑️  Deleted Indent ${indentId}` : `⚠️  Indent ${indentId} not found`);

  fs.unlinkSync(STATE_FILE);
  console.log(`✅ Removed ${STATE_FILE}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌', err.message);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
