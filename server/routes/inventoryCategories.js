const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const InventoryCategory = require('../models/procurement/InventoryCategory');
const Inventory = require('../models/procurement/Inventory');
const {
  applyStandardInventoryAccountMappings,
  resolveStandardInventoryAccountIds
} = require('../utils/inventoryStandardAccountMap');

const router = express.Router();

function noStoreJson(res, payload) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json(payload);
}

// ─── GET all categories ──────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { isActive = 'true', search } = req.query;
  const query = {};
  if (isActive !== 'all') {
    // $ne: false matches true, null, and legacy docs with no isActive field (Mongoose default only applies on save)
    if (isActive === 'true' || isActive === true) {
      query.isActive = { $ne: false };
    } else {
      query.isActive = false;
    }
  }
  if (search) query.name = { $regex: search, $options: 'i' };

  const categories = await InventoryCategory.find(query)
    .populate('stockValuationAccount', 'accountNumber name type')
    .populate('stockInputAccount',     'accountNumber name type')
    .populate('stockOutputAccount',    'accountNumber name type')
    .populate('purchaseAccount',       'accountNumber name type')
    .populate('salesAccount',          'accountNumber name type')
    .populate('createdBy', 'firstName lastName')
    .sort({ name: 1 });

  noStoreJson(res, { success: true, data: categories });
}));

// ─── GET single category ─────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const cat = await InventoryCategory.findById(req.params.id)
    .populate('stockValuationAccount', 'accountNumber name type')
    .populate('stockInputAccount',     'accountNumber name type')
    .populate('stockOutputAccount',    'accountNumber name type')
    .populate('purchaseAccount',       'accountNumber name type')
    .populate('salesAccount',          'accountNumber name type');
  if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
  noStoreJson(res, { success: true, data: cat });
}));

// ─── CREATE category ─────────────────────────────────────────────────────────
router.post('/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const {
      name, description,
      stockValuationAccount, stockInputAccount, stockOutputAccount,
      purchaseAccount, salesAccount
    } = req.body;

    const cat = await InventoryCategory.create({
      name,
      description,
      stockValuationAccount: stockValuationAccount || undefined,
      stockInputAccount:     stockInputAccount     || undefined,
      stockOutputAccount:    stockOutputAccount    || undefined,
      purchaseAccount:       purchaseAccount       || undefined,
      salesAccount:          salesAccount          || undefined,
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, data: cat, message: 'Inventory category created successfully' });
  })
);

// ─── UPDATE category ─────────────────────────────────────────────────────────
router.put('/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const cat = await InventoryCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });

    const fields = [
      'name', 'description', 'isActive',
      'stockValuationAccount', 'stockInputAccount', 'stockOutputAccount',
      'purchaseAccount', 'salesAccount'
    ];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        cat[f] = req.body[f] || (f.endsWith('Account') ? undefined : req.body[f]);
      }
    }
    cat.updatedBy = req.user._id;
    await cat.save();

    const updated = await InventoryCategory.findById(cat._id)
      .populate('stockValuationAccount', 'accountNumber name type')
      .populate('stockInputAccount',     'accountNumber name type')
      .populate('stockOutputAccount',    'accountNumber name type')
      .populate('purchaseAccount',       'accountNumber name type')
      .populate('salesAccount',          'accountNumber name type');

    res.json({ success: true, data: updated, message: 'Category updated successfully' });
  })
);

// ─── DELETE category ─────────────────────────────────────────────────────────
router.delete('/:id',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const cat = await InventoryCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });

    const usedCount = await Inventory.countDocuments({ inventoryCategory: cat._id });
    if (usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${usedCount} inventory item(s) belong to this category. Reassign them first.`
      });
    }

    await cat.deleteOne();
    res.json({ success: true, message: 'Category deleted successfully' });
  })
);

// ─── SEED default categories ─────────────────────────────────────────────────
router.post('/seed/defaults',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const ids = await resolveStandardInventoryAccountIds();
    const inv = ids.stockValuationAccount;
    const grni = ids.stockInputAccount;
    const cogs = ids.stockOutputAccount;
    const exp = ids.purchaseAccount;
    const rev = ids.salesAccount;

    const defaults = [
      { name: 'General',          description: 'Default category for all items' },
      { name: 'Raw Materials',    description: 'Materials used in production or construction' },
      { name: 'Office Supplies',  description: 'Stationery and consumables' },
      { name: 'Equipment',        description: 'Machinery, tools and equipment' },
      { name: 'IT Equipment',     description: 'Computers, servers, networking devices' },
      { name: 'Civil Materials',  description: 'Bricks, cement, steel and construction materials' },
      { name: 'Electrical',       description: 'Cables, panels and electrical components' },
      { name: 'Consumables',      description: 'Items used up in operations' }
    ];

    const results = [];
    for (const d of defaults) {
      const exists = await InventoryCategory.findOne({ name: d.name });
      if (!exists) {
        const cat = await InventoryCategory.create({
          ...d,
          stockValuationAccount: inv  || undefined,
          stockInputAccount:     grni || undefined,
          stockOutputAccount:    cogs || undefined,
          purchaseAccount:       exp  || undefined,
          salesAccount:          rev  || undefined,
          createdBy: req.user._id
        });
        results.push({ action: 'created', name: d.name });
      } else {
        results.push({ action: 'exists', name: d.name });
      }
    }

    res.json({ success: true, message: 'Default categories seeded', results });
  })
);

// ─── Apply standard chart accounts to ALL categories + align inventory items ──
// Perpetual inventory: same 1100 / 2100 / 5000 pool for every category unless you edit manually after.
router.post('/apply-standard-accounts',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const linkInventoryItems = req.body.linkInventoryItems !== false;
    const clearItemOverrides = req.body.clearItemOverrides !== false;

    try {
      const data = await applyStandardInventoryAccountMappings({
        linkInventoryItems,
        clearItemOverrides
      });
      res.json({
        success: true,
        message: 'Standard inventory accounts applied across categories (and items where requested).',
        data
      });
    } catch (e) {
      if (e.message === 'MISSING_ACCOUNTS') {
        return res.status(400).json({
          success: false,
          message:
            'One or more standard accounts are missing from the chart. Create them or run POST /api/finance/accounts/ensure-defaults, then retry.',
          missingRoles: e.missingRoles
        });
      }
      throw e;
    }
  })
);

module.exports = router;
