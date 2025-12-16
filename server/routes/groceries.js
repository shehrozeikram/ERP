const express = require('express');
const router = express.Router();
const GroceryItem = require('../models/hr/GroceryItem');
const Supplier = require('../models/hr/Supplier');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

const generateNextItemId = async () => {
  const lastItem = await GroceryItem.findOne({ itemId: { $exists: true } })
    .sort({ createdAt: -1 })
    .select('itemId');

  let nextNumber = 1;
  if (lastItem?.itemId) {
    const match = lastItem.itemId.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  let candidate;
  let exists = true;
  while (exists) {
    candidate = `GR${String(nextNumber).padStart(4, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    exists = await GroceryItem.exists({ itemId: candidate });
    nextNumber += exists ? 1 : 0;
  }

  return candidate;
};

// GET /api/groceries - Get all grocery items with simple filtering
router.get('/', permissions.checkSubRolePermission('admin', 'grocery_management', 'read'), async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { itemId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await GroceryItem.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Recalculate and update status for each item if needed
    const updatePromises = items.map(async (item) => {
      if (item && item.calculateStatus) {
        const calculatedStatus = item.calculateStatus();
        if (item.status !== calculatedStatus) {
          item.status = calculatedStatus;
          // Update status in database without triggering full save
          await GroceryItem.findByIdAndUpdate(
            item._id,
            { status: calculatedStatus },
            { runValidators: false, new: false }
          );
        }
      }
    });
    await Promise.all(updatePromises);

    const total = await GroceryItem.countDocuments(filter);

    res.json({
      success: true,
      data: items,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching grocery items',
      error: error.message
    });
  }
});

// GET /api/groceries/low-stock - Get low stock items
router.get('/low-stock', permissions.checkSubRolePermission('admin', 'grocery_management', 'read'), async (req, res) => {
  try {
    const items = await GroceryItem.find({ status: 'Low Stock' })
      .sort({ currentStock: 1 });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock items',
      error: error.message
    });
  }
});

// GET /api/groceries/expired - Get expired items
router.get('/expired', permissions.checkSubRolePermission('admin', 'grocery_management', 'read'), async (req, res) => {
  try {
    const items = await GroceryItem.find({ 
      status: 'Expired',
      expiryDate: { $lt: new Date() }
    })
      .sort({ expiryDate: 1 });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching expired items',
      error: error.message
    });
  }
});

// GET /api/groceries/:id - Get single grocery item
router.get('/:id', permissions.checkSubRolePermission('admin', 'grocery_management', 'read'), async (req, res) => {
  try {
    const item = await GroceryItem.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Grocery item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching grocery item',
      error: error.message
    });
  }
});

// POST /api/groceries - Create new grocery item
router.post('/', permissions.checkSubRolePermission('admin', 'grocery_management', 'create'), async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      createdBy: req.user._id
    };

    if (!itemData.itemId) {
      itemData.itemId = await generateNextItemId();
    }
    if (!itemData.barcode) {
      delete itemData.barcode;
    }

    const item = new GroceryItem(itemData);
    await item.save();

    const populatedItem = await GroceryItem.findById(item._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Grocery item created successfully',
      data: populatedItem
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item ID or Barcode already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating grocery item',
      error: error.message
    });
  }
});

// PUT /api/groceries/:id - Update grocery item
router.put('/:id', permissions.checkSubRolePermission('admin', 'grocery_management', 'update'), async (req, res) => {
  try {
    const item = await GroceryItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Grocery item not found'
      });
    }

    res.json({
      success: true,
      message: 'Grocery item updated successfully',
      data: item
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Item ID or Barcode already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating grocery item',
      error: error.message
    });
  }
});

// PUT /api/groceries/:id/stock - Update stock level
router.put('/:id/stock', permissions.checkSubRolePermission('admin', 'grocery_management', 'update'), async (req, res) => {
  try {
    const { currentStock, operation } = req.body; // operation: 'add', 'subtract', 'set'

    const item = await GroceryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Grocery item not found'
      });
    }

    let newStock = item.currentStock;
    if (operation === 'add') {
      newStock += currentStock;
    } else if (operation === 'subtract') {
      newStock -= currentStock;
    } else if (operation === 'set') {
      newStock = currentStock;
    }

    item.currentStock = Math.max(0, newStock);
    await item.save();

    const populatedItem = await GroceryItem.findById(item._id)
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: populatedItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating stock',
      error: error.message
    });
  }
});

// DELETE /api/groceries/:id - Delete grocery item
router.delete('/:id', permissions.checkSubRolePermission('admin', 'grocery_management', 'delete'), async (req, res) => {
  try {
    const item = await GroceryItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Grocery item not found'
      });
    }

    res.json({
      success: true,
      message: 'Grocery item deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting grocery item',
      error: error.message
    });
  }
});

module.exports = router;
