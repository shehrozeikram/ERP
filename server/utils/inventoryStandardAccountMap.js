const Account = require('../models/finance/Account');
const InventoryCategory = require('../models/procurement/InventoryCategory');
const Inventory = require('../models/procurement/Inventory');

/**
 * Perpetual-inventory SME defaults aligned with this app's ensure-defaults chart:
 *   DR inventory (1100) / CR GRNI (2100) on GRN; DR COGS (5000) on issue;
 *   non-GRN purchase expense → General Expenses (5001) or Direct Materials (5100) if present;
 *   revenue → Sales Revenue (4001) or legacy Sales (4000).
 *
 * All product categories typically share these pool accounts unless you use sub-ledgers.
 */
const STANDARD_ROLE_ACCOUNT_NUMBERS = {
  stockValuationAccount: ['1100'],
  stockInputAccount: ['2100'],
  stockOutputAccount: ['5000'],
  purchaseAccount: ['5001', '5100'],
  salesAccount: ['4001', '4000']
};

async function resolveFirstAccountId(accountNumbers) {
  for (const num of accountNumbers) {
    const a = await Account.findOne({ accountNumber: String(num) })
      .select('_id accountNumber name')
      .lean();
    if (a) return a._id;
  }
  return null;
}

/**
 * Resolves ObjectIds for each role, or null if no candidate exists in the DB.
 */
async function resolveStandardInventoryAccountIds() {
  const out = {};
  for (const [role, nums] of Object.entries(STANDARD_ROLE_ACCOUNT_NUMBERS)) {
    out[role] = await resolveFirstAccountId(nums);
  }
  return out;
}

/** Maps Inventory.category enum (legacy string) → InventoryCategory.name */
const LEGACY_ITEM_ENUM_TO_CATEGORY_NAME = {
  'Raw Materials': 'Raw Materials',
  'Finished Goods': 'General',
  'Office Supplies': 'Office Supplies',
  'Equipment': 'Equipment',
  'Consumables': 'Consumables',
  'Other': 'General'
};

/**
 * Applies standard account IDs to every InventoryCategory; optionally links legacy items
 * to an InventoryCategory by enum mapping; optionally clears item-level account overrides.
 */
async function applyStandardInventoryAccountMappings({
  linkInventoryItems = true,
  clearItemOverrides = true
} = {}) {
  const ids = await resolveStandardInventoryAccountIds();
  const missing = Object.entries(ids)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    const err = new Error('MISSING_ACCOUNTS');
    err.missingRoles = missing;
    throw err;
  }

  const catUpdate = await InventoryCategory.updateMany(
    {},
    {
      $set: {
        stockValuationAccount: ids.stockValuationAccount,
        stockInputAccount: ids.stockInputAccount,
        stockOutputAccount: ids.stockOutputAccount,
        purchaseAccount: ids.purchaseAccount,
        salesAccount: ids.salesAccount
      }
    }
  );

  const categories = await InventoryCategory.find({}).select('_id name').lean();
  const nameToId = new Map(categories.map((c) => [String(c.name).trim().toLowerCase(), c._id]));
  const generalId = nameToId.get('general');

  let itemsLinked = 0;
  let linkNote;

  if (linkInventoryItems) {
    if (!generalId) {
      linkNote =
        'Skipped linking inventory rows: no category named "General" found. Seed default categories first, then run again.';
    } else {
      const needLink = await Inventory.find({
        $or: [{ inventoryCategory: null }, { inventoryCategory: { $exists: false } }]
      })
        .select('_id category')
        .lean();

      const bulk = [];
      for (const item of needLink) {
        const mapped = LEGACY_ITEM_ENUM_TO_CATEGORY_NAME[item.category] || 'General';
        const catId = nameToId.get(String(mapped).trim().toLowerCase()) || generalId;
        bulk.push({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { inventoryCategory: catId } }
          }
        });
      }
      if (bulk.length) {
        const wr = await Inventory.bulkWrite(bulk);
        itemsLinked = wr.modifiedCount ?? wr.nModified ?? bulk.length;
      }
    }
  }

  let overridesCleared = 0;
  if (clearItemOverrides) {
    const unsetRes = await Inventory.updateMany(
      {},
      {
        $unset: {
          inventoryAccount: 1,
          grniAccount: 1,
          cogsAccount: 1,
          purchaseAccount: 1,
          salesAccount: 1
        }
      }
    );
    overridesCleared = unsetRes.modifiedCount ?? 0;
  }

  return {
    categoriesMatched: catUpdate.matchedCount ?? 0,
    categoriesModified: catUpdate.modifiedCount ?? 0,
    accountsUsed: {
      stockValuationAccount: ids.stockValuationAccount,
      stockInputAccount: ids.stockInputAccount,
      stockOutputAccount: ids.stockOutputAccount,
      purchaseAccount: ids.purchaseAccount,
      salesAccount: ids.salesAccount
    },
    itemsLinked,
    itemAccountOverridesCleared: overridesCleared,
    linkNote: linkNote || null
  };
}

module.exports = {
  STANDARD_ROLE_ACCOUNT_NUMBERS,
  resolveStandardInventoryAccountIds,
  LEGACY_ITEM_ENUM_TO_CATEGORY_NAME,
  applyStandardInventoryAccountMappings
};
