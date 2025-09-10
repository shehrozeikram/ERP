const express = require('express');
const router = express.Router();
const GroceryItem = require('../models/hr/GroceryItem');
const Supplier = require('../models/hr/Supplier');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/groceries - Get all grocery items with simple filtering
router.get('/', async (req, res) => {
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
      .populate('supplier', 'supplierId name contactPerson')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
router.get('/low-stock', async (req, res) => {
  try {
    const items = await GroceryItem.find({ status: 'Low Stock' })
      .populate('supplier', 'supplierId name contactPerson')
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
router.get('/expired', async (req, res) => {
  try {
    const items = await GroceryItem.find({ 
      status: 'Expired',
      expiryDate: { $lt: new Date() }
    })
      .populate('supplier', 'supplierId name contactPerson')
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
router.get('/:id', async (req, res) => {
  try {
    const item = await GroceryItem.findById(req.params.id)
      .populate('supplier', 'supplierId name contactPerson phone email')
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
router.post('/', permissions.checkPermission('grocery_create'), async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      createdBy: req.user._id
    };

    const item = new GroceryItem(itemData);
    await item.save();

    const populatedItem = await GroceryItem.findById(item._id)
      .populate('supplier', 'supplierId name contactPerson')
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
router.put('/:id', permissions.checkPermission('grocery_update'), async (req, res) => {
  try {
    const item = await GroceryItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('supplier', 'supplierId name contactPerson')
     .populate('createdBy', 'firstName lastName');

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
router.put('/:id/stock', permissions.checkPermission('grocery_update'), async (req, res) => {
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
      .populate('supplier', 'supplierId name contactPerson')
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
router.delete('/:id', permissions.checkPermission('grocery_delete'), async (req, res) => {
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
