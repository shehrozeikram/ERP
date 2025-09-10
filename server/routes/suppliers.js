const express = require('express');
const router = express.Router();
const Supplier = require('../models/hr/Supplier');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/suppliers - Get all suppliers
router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { supplierId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } }
      ];
    }

    const suppliers = await Supplier.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Supplier.countDocuments(filter);

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching suppliers',
      error: error.message
    });
  }
});

// GET /api/suppliers/active - Get active suppliers only
router.get('/active', async (req, res) => {
  try {
    const suppliers = await Supplier.find({ status: 'Active' })
      .select('supplierId name contactPerson phone email')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active suppliers',
      error: error.message
    });
  }
});

// GET /api/suppliers/:id - Get single supplier
router.get('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier',
      error: error.message
    });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', permissions.checkPermission('supplier_create'), async (req, res) => {
  try {
    const supplierData = {
      ...req.body,
      createdBy: req.user._id
    };

    const supplier = new Supplier(supplierData);
    await supplier.save();

    const populatedSupplier = await Supplier.findById(supplier._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: populatedSupplier
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating supplier',
      error: error.message
    });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', permissions.checkPermission('supplier_update'), async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating supplier',
      error: error.message
    });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', permissions.checkPermission('supplier_delete'), async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting supplier',
      error: error.message
    });
  }
});

module.exports = router;
