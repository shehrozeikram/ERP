/**
 * attach-finance-accounts.js
 *
 * Attaches the correct Chart-of-Accounts entries to every InventoryCategory
 * and then links each Inventory item to the matching category.
 *
 * Account mapping (by accountNumber, DB-agnostic):
 *
 *  stockValuationAccount  – DR on GRN (inventory asset)
 *  stockInputAccount      – CR on GRN (GRNI clearing)
 *  stockOutputAccount     – DR on issue (COGS)
 *  salesAccount           – CR on sale (revenue)
 *  purchaseAccount        – Expense for direct (non-GRN) purchases
 *
 * Usage:
 *   node server/scripts/attach-finance-accounts.js           # local
 *   node server/scripts/attach-finance-accounts.js prod      # production (reads MONGODB_URI from .env)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_LOCAL = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local';
const MONGO_PROD  = process.env.MONGODB_URI;

const isProduction = process.argv[2] === 'prod';
const MONGO_URI    = isProduction ? MONGO_PROD : MONGO_LOCAL;

if (!MONGO_URI) {
  console.error('ERROR: No MongoDB URI configured. Check your .env file.');
  process.exit(1);
}

// ── Category → finance account mapping ────────────────────────────────────────
// Key: InventoryCategory.name
// Values: accountNumbers for each role
const CATEGORY_ACCOUNT_MAP = {
  'General':        { valuation: '1200', purchase: '5100' },
  'Raw Materials':  { valuation: '1200', purchase: '5100' },
  'Consumables':    { valuation: '1200', purchase: '5100' },
  'Civil Materials':{ valuation: '1200', purchase: '5100' },
  'Electrical':     { valuation: '1200', purchase: '5100' },
  'Office Supplies':{ valuation: '1320', purchase: '6700' },
  'Equipment':      { valuation: '1320', purchase: '5100' },
  'IT Equipment':   { valuation: '1320', purchase: '5100' },
};

// These three are the same for every category
const SHARED = {
  stockInput: '2140',   // GRNI – Goods Received Not Invoiced
  stockOutput: '5000',  // Cost of Goods Sold (COGS)
  sales: '4000',        // Sales Revenue
};

// Inventory.category enum → InventoryCategory.name
const ITEM_CATEGORY_TO_INV_CATEGORY = {
  'Raw Materials':   'Raw Materials',
  'Finished Goods':  'General',
  'Office Supplies': 'Office Supplies',
  'Equipment':       'Equipment',
  'Consumables':     'Consumables',
  'Other':           'General',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const Account           = () => mongoose.model('Account');
const InventoryCategory = () => mongoose.model('InventoryCategory');
const Inventory         = () => mongoose.model('Inventory');

async function getAccountId(accountNumber) {
  const acc = await Account().findOne({ accountNumber, isActive: true }).lean();
  if (!acc) throw new Error(`Account ${accountNumber} not found in Chart of Accounts`);
  return acc._id;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n=== Attach Finance Accounts ===`);
  console.log(`Target: ${isProduction ? 'PRODUCTION' : 'LOCAL'} database`);
  console.log(`URI: ${MONGO_URI.replace(/\/\/.*@/, '//<credentials>@')}\n`);

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  // Ensure models are loaded
  require('../models/finance/Account');
  require('../models/procurement/InventoryCategory');
  require('../models/procurement/Inventory');

  // ── Step 1: Pre-fetch shared account IDs ────────────────────────────────────
  console.log('Step 1: Resolving account IDs from Chart of Accounts...');
  const sharedIds = {
    stockInput:  await getAccountId(SHARED.stockInput),
    stockOutput: await getAccountId(SHARED.stockOutput),
    sales:       await getAccountId(SHARED.sales),
  };
  console.log(`  stockInputAccount  (${SHARED.stockInput} GRNI)  : ${sharedIds.stockInput}`);
  console.log(`  stockOutputAccount (${SHARED.stockOutput} COGS)  : ${sharedIds.stockOutput}`);
  console.log(`  salesAccount       (${SHARED.sales} Revenue): ${sharedIds.sales}`);
  console.log();

  // ── Step 2: Fix InventoryCategory finance accounts ──────────────────────────
  console.log('Step 2: Updating InventoryCategory finance accounts...');
  const categories = await InventoryCategory().find().lean();
  const categoryIdByName = {};

  for (const cat of categories) {
    const mapping = CATEGORY_ACCOUNT_MAP[cat.name];
    if (!mapping) {
      console.log(`  [SKIP] Unknown category name: "${cat.name}" — no mapping defined`);
      categoryIdByName[cat.name] = cat._id;
      continue;
    }

    const valuationId = await getAccountId(mapping.valuation);
    const purchaseId  = await getAccountId(mapping.purchase);

    await InventoryCategory().updateOne(
      { _id: cat._id },
      {
        $set: {
          stockValuationAccount: valuationId,
          stockInputAccount:     sharedIds.stockInput,
          stockOutputAccount:    sharedIds.stockOutput,
          salesAccount:          sharedIds.sales,
          purchaseAccount:       purchaseId,
        }
      }
    );

    categoryIdByName[cat.name] = cat._id;
    console.log(`  [OK] "${cat.name}" → valuation:${mapping.valuation}, input:${SHARED.stockInput}, output:${SHARED.stockOutput}, sales:${SHARED.sales}, purchase:${mapping.purchase}`);
  }
  console.log();

  // ── Step 3: Link inventory items to InventoryCategory ───────────────────────
  console.log('Step 3: Linking inventory items to InventoryCategories...');

  let linked = 0;
  let skipped = 0;

  for (const [itemCategory, catName] of Object.entries(ITEM_CATEGORY_TO_INV_CATEGORY)) {
    const catId = categoryIdByName[catName];
    if (!catId) {
      console.log(`  [WARN] No InventoryCategory found for mapping "${itemCategory}" → "${catName}"`);
      skipped++;
      continue;
    }

    const result = await Inventory().updateMany(
      { category: itemCategory, $or: [{ inventoryCategory: { $exists: false } }, { inventoryCategory: null }] },
      { $set: { inventoryCategory: catId } }
    );

    if (result.modifiedCount > 0) {
      console.log(`  [OK] "${itemCategory}" → "${catName}" : ${result.modifiedCount} items linked`);
      linked += result.modifiedCount;
    } else {
      console.log(`  [--] "${itemCategory}" → "${catName}" : 0 items to update (already linked or none in this category)`);
    }
  }

  // Also link items that somehow have no category value set
  const noCatResult = await Inventory().updateMany(
    { $or: [{ category: { $exists: false } }, { category: null }], $or: [{ inventoryCategory: { $exists: false } }, { inventoryCategory: null }] },
    { $set: { inventoryCategory: categoryIdByName['General'] } }
  );
  if (noCatResult.modifiedCount > 0) {
    console.log(`  [OK] (no category) → "General" : ${noCatResult.modifiedCount} items linked`);
    linked += noCatResult.modifiedCount;
  }

  console.log(`\n  Total items linked to a category: ${linked}`);
  console.log(`  Skipped (mapping not found): ${skipped}`);
  console.log();

  // ── Step 4: Verification ─────────────────────────────────────────────────────
  console.log('Step 4: Verification...');
  const totalItems        = await Inventory().countDocuments();
  const withCategory      = await Inventory().countDocuments({ inventoryCategory: { $exists: true, $ne: null } });
  const withInventoryAcct = await Inventory().countDocuments({ inventoryAccount: { $exists: true, $ne: null } });

  console.log(`  Total inventory items   : ${totalItems}`);
  console.log(`  Have inventoryCategory  : ${withCategory}`);
  console.log(`  Have inventoryAccount   : ${withInventoryAcct} (item-level override, expected ~0)`);

  // Spot-check: pull one item and show populated finance accounts
  const sample = await Inventory()
    .findOne({ inventoryCategory: { $exists: true, $ne: null } })
    .populate({
      path: 'inventoryCategory',
      populate: [
        { path: 'stockValuationAccount', select: 'accountNumber name' },
        { path: 'stockInputAccount',     select: 'accountNumber name' },
        { path: 'stockOutputAccount',    select: 'accountNumber name' },
        { path: 'salesAccount',          select: 'accountNumber name' },
        { path: 'purchaseAccount',       select: 'accountNumber name' },
      ]
    })
    .lean();

  if (sample) {
    const c = sample.inventoryCategory;
    console.log(`\n  Sample item: "${sample.name}" (${sample.category})`);
    console.log(`    Category            : ${c.name}`);
    console.log(`    stockValuationAcct  : ${c.stockValuationAccount?.accountNumber} – ${c.stockValuationAccount?.name}`);
    console.log(`    stockInputAcct      : ${c.stockInputAccount?.accountNumber} – ${c.stockInputAccount?.name}`);
    console.log(`    stockOutputAcct     : ${c.stockOutputAccount?.accountNumber} – ${c.stockOutputAccount?.name}`);
    console.log(`    salesAccount        : ${c.salesAccount?.accountNumber} – ${c.salesAccount?.name}`);
    console.log(`    purchaseAccount     : ${c.purchaseAccount?.accountNumber} – ${c.purchaseAccount?.name}`);
  }

  await mongoose.disconnect();
  console.log('\nDone. Disconnected.\n');
}

run().catch(err => {
  console.error('FATAL:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
