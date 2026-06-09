const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const UtilityCentralStore = require('../models/hr/UtilityCentralStore');
const UtilityStoreCategory = require('../models/hr/UtilityStoreCategory');
const UtilityStoreItem = require('../models/hr/UtilityStoreItem');
const Department = require('../models/hr/Department');
const Account = require('../models/finance/Account');
const FinanceHelper = require('../utils/financeHelper');
const { importUtilityBills2026 } = require('../utils/importUtilityBills2026');

const loadDepartments = () =>
  Department.find({ isActive: true }).select('name code').sort({ name: 1 }).lean();

const getActorId = (req) => req.user?._id || req.user?.id;

/** Assign CSI-###### codes to catalog rows that are still missing one (legacy / seed data). */
const ensureStoreItemsHaveCodes = async (limit = 250) => {
  const blanks = await UtilityStoreItem.find({
    $or: [{ code: '' }, { code: null }, { code: { $exists: false } }]
  })
    .select('_id')
    .limit(limit)
    .lean();
  if (!blanks.length) return;
  const UtilityCentralStore = require('../models/hr/UtilityCentralStore');
  for (const row of blanks) {
    const code = await UtilityCentralStore.assignNextItemCode();
    await UtilityStoreItem.updateOne({ _id: row._id }, { $set: { code } });
  }
};

const populateItem = (q) => q
  .populate('category', 'name')
  .populate('expenseAccount', 'accountNumber name type')
  .populate('createdBy', 'firstName lastName email')
  .populate('updatedBy', 'firstName lastName email');

/** Default expense account for utility items (6200). */
const ensureDefaultExpenseAccount = async () => {
  let acc = await Account.findOne({ accountNumber: FinanceHelper.ACCOUNTS.UTILITIES || '6200', isActive: true });
  if (!acc) {
    acc = await Account.findOne({ accountNumber: '6200', isActive: true });
  }
  return acc;
};

// GET store config + category tree + items (catalog for bills)
router.get(
  '/catalog',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'),
  async (req, res) => {
    try {
      const store = await UtilityCentralStore.getOrCreate(getActorId(req));
      await ensureStoreItemsHaveCodes(300);
      const categories = await UtilityStoreCategory.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      const items = await populateItem(
        UtilityStoreItem.find({ isActive: true }).sort({ sortOrder: 1, name: 1 })
      ).lean();

      const expenseAccounts = await Account.find({
        isActive: true,
        type: 'Expense'
      })
        .select('accountNumber name category')
        .sort({ accountNumber: 1 })
        .limit(500)
        .lean();

      const departments = await loadDepartments();

      res.json({
        success: true,
        data: {
          store,
          categories,
          items,
          expenseAccounts,
          departments,
          siteOptions: store.siteOptions || []
        }
      });
    } catch (error) {
      console.error('centralizedStore catalog:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to load catalog' });
    }
  }
);

router.get(
  '/',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'),
  async (req, res) => {
    try {
      const store = await UtilityCentralStore.getOrCreate(getActorId(req));
      await ensureStoreItemsHaveCodes(300);
      const categories = await UtilityStoreCategory.find()
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      const items = await populateItem(UtilityStoreItem.find().sort({ sortOrder: 1, name: 1 }));

      const departments = await loadDepartments();

      res.json({
        success: true,
        data: {
          store,
          categories,
          items,
          departments,
          siteOptions: store.siteOptions || []
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.post(
  '/site-options',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'),
  async (req, res) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Site name is required' });
      }
      const store = await UtilityCentralStore.getOrCreate(getActorId(req));
      const options = [...(store.siteOptions || [])];
      if (!options.some((s) => s.toLowerCase() === name.toLowerCase())) {
        options.push(name);
        options.sort((a, b) => a.localeCompare(b));
        store.siteOptions = options;
        store.updatedBy = getActorId(req);
        await store.save();
      }
      res.json({ success: true, data: { siteOptions: store.siteOptions } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put(
  '/',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'),
  async (req, res) => {
    try {
      const store = await UtilityCentralStore.getOrCreate(getActorId(req));
      if (req.body.name) store.name = String(req.body.name).trim();
      if (req.body.isActive !== undefined) store.isActive = Boolean(req.body.isActive);
      store.updatedBy = getActorId(req);
      await store.save();
      res.json({ success: true, data: store });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Categories
router.post(
  '/categories',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'create'),
  async (req, res) => {
    try {
      const { name, description, sortOrder } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      const cat = await UtilityStoreCategory.create({
        name: name.trim(),
        description: description || '',
        sortOrder: Number(sortOrder) || 0,
        createdBy: getActorId(req),
        updatedBy: getActorId(req)
      });
      res.status(201).json({ success: true, data: cat });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'Category name already exists' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put(
  '/categories/:id',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'),
  async (req, res) => {
    try {
      const cat = await UtilityStoreCategory.findById(req.params.id);
      if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
      if (req.body.name) cat.name = String(req.body.name).trim();
      if (req.body.description !== undefined) cat.description = req.body.description;
      if (req.body.sortOrder !== undefined) cat.sortOrder = Number(req.body.sortOrder) || 0;
      if (req.body.isActive !== undefined) cat.isActive = Boolean(req.body.isActive);
      cat.updatedBy = getActorId(req);
      await cat.save();
      res.json({ success: true, data: cat });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete(
  '/categories/:id',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'delete'),
  async (req, res) => {
    try {
      const inUse = await UtilityStoreItem.countDocuments({ category: req.params.id });
      if (inUse) {
        return res.status(400).json({ success: false, message: 'Remove items in this category first' });
      }
      await UtilityStoreCategory.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Items
router.post(
  '/items',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'create'),
  async (req, res) => {
    try {
      const {
        category, name, code, utilityType, meterNumber, location, site, department,
        expenseAccount, defaultAmount, description, sortOrder
      } = req.body;
      if (!category || !name?.trim()) {
        return res.status(400).json({ success: false, message: 'Category and item name are required' });
      }
      let expenseAccountId = expenseAccount;
      if (!expenseAccountId) {
        const def = await ensureDefaultExpenseAccount();
        if (!def) {
          return res.status(400).json({ success: false, message: 'Expense account 6200 not found in Chart of Accounts' });
        }
        expenseAccountId = def._id;
      }
      const item = await UtilityStoreItem.create({
        category,
        name: name.trim(),
        code: code || '',
        utilityType: utilityType || 'Electricity',
        meterNumber: meterNumber || '',
        location: location || '',
        site: site || '',
        department: department || '',
        expenseAccount: expenseAccountId,
        defaultAmount: Number(defaultAmount) || 0,
        description: description || '',
        sortOrder: Number(sortOrder) || 0,
        createdBy: getActorId(req),
        updatedBy: getActorId(req)
      });
      const populated = await populateItem(UtilityStoreItem.findById(item._id));
      res.status(201).json({ success: true, data: populated });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ success: false, message: 'Item name already exists in this category' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put(
  '/items/:id',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'),
  async (req, res) => {
    try {
      const item = await UtilityStoreItem.findById(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
      const fields = [
        'name', 'code', 'utilityType', 'meterNumber', 'location', 'site', 'department',
        'description', 'defaultAmount', 'sortOrder', 'isActive', 'category', 'expenseAccount'
      ];
      fields.forEach((f) => {
        if (req.body[f] !== undefined) item[f] = req.body[f];
      });
      if (req.body.name) item.name = String(req.body.name).trim();
      item.updatedBy = getActorId(req);
      await item.save();
      const populated = await populateItem(UtilityStoreItem.findById(item._id));
      res.json({ success: true, data: populated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete(
  '/items/:id',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'delete'),
  async (req, res) => {
    try {
      await UtilityStoreItem.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/** Import IESCO, SNGPL, PTCL-Nayatel, CDA Water from bundled 2026 utility bills data */
router.post(
  '/import-utility-2026',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'create'),
  async (req, res) => {
    try {
      const replace = Boolean(req.body?.replace);
      const result = await importUtilityBills2026({
        actorId: getActorId(req),
        replace
      });
      const itemCount = result.itemsCreated + result.itemsUpdated;
      res.json({
        success: true,
        message: `Imported 2026 utility data. ${result.categoriesCreated} category(ies), ${itemCount} item(s) saved.`,
        data: result
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/** Seed categories (Electricity, Gas, …) each with Meter 1, Meter 2, Meter 3 items */
router.post(
  '/seed-defaults',
  permissions.checkSubRolePermission('admin', 'utility_bills_management', 'create'),
  async (req, res) => {
    try {
      const actorId = getActorId(req);
      await UtilityCentralStore.getOrCreate(actorId);

      const resolveAccount = async (accountNumber, fallback) => {
        const num = accountNumber || fallback;
        let acc = await Account.findOne({ accountNumber: String(num), isActive: true });
        if (!acc && fallback) acc = await Account.findOne({ accountNumber: String(fallback), isActive: true });
        return acc;
      };

      const def6200 = await resolveAccount('6200');
      if (!def6200) {
        return res.status(400).json({ success: false, message: 'Create expense account 6200 in Chart of Accounts first' });
      }
      const acc6100 = (await resolveAccount('6100')) || def6200;
      const acc6400 = (await resolveAccount('6400')) || def6200;
      const acc6300 = (await resolveAccount('6300')) || def6200;

      // Flatten legacy hierarchy (old parentCategory / "Utilities" bucket)
      await UtilityStoreCategory.collection.updateMany(
        { parentCategory: { $exists: true, $ne: null } },
        { $unset: { parentCategory: '' } }
      );
      const legacyUtilities = await UtilityStoreCategory.findOne({ name: /^utilities$/i });
      if (legacyUtilities) {
        await UtilityStoreItem.deleteMany({ category: legacyUtilities._id });
        await UtilityStoreCategory.findByIdAndDelete(legacyUtilities._id);
      }
      const oldRepairName = await UtilityStoreCategory.findOne({ name: 'Repair & Maintenance Head Office' });
      if (oldRepairName && !(await UtilityStoreCategory.findOne({ name: 'Repair & Maintenance' }))) {
        oldRepairName.name = 'Repair & Maintenance';
        await oldRepairName.save();
      }

      const CATEGORY_SEED = [
        { name: 'Electricity', utilityType: 'Electricity', sortOrder: 1, expenseAccount: def6200._id, meterCount: 3 },
        { name: 'Gas', utilityType: 'Gas', sortOrder: 2, expenseAccount: def6200._id, meterCount: 3 },
        { name: 'Water', utilityType: 'Water', sortOrder: 3, expenseAccount: def6200._id, meterCount: 3 },
        { name: 'Vehicles', utilityType: 'Other', sortOrder: 4, expenseAccount: acc6300._id, meterCount: 3 },
        { name: 'Rent', utilityType: 'Rent', sortOrder: 5, expenseAccount: acc6100._id, meterCount: 1, site: 'Head Office' },
        { name: 'Repair & Maintenance', utilityType: 'Maintenance', sortOrder: 6, expenseAccount: acc6400._id, meterCount: 2, site: 'Head Office' }
      ];

      const METER_NAMES = ['Meter 1', 'Meter 2', 'Meter 3'];
      let categoriesCreated = 0;
      let itemsCreated = 0;

      for (const catDef of CATEGORY_SEED) {
        let category = await UtilityStoreCategory.findOne({ name: catDef.name });
        if (!category) {
          category = await UtilityStoreCategory.create({
            name: catDef.name,
            description: '',
            sortOrder: catDef.sortOrder,
            createdBy: actorId,
            updatedBy: actorId
          });
          categoriesCreated += 1;
        }

        const meterCount = Math.min(Math.max(catDef.meterCount || 3, 1), 3);
        for (let i = 0; i < meterCount; i += 1) {
          const itemName = METER_NAMES[i];
          const meterNumber = String(i + 1);
          const exists = await UtilityStoreItem.findOne({ category: category._id, name: itemName });
          if (!exists) {
            await UtilityStoreItem.create({
              category: category._id,
              name: itemName,
              utilityType: catDef.utilityType,
              meterNumber,
              location: catDef.site || 'Main Office',
              site: catDef.site || '',
              expenseAccount: catDef.expenseAccount,
              defaultAmount: 0,
              description: '',
              sortOrder: i + 1,
              createdBy: actorId,
              updatedBy: actorId
            });
            itemsCreated += 1;
          }
        }
      }

      res.json({
        success: true,
        message: `Defaults ready. ${categoriesCreated} category(ies) and ${itemsCreated} meter item(s) added.`,
        data: { categoriesCreated, itemsCreated }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

module.exports = router;
