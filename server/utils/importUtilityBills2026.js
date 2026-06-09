const path = require('path');
const fs = require('fs');
const UtilityCentralStore = require('../models/hr/UtilityCentralStore');
const UtilityStoreCategory = require('../models/hr/UtilityStoreCategory');
const UtilityStoreItem = require('../models/hr/UtilityStoreItem');
const Account = require('../models/finance/Account');
const FinanceHelper = require('./financeHelper');

const DATA_PATH = path.join(__dirname, '..', 'data', 'utility-bills-2026-centralized-store.json');

const CATEGORY_META = [
  { name: 'IESCO', sortOrder: 1 },
  { name: 'SNGPL', sortOrder: 2 },
  { name: 'PTCL-Nayatel', sortOrder: 3 },
  { name: 'CDA Water', sortOrder: 4 }
];

const buildDescription = (row, categoryName) => {
  const parts = [];
  if (row.reference) parts.push(`Ref: ${row.reference}`);
  if (row.telephone) parts.push(`Tel: ${row.telephone}`);
  if (row.accountId) parts.push(`Account ID: ${row.accountId}`);
  if (row.consumerNumber) parts.push(`Consumer #: ${row.consumerNumber}`);
  if (row.provider) parts.push(`Provider: ${row.provider}`);
  if (row.issueDate) parts.push(`Issue: ${row.issueDate}`);
  if (row.dueDate) parts.push(`Due: ${row.dueDate}`);
  if (!parts.length && categoryName) parts.push(`Imported from 2026 utility bills (${categoryName})`);
  return parts.join(' | ');
};

const mapRowToItem = (row, categoryName, expenseAccountId) => {
  const usesMeter = categoryName === 'IESCO' || categoryName === 'SNGPL';
  return {
    name: row.name,
    utilityType: row.utilityType || 'Other',
    meterNumber: usesMeter ? (row.meterNumber || '') : '',
    location: row.location || row.name || '',
    site: row.account || '',
    department: '',
    expenseAccount: expenseAccountId,
    defaultAmount: Number(row.defaultAmount) || 0,
    description: buildDescription(row, categoryName)
  };
};

const loadSeedData = () => {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Seed data not found at ${DATA_PATH}`);
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
};

/**
 * Import 2026 utility bill rows (IESCO, SNGPL, PTCL-Nayatel, CDA Water) into Centralized Store.
 * @param {{ actorId?: import('mongoose').Types.ObjectId, replace?: boolean }} options
 */
async function importUtilityBills2026({ actorId, replace = false } = {}) {
  const seed = loadSeedData();
  const store = await UtilityCentralStore.getOrCreate(actorId);

  let expenseAccount = await Account.findOne({
    accountNumber: FinanceHelper.ACCOUNTS?.UTILITIES || '6200',
    isActive: true
  });
  if (!expenseAccount) {
    expenseAccount = await Account.findOne({ accountNumber: '6200', isActive: true });
  }
  if (!expenseAccount) {
    throw new Error('Create expense account 6200 in Chart of Accounts first');
  }

  const siteSet = new Set(store.siteOptions || []);
  let categoriesCreated = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let itemsSkipped = 0;

  for (const meta of CATEGORY_META) {
    const rows = seed[meta.name];
    if (!Array.isArray(rows) || !rows.length) continue;

    let category = await UtilityStoreCategory.findOne({ name: meta.name });
    if (!category) {
      category = await UtilityStoreCategory.create({
        name: meta.name,
        description: 'Imported from Utility Bills details of SGC all offices - 2026',
        sortOrder: meta.sortOrder,
        createdBy: actorId,
        updatedBy: actorId
      });
      categoriesCreated += 1;
    } else if (category.sortOrder !== meta.sortOrder) {
      category.sortOrder = meta.sortOrder;
      category.updatedBy = actorId;
      await category.save();
    }

    if (replace) {
      await UtilityStoreItem.deleteMany({ category: category._id });
    }

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row?.name?.trim()) {
        itemsSkipped += 1;
        continue;
      }

      const payload = mapRowToItem(row, meta.name, expenseAccount._id);
      if (payload.site) siteSet.add(payload.site);

      const existing = await UtilityStoreItem.findOne({
        category: category._id,
        name: payload.name
      });

      if (existing) {
        Object.assign(existing, payload, {
          sortOrder: i + 1,
          isActive: true,
          updatedBy: actorId
        });
        await existing.save();
        itemsUpdated += 1;
      } else {
        await UtilityStoreItem.create({
          category: category._id,
          ...payload,
          sortOrder: i + 1,
          createdBy: actorId,
          updatedBy: actorId
        });
        itemsCreated += 1;
      }
    }
  }

  const siteOptions = [...siteSet].sort((a, b) => a.localeCompare(b));
  store.siteOptions = siteOptions;
  store.updatedBy = actorId;
  await store.save();

  const totals = CATEGORY_META.reduce((acc, meta) => {
    acc[meta.name] = (seed[meta.name] || []).length;
    return acc;
  }, {});

  return {
    categoriesCreated,
    itemsCreated,
    itemsUpdated,
    itemsSkipped,
    siteOptions,
    totals
  };
}

module.exports = {
  DATA_PATH,
  CATEGORY_META,
  importUtilityBills2026,
  loadSeedData
};
