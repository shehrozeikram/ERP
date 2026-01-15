const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const dayjs = require('dayjs');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const Supplier = require('../models/hr/Supplier');
const FinanceHelper = require('../utils/financeHelper');
const Inventory = require('../models/procurement/Inventory');
const User = require('../models/User');

console.log('✅ Procurement routes loaded successfully');

const router = express.Router();

// ==================== PURCHASE ORDERS ROUTES ====================

// @route   GET /api/procurement/purchase-orders
// @desc    Get all purchase orders with pagination and filters
// @access  Private (Procurement and Admin)
router.get('/purchase-orders', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    console.log('📦 GET /purchase-orders - User:', req.user?.role);
    
    const { 
      page = 1, 
      limit = 10, 
      status, 
      priority,
      vendor,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (vendor) query.vendor = vendor;

    // Date range filter
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'items.description': { $regex: search, $options: 'i' } }
      ];
    }

    console.log('Query filters:', query);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    try {
      const purchaseOrders = await PurchaseOrder.find(query)
        .populate('vendor', 'name email phone contactPerson')
        .populate('createdBy', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const total = await PurchaseOrder.countDocuments(query);

      console.log(`Found ${purchaseOrders.length} purchase orders out of ${total} total`);

      res.json({
        success: true,
        data: {
          purchaseOrders,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      throw error;
    }
  })
);

// @route   GET /api/procurement/purchase-orders/statistics
// @desc    Get purchase orders statistics
// @access  Private (Procurement and Admin)
router.get('/purchase-orders/statistics', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    console.log('📊 GET /purchase-orders/statistics - User:', req.user?.role);
    
    try {
      const stats = await PurchaseOrder.getStatistics();
      
      // Get recent orders
      const recentOrders = await PurchaseOrder.find()
        .populate('vendor', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber vendor status totalAmount orderDate');

      console.log('Statistics loaded successfully');

      res.json({
        success: true,
        data: {
          ...stats,
          recentOrders
        }
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Return empty stats instead of erroring
      res.json({
        success: true,
        data: {
          totalOrders: 0,
          totalValue: 0,
          byStatus: [],
          recentOrders: []
        }
      });
    }
  })
);

// @route   GET /api/procurement/purchase-orders/:id
// @desc    Get purchase order by ID
// @access  Private (Procurement and Admin)
router.get('/purchase-orders/:id', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate('vendor', 'name email phone contact address')
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.json({
      success: true,
      data: purchaseOrder
    });
  })
);

// @route   POST /api/procurement/purchase-orders
// @desc    Create new purchase order
// @access  Private (Procurement and Admin)
router.post('/purchase-orders', [
  body('vendor').isMongoId().withMessage('Valid vendor ID is required'),
  body('orderDate').isDate().withMessage('Valid order date is required'),
  body('expectedDeliveryDate').isDate().withMessage('Valid expected delivery date is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').trim().notEmpty().withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Item quantity must be greater than 0'),
  body('items.*.unit').trim().notEmpty().withMessage('Item unit is required'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Verify vendor exists
  const vendor = await Supplier.findById(req.body.vendor);
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor not found'
    });
  }

  // Calculate item amounts
  const items = req.body.items.map(item => ({
    ...item,
    amount: (item.quantity * item.unitPrice) - (item.discount || 0) + ((item.quantity * item.unitPrice - (item.discount || 0)) * (item.taxRate || 0) / 100)
  }));

  const purchaseOrder = new PurchaseOrder({
    ...req.body,
    items,
    createdBy: req.user.id
  });

  await purchaseOrder.save();

  const populatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    message: 'Purchase order created successfully',
    data: populatedOrder
  });
}));

// @route   PUT /api/procurement/purchase-orders/:id
// @desc    Update purchase order
// @access  Private (Procurement and Admin)
router.put('/purchase-orders/:id', [
  body('vendor').optional().isMongoId().withMessage('Valid vendor ID is required'),
  body('orderDate').optional().isDate().withMessage('Valid order date is required'),
  body('expectedDeliveryDate').optional().isDate().withMessage('Valid expected delivery date is required'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const purchaseOrder = await PurchaseOrder.findById(req.params.id);
  if (!purchaseOrder) {
    return res.status(404).json({
      success: false,
      message: 'Purchase order not found'
    });
  }

  // Prevent editing approved or completed orders
  if (['Received', 'Cancelled'].includes(purchaseOrder.status) && req.body.status !== 'Cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Cannot edit completed or cancelled purchase orders'
    });
  }

  // If items are being updated, recalculate amounts
  if (req.body.items) {
    req.body.items = req.body.items.map(item => ({
      ...item,
      amount: (item.quantity * item.unitPrice) - (item.discount || 0) + ((item.quantity * item.unitPrice - (item.discount || 0)) * (item.taxRate || 0) / 100)
    }));
  }

  Object.assign(purchaseOrder, req.body);
  purchaseOrder.updatedBy = req.user.id;
  
  await purchaseOrder.save();

  const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName email');

  res.json({
    success: true,
    message: 'Purchase order updated successfully',
    data: updatedOrder
  });
}));

// @route   PUT /api/procurement/purchase-orders/:id/approve
// @desc    Approve purchase order
// @access  Private (Admin only)
router.put('/purchase-orders/:id/approve', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.status !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: 'Only pending purchase orders can be approved'
      });
    }

    purchaseOrder.status = 'Approved';
    purchaseOrder.approvedBy = req.user.id;
    purchaseOrder.approvedAt = new Date();
    
    await purchaseOrder.save();

    const updatedOrder = await PurchaseOrder.findById(purchaseOrder._id)
      .populate('vendor', 'name email phone')
      .populate('approvedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Purchase order approved successfully',
      data: updatedOrder
    });
  })
);

// @route   PUT /api/procurement/purchase-orders/:id/receive
// @desc    Mark items as received
// @access  Private (Procurement and Admin)
router.put('/purchase-orders/:id/receive', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
  
  if (!purchaseOrder) {
    return res.status(404).json({
      success: false,
      message: 'Purchase order not found'
    });
  }

  if (!['Approved', 'Ordered', 'Partially Received'].includes(purchaseOrder.status)) {
    return res.status(400).json({
      success: false,
      message: 'Purchase order must be approved before receiving items'
    });
  }

  // Update received quantities
  req.body.items.forEach((receivedItem, index) => {
    if (purchaseOrder.items[index]) {
      purchaseOrder.items[index].receivedQuantity = receivedItem.receivedQuantity;
    }
  });

  purchaseOrder.receivedBy = req.user.id;
  purchaseOrder.receivedAt = new Date();
  purchaseOrder.updateReceivingStatus();
  
  await purchaseOrder.save();

  // If status is "Received", create Accounts Payable entry and post to GL
  if (purchaseOrder.status === 'Received') {
    try {
      const supplier = await Supplier.findById(purchaseOrder.vendor);
      await FinanceHelper.createAPFromBill({
        vendorName: supplier ? supplier.name : 'Unknown Supplier',
        vendorEmail: supplier ? supplier.email : '',
        vendorId: purchaseOrder.vendor,
        billNumber: `PO-${purchaseOrder.orderNumber}`,
        billDate: new Date(),
        dueDate: dayjs().add(30, 'day').toDate(),
        amount: purchaseOrder.totalAmount,
        department: 'procurement',
        module: 'procurement',
        referenceId: purchaseOrder._id,
        createdBy: req.user.id
      });
    } catch (apError) {
      console.error('❌ Error creating AP for received purchase order:', apError);
    }
  }

  res.json({
    success: true,
    message: purchaseOrder.status === 'Received' 
      ? 'Items received and Accounts Payable entry created' 
      : 'Receiving information updated successfully',
    data: purchaseOrder
  });
}));

// @route   DELETE /api/procurement/purchase-orders/:id
// @desc    Delete purchase order
// @access  Private (Admin only)
router.delete('/purchase-orders/:id', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Prevent deleting approved or received orders
    if (['Approved', 'Ordered', 'Partially Received', 'Received'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete approved or received purchase orders. Cancel instead.'
      });
    }

    await PurchaseOrder.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Purchase order deleted successfully'
    });
  })
);

// ==================== VENDORS ROUTES ====================

// @route   GET /api/procurement/vendors
// @desc    Get all vendors (suppliers)
// @access  Private (Procurement and Admin)
router.get('/vendors', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      search,
      status 
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { supplierId: { $regex: search, $options: 'i' } }
      ];
    }

    const vendors = await Supplier.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Supplier.countDocuments(query);

    res.json({
      success: true,
      data: {
        vendors,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/vendors/statistics
// @desc    Get vendor statistics
// @access  Private (Procurement and Admin)
router.get('/vendors/statistics', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const totalVendors = await Supplier.countDocuments();
    const activeVendors = await Supplier.countDocuments({ status: 'Active' });
    const inactiveVendors = await Supplier.countDocuments({ status: 'Inactive' });
    
    // Get payment terms breakdown
    const paymentTermsBreakdown = await Supplier.aggregate([
      {
        $group: {
          _id: '$paymentTerms',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalVendors,
        activeVendors,
        inactiveVendors,
        paymentTermsBreakdown
      }
    });
  })
);

// @route   GET /api/procurement/vendors/:id
// @desc    Get vendor by ID
// @access  Private (Procurement and Admin)
router.get('/vendors/:id', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const vendor = await Supplier.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      data: vendor
    });
  })
);

// @route   POST /api/procurement/vendors
// @desc    Create new vendor
// @access  Private (Procurement and Admin)
router.post('/vendors', [
  body('name').trim().notEmpty().withMessage('Vendor name is required'),
  body('contactPerson').trim().notEmpty().withMessage('Contact person is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('address').trim().notEmpty().withMessage('Address is required')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Generate supplierId
  const lastSupplier = await Supplier.findOne().sort({ supplierId: -1 });
  let newSupplierId = 'SUP-0001';
  
  if (lastSupplier && lastSupplier.supplierId) {
    const lastNum = parseInt(lastSupplier.supplierId.split('-')[1]);
    newSupplierId = `SUP-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const vendor = new Supplier({
    ...req.body,
    supplierId: newSupplierId,
    createdBy: req.user.id
  });

  await vendor.save();

  const populatedVendor = await Supplier.findById(vendor._id)
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Vendor created successfully',
    data: populatedVendor
  });
}));

// @route   PUT /api/procurement/vendors/:id
// @desc    Update vendor
// @access  Private (Procurement and Admin)
router.put('/vendors/:id', [
  body('name').optional().trim().notEmpty().withMessage('Vendor name is required'),
  body('contactPerson').optional().trim().notEmpty().withMessage('Contact person is required'),
  body('phone').optional().trim().notEmpty().withMessage('Phone is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('address').optional().trim().notEmpty().withMessage('Address is required')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const vendor = await Supplier.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName');

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor not found'
    });
  }

  res.json({
    success: true,
    message: 'Vendor updated successfully',
    data: vendor
  });
}));

// @route   DELETE /api/procurement/vendors/:id
// @desc    Delete vendor
// @access  Private (Admin only)
router.delete('/vendors/:id', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    // Check if vendor is used in any purchase orders
    const usedInPO = await PurchaseOrder.findOne({ vendor: req.params.id });
    
    if (usedInPO) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vendor that has associated purchase orders. Set status to Inactive instead.'
      });
    }

    const vendor = await Supplier.findByIdAndDelete(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  })
);

// ==================== INVENTORY ROUTES ====================

// @route   GET /api/procurement/inventory
// @desc    Get all inventory items
// @access  Private (Procurement and Admin)
router.get('/inventory', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      search,
      category,
      status,
      supplier
    } = req.query;

    const query = {};

    if (category) query.category = category;
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await Inventory.find(query)
      .populate('supplier', 'name contactPerson')
      .populate('createdBy', 'firstName lastName')
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Inventory.countDocuments(query);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/procurement/inventory/statistics
// @desc    Get inventory statistics
// @access  Private (Procurement and Admin)
router.get('/inventory/statistics', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const stats = await Inventory.getStatistics();
    
    // Get low stock items
    const lowStockItems = await Inventory.find({ status: 'Low Stock' })
      .limit(10)
      .select('name itemCode quantity minQuantity')
      .sort({ quantity: 1 });

    res.json({
      success: true,
      data: {
        ...stats,
        lowStockItems
      }
    });
  })
);

// @route   GET /api/procurement/inventory/:id
// @desc    Get inventory item by ID
// @access  Private (Procurement and Admin)
router.get('/inventory/:id', 
  authorize('super_admin', 'admin', 'procurement_manager'), 
  asyncHandler(async (req, res) => {
    const item = await Inventory.findById(req.params.id)
      .populate('supplier', 'name contactPerson email phone')
      .populate('createdBy', 'firstName lastName email')
      .populate('transactions.performedBy', 'firstName lastName');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  })
);

// @route   POST /api/procurement/inventory
// @desc    Create new inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory', [
  body('name').trim().notEmpty().withMessage('Item name is required'),
  body('category').isIn(['Raw Materials', 'Finished Goods', 'Office Supplies', 'Equipment', 'Consumables', 'Other']).withMessage('Valid category is required'),
  body('unit').trim().notEmpty().withMessage('Unit is required'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be non-negative'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Generate itemCode
  const lastItem = await Inventory.findOne().sort({ itemCode: -1 });
  let newItemCode = 'INV-0001';
  
  if (lastItem && lastItem.itemCode) {
    const lastNum = parseInt(lastItem.itemCode.split('-')[1]);
    newItemCode = `INV-${String(lastNum + 1).padStart(4, '0')}`;
  }

  const item = new Inventory({
    ...req.body,
    itemCode: newItemCode,
    createdBy: req.user.id,
    lastRestocked: new Date()
  });

  await item.save();

  const populatedItem = await Inventory.findById(item._id)
    .populate('supplier', 'name')
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Inventory item created successfully',
    data: populatedItem
  });
}));

// @route   PUT /api/procurement/inventory/:id
// @desc    Update inventory item
// @access  Private (Procurement and Admin)
router.put('/inventory/:id', [
  body('name').optional().trim().notEmpty().withMessage('Item name is required'),
  body('category').optional().isIn(['Raw Materials', 'Finished Goods', 'Office Supplies', 'Equipment', 'Consumables', 'Other']).withMessage('Valid category is required'),
  body('unit').optional().trim().notEmpty().withMessage('Unit is required'),
  body('unitPrice').optional().isFloat({ min: 0 }).withMessage('Unit price must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  Object.assign(item, req.body);
  item.updatedBy = req.user.id;
  await item.save();

  const updatedItem = await Inventory.findById(item._id)
    .populate('supplier', 'name')
    .populate('createdBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Inventory item updated successfully',
    data: updatedItem
  });
}));

// @route   POST /api/procurement/inventory/:id/add-stock
// @desc    Add stock to inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory/:id/add-stock', [
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  await item.addStock(
    req.body.quantity,
    req.body.reference || '',
    req.body.notes || '',
    req.user.id
  );

  res.json({
    success: true,
    message: 'Stock added successfully',
    data: item
  });
}));

// @route   POST /api/procurement/inventory/:id/remove-stock
// @desc    Remove stock from inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory/:id/remove-stock', [
  body('quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  try {
    await item.removeStock(
      req.body.quantity,
      req.body.reference || '',
      req.body.notes || '',
      req.user.id
    );

    res.json({
      success: true,
      message: 'Stock removed successfully',
      data: item
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}));

// @route   POST /api/procurement/inventory/:id/adjust-stock
// @desc    Adjust stock for inventory item
// @access  Private (Procurement and Admin)
router.post('/inventory/:id/adjust-stock', [
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be non-negative')
], authorize('super_admin', 'admin', 'procurement_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const item = await Inventory.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Inventory item not found'
    });
  }

  await item.adjustStock(
    req.body.quantity,
    req.body.reference || 'Manual Adjustment',
    req.body.notes || '',
    req.user.id
  );

  res.json({
    success: true,
    message: 'Stock adjusted successfully',
    data: item
  });
}));

// @route   DELETE /api/procurement/inventory/:id
// @desc    Delete inventory item
// @access  Private (Admin only)
router.delete('/inventory/:id', 
  authorize('super_admin', 'admin'), 
  asyncHandler(async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check if item has quantity
    if (item.quantity > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete item with existing stock. Adjust stock to zero first.'
      });
    }

    await Inventory.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  })
);

module.exports = router;
