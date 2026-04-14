/**
 * Applies standard chart accounts to all InventoryCategory documents and aligns Inventory items
 * (same behaviour as POST /api/inventory-categories/apply-standard-accounts).
 *
 * Prerequisite: core accounts exist (run Finance → ensure defaults, or POST /api/finance/accounts/ensure-defaults).
 *
 * Usage:
 *   node scripts/apply-inventory-standard-accounts.js
 *
 * Uses MONGODB_URI_LOCAL if set, else MONGODB_URI (same as server).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { applyStandardInventoryAccountMappings } = require('../server/utils/inventoryStandardAccountMap');

async function main() {
  const uri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI or MONGODB_URI_LOCAL in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    const data = await applyStandardInventoryAccountMappings({
      linkInventoryItems: true,
      clearItemOverrides: true
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    if (e.message === 'MISSING_ACCOUNTS') {
      console.error('Missing chart accounts for roles:', e.missingRoles);
      console.error('Run POST /api/finance/accounts/ensure-defaults or create accounts 1100, 2100, 5000, 5001, 4001.');
      process.exit(1);
    }
    throw e;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
