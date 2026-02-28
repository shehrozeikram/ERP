const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Store = require('../models/procurement/Store');
const Inventory = require('../models/procurement/Inventory');
const StockTransaction = require('../models/procurement/StockTransaction');

const router = express.Router();

// ─── Validation helpers ────────────────────────────────────────────────────────

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
};

// ─── GET /api/stores ──────────────────────────────────────────────────────────
// List all stores. Query: ?type=main|sub&hierarchy=true&activeOnly=true
router.get('/',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { type, hierarchy, activeOnly = 'true', parent } = req.query;

    if (hierarchy === 'true') {
      const tree = await Store.getHierarchy();
      return res.json({ success: true, data: tree });
    }

    const query = {};
    if (type) query.type = type;
    if (activeOnly === 'true') query.isActive = true;
    if (parent) query.parent = parent;

    const stores = await Store.find(query)
      .populate('parent', 'name code')
      .populate('createdBy', 'firstName lastName')
      .sort({ type: 1, name: 1 })
      .lean();

    res.json({ success: true, data: stores, total: stores.length });
  })
);

// ─── GET /api/stores/barcode/:barcode ─────────────────────────────────────────
// Look up an inventory item by its barcode (for scanner input)
router.get('/barcode/:barcode',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const { barcode } = req.params;
    const item = await Inventory.findOne({ barcode: barcode.trim() })
      .select('_id itemCode name unit quantity unitPrice category barcode barcodeType location')
      .lean();

    if (!item) {
      return res.status(404).json({ success: false, message: 'No item found with this barcode' });
    }

    res.json({ success: true, data: item });
  })
);

// ─── GET /api/stores/:id ──────────────────────────────────────────────────────
// Get single store with children and flat location list
router.get('/:id',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const store = await Store.findById(req.params.id)
      .populate('parent', 'name code')
      .populate({ path: 'children', match: { isActive: true }, options: { sort: { name: 1 } } })
      .populate('createdBy', 'firstName lastName')
      .lean({ virtuals: true });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const flatLocations = Store.getFlatLocations(store);

    res.json({ success: true, data: { ...store, flatLocations } });
  })
);

// ─── GET /api/stores/:id/locations ───────────────────────────────────────────
// Get flat rack/shelf/bin list for a store (used by dropdowns)
router.get('/:id/locations',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const store = await Store.findById(req.params.id).select('racks').lean();
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const flatLocations = Store.getFlatLocations(store);
    res.json({ success: true, data: flatLocations });
  })
);

// ─── POST /api/stores ─────────────────────────────────────────────────────────
// Create a main store or sub-store
router.post('/',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('name').trim().notEmpty().withMessage('Store name is required'),
    body('type').isIn(['main', 'sub']).withMessage('Type must be main or sub'),
    body('parent').optional({ nullable: true }).isMongoId().withMessage('Invalid parent store ID')
  ],
  asyncHandler(async (req, res) => {
    if (handleValidation(req, res)) return;

    const { name, type, parent, description } = req.body;

    // Validate parent exists when type is sub
    if (type === 'sub') {
      if (!parent) {
        return res.status(400).json({ success: false, message: 'Sub-store requires a parent store' });
      }
      const parentStore = await Store.findById(parent);
      if (!parentStore) {
        return res.status(404).json({ success: false, message: 'Parent store not found' });
      }
      if (parentStore.type !== 'main') {
        return res.status(400).json({ success: false, message: 'Parent must be a main store' });
      }
    }

    const store = new Store({
      name,
      type,
      parent: type === 'sub' ? parent : null,
      description,
      createdBy: req.user.id
    });

    await store.save();
    await store.populate('parent', 'name code');

    res.status(201).json({ success: true, message: 'Store created successfully', data: store });
  })
);

// ─── PUT /api/stores/:id ──────────────────────────────────────────────────────
// Update store details
router.put('/:id',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('name').optional().trim().notEmpty().withMessage('Store name cannot be empty')
  ],
  asyncHandler(async (req, res) => {
    if (handleValidation(req, res)) return;

    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const { name, description, isActive } = req.body;
    if (name !== undefined) store.name = name;
    if (description !== undefined) store.description = description;
    if (isActive !== undefined) store.isActive = isActive;
    store.updatedBy = req.user.id;

    await store.save();
    res.json({ success: true, message: 'Store updated successfully', data: store });
  })
);

// ─── PUT /api/stores/:id/racks ────────────────────────────────────────────────
// Add or replace racks array for a store
router.put('/:id/racks',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('racks').isArray().withMessage('Racks must be an array')
  ],
  asyncHandler(async (req, res) => {
    if (handleValidation(req, res)) return;

    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    store.racks = req.body.racks;
    store.updatedBy = req.user.id;
    await store.save();

    res.json({ success: true, message: 'Racks updated successfully', data: store });
  })
);

// ─── POST /api/stores/:id/racks ───────────────────────────────────────────────
// Add a single rack to a store
router.post('/:id/racks',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('rackCode').trim().notEmpty().withMessage('Rack code is required')
  ],
  asyncHandler(async (req, res) => {
    if (handleValidation(req, res)) return;

    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const { rackCode, description } = req.body;
    const exists = store.racks.find(r => r.rackCode === rackCode);
    if (exists) {
      return res.status(409).json({ success: false, message: 'Rack code already exists in this store' });
    }

    store.racks.push({ rackCode, description: description || '', shelves: [] });
    store.updatedBy = req.user.id;
    await store.save();

    res.status(201).json({ success: true, message: 'Rack added successfully', data: store });
  })
);

// ─── POST /api/stores/:id/racks/:rackId/shelves ───────────────────────────────
// Add a shelf to a rack
router.post('/:id/racks/:rackId/shelves',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('shelfCode').trim().notEmpty().withMessage('Shelf code is required')
  ],
  asyncHandler(async (req, res) => {
    if (handleValidation(req, res)) return;

    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const rack = store.racks.id(req.params.rackId);
    if (!rack) {
      return res.status(404).json({ success: false, message: 'Rack not found' });
    }

    const { shelfCode, description } = req.body;
    const exists = rack.shelves.find(s => s.shelfCode === shelfCode);
    if (exists) {
      return res.status(409).json({ success: false, message: 'Shelf code already exists in this rack' });
    }

    rack.shelves.push({ shelfCode, description: description || '', bins: [] });
    store.updatedBy = req.user.id;
    await store.save();

    res.status(201).json({ success: true, message: 'Shelf added successfully', data: store });
  })
);

// ─── POST /api/stores/:id/racks/:rackId/shelves/:shelfId/bins ────────────────
// Add a bin to a shelf
router.post('/:id/racks/:rackId/shelves/:shelfId/bins',
  authorize('super_admin', 'admin', 'procurement_manager'),
  [
    body('binCode').trim().notEmpty().withMessage('Bin code is required')
  ],
  asyncHandler(async (req, res) => {
    if (handleValidation(req, res)) return;

    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const rack = store.racks.id(req.params.rackId);
    if (!rack) {
      return res.status(404).json({ success: false, message: 'Rack not found' });
    }

    const shelf = rack.shelves.id(req.params.shelfId);
    if (!shelf) {
      return res.status(404).json({ success: false, message: 'Shelf not found' });
    }

    const { binCode, description } = req.body;
    const exists = shelf.bins.find(b => b.binCode === binCode);
    if (exists) {
      return res.status(409).json({ success: false, message: 'Bin code already exists in this shelf' });
    }

    shelf.bins.push({ binCode, description: description || '' });
    store.updatedBy = req.user.id;
    await store.save();

    res.status(201).json({ success: true, message: 'Bin added successfully', data: store });
  })
);

// ─── DELETE /api/stores/:id ───────────────────────────────────────────────────
// Soft delete a store (set isActive = false)
router.delete('/:id',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    // Check if store has sub-stores
    if (store.type === 'main') {
      const subCount = await Store.countDocuments({ parent: store._id, isActive: true });
      if (subCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deactivate: ${subCount} active sub-store(s) exist. Deactivate sub-stores first.`
        });
      }
    }

    store.isActive = false;
    store.updatedBy = req.user.id;
    await store.save();

    res.json({ success: true, message: 'Store deactivated successfully' });
  })
);

// ─── GET /api/stores/:id/stock-summary ───────────────────────────────────────
// Get stock summary for a store (total items, total qty per item)
router.get('/:id/stock-summary',
  authorize('super_admin', 'admin', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const summary = await StockTransaction.aggregate([
      { $match: { store: store._id } },
      {
        $group: {
          _id: { item: '$item', project: '$project' },
          itemCode: { $first: '$itemCode' },
          itemName: { $first: '$itemName' },
          unit: { $first: '$unit' },
          balance: { $sum: '$quantity' }
        }
      },
      { $match: { balance: { $gt: 0 } } },
      { $sort: { itemCode: 1 } }
    ]);

    res.json({ success: true, data: summary, store: { _id: store._id, name: store.name, code: store.code } });
  })
);

module.exports = router;
