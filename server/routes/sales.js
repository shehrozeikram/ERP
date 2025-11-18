const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const SalesOrder = require('../models/sales/SalesOrder');
const SalesCustomer = require('../models/sales/SalesCustomer');
const SalesProduct = require('../models/sales/SalesProduct');
const financeIntegrationService = require('../services/financeIntegrationService');

const router = express.Router();
const SALES_ROLES = ['super_admin', 'admin', 'sales_manager', 'sales_rep'];

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
};

const parseDateRange = (start, end, field = 'orderDate') => {
  const filter = {};
  if (start || end) {
    filter[field] = {};
    if (start) filter[field].$gte = new Date(start);
    if (end) filter[field].$lte = new Date(end);
  }
  return filter;
};

const shouldPostToFinance = (status) => ['fulfilled', 'completed', 'closed_won'].includes(status);

const buildOrderItems = async (items = []) => {
  const mapped = [];
  for (const item of items) {
    let productDoc = null;
    if (item.product) {
      productDoc = await SalesProduct.findById(item.product);
    }

    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const unitPrice = item.unitPrice ?? productDoc?.unitPrice ?? 0;
    const discount = item.discount || 0;
    const total = Number(((unitPrice * quantity) - discount).toFixed(2));

    mapped.push({
      product: productDoc?._id || (mongoose.Types.ObjectId.isValid(item.product) ? item.product : undefined),
      productName: item.productName || productDoc?.name || 'Custom Item',
      sku: item.sku || productDoc?.sku,
      unitPrice,
      quantity,
      discount,
      total
    });
  }
  return mapped;
};

// =====================
// Dashboard & Reports
// =====================
router.get('/dashboard',
  authorize(...SALES_ROLES),
  asyncHandler(async (_req, res) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      orderCount,
      customerCount,
      productCount,
      revenueAgg,
      monthlyTrend,
      pipelineStats,
      topProducts,
      recentOrders
    ] = await Promise.all([
      SalesOrder.countDocuments(),
      SalesCustomer.countDocuments(),
      SalesProduct.countDocuments(),
      SalesOrder.aggregate([
        { $match: { status: { $in: ['fulfilled', 'completed', 'closed_won'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      SalesOrder.aggregate([
        {
          $match: {
            orderDate: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 5))
            }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$orderDate' } },
            amount: { $sum: '$totalAmount' }
          }
        },
        { $sort: { '_id': 1 } }
      ]),
      SalesOrder.aggregate([
        { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$totalAmount' } } },
        { $sort: { count: -1 } }
      ]),
      SalesOrder.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productName',
            revenue: { $sum: '$items.total' },
            quantity: { $sum: '$items.quantity' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ]),
      SalesOrder.find().populate('customer', 'name company status')
        .sort({ createdAt: -1 }).limit(5)
    ]);

    const newCustomers = await SalesCustomer.countDocuments({ createdAt: { $gte: startOfMonth } });

    res.json({
      success: true,
      data: {
        totals: {
          orders: orderCount,
          customers: customerCount,
          products: productCount,
          revenue: revenueAgg[0]?.total || 0,
          newCustomers
        },
        revenueTrend: monthlyTrend.map(row => ({ month: row._id, amount: row.amount })),
        pipeline: pipelineStats.map(stage => ({
          stage: stage._id,
          deals: stage.count,
          value: stage.value
        })),
        topProducts: topProducts.map(prod => ({
          name: prod._id,
          revenue: prod.revenue,
          quantity: prod.quantity
        })),
        recentOrders
      }
    });
  })
);

router.get('/reports',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateFilter = parseDateRange(startDate, endDate);

    const matchStage = Object.keys(dateFilter).length ? { ...dateFilter } : {};

    const [summary, byStatus, byStage, topCustomers] = await Promise.all([
      SalesOrder.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            averageDealSize: { $avg: '$totalAmount' },
            deals: { $sum: 1 },
            taxes: { $sum: '$taxAmount' }
          }
        }
      ]),
      SalesOrder.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
        { $sort: { revenue: -1 } }
      ]),
      SalesOrder.aggregate([
        { $match: matchStage },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      SalesOrder.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$customer',
            revenue: { $sum: '$totalAmount' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'salescustomers',
            localField: '_id',
            foreignField: '_id',
            as: 'customer'
          }
        },
        { $unwind: '$customer' }
      ])
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || { totalRevenue: 0, averageDealSize: 0, deals: 0, taxes: 0 },
        byStatus,
        byStage,
        topCustomers
      }
    });
  })
);

// =====================
// Customers CRUD
// =====================
router.get('/customers',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      search
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const [customers, total] = await Promise.all([
      SalesCustomer.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      SalesCustomer.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalCount: total,
          totalPages: Math.ceil(total / limitNumber)
        }
      }
    });
  })
);

router.post('/customers',
  authorize(...SALES_ROLES),
  [
    body('name').notEmpty().withMessage('Customer name is required'),
    body('email').optional().isEmail().withMessage('Email must be valid')
  ],
  asyncHandler(async (req, res) => {
    const errorResponse = handleValidationErrors(req, res);
    if (errorResponse) return errorResponse;

    const customer = await SalesCustomer.create({
      ...req.body,
      owner: req.user?._id
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });
  })
);

router.get('/customers/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const customer = await SalesCustomer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const orders = await SalesOrder.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber totalAmount status stage createdAt');

    res.json({
      success: true,
      data: {
        customer,
        recentOrders: orders
      }
    });
  })
);

router.put('/customers/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const customer = await SalesCustomer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
    });
  })
);

router.delete('/customers/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const existingOrder = await SalesOrder.findOne({ customer: req.params.id });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with active orders'
      });
    }

    const deleted = await SalesCustomer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  })
);

// =====================
// Products CRUD
// =====================
router.get('/products',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const [products, total] = await Promise.all([
      SalesProduct.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      SalesProduct.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalCount: total,
          totalPages: Math.ceil(total / limitNumber)
        }
      }
    });
  })
);

router.post('/products',
  authorize(...SALES_ROLES),
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('sku').notEmpty().withMessage('SKU is required'),
    body('unitPrice').isFloat({ gt: 0 }).withMessage('Unit price must be greater than zero')
  ],
  asyncHandler(async (req, res) => {
    const errorResponse = handleValidationErrors(req, res);
    if (errorResponse) return errorResponse;

    const product = await SalesProduct.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  })
);

router.put('/products/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const product = await SalesProduct.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  })
);

router.delete('/products/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const existingOrder = await SalesOrder.findOne({ 'items.product': req.params.id });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete product that is referenced by sales orders'
      });
    }

    const deleted = await SalesProduct.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  })
);

// =====================
// Orders CRUD
// =====================
router.get('/orders',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      stage,
      customer,
      search,
      startDate,
      endDate
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (stage) filter.stage = stage;
    if (customer) filter.customer = customer;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    Object.assign(filter, parseDateRange(startDate, endDate));

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const [orders, total] = await Promise.all([
      SalesOrder.find(filter)
        .populate('customer', 'name company status')
        .sort({ orderDate: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      SalesOrder.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          totalCount: total,
          totalPages: Math.ceil(total / limitNumber)
        }
      }
    });
  })
);

router.post('/orders',
  authorize(...SALES_ROLES),
  [
    body('customer').isMongoId().withMessage('Customer is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one line item is required'),
    body('items.*.quantity').optional().isInt({ gt: 0 }).withMessage('Quantity must be greater than zero'),
    body('items.*.unitPrice').optional().isFloat({ gt: 0 }).withMessage('Unit price must be greater than zero')
  ],
  asyncHandler(async (req, res) => {
    const errorResponse = handleValidationErrors(req, res);
    if (errorResponse) return errorResponse;

    const customer = await SalesCustomer.findById(req.body.customer);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const items = await buildOrderItems(req.body.items || []);

    const order = await SalesOrder.create({
      ...req.body,
      items,
      assignedTo: req.user?._id
    });

    if (shouldPostToFinance(order.status)) {
      try {
        await financeIntegrationService.postSalesRevenue(order, req.user);
      } catch (error) {
        console.error('Failed to sync sales order with finance module:', error.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Sales order created successfully',
      data: await order.populate('customer', 'name company status')
    });
  })
);

router.get('/orders/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const order = await SalesOrder.findById(req.params.id)
      .populate('customer', 'name company email phone status')
      .populate('items.product', 'name sku unitPrice status');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales order not found' });
    }

    res.json({ success: true, data: order });
  })
);

router.put('/orders/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales order not found' });
    }

    if (req.body.customer) {
      const customer = await SalesCustomer.findById(req.body.customer);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      order.customer = customer._id;
    }

    if (req.body.items) {
      order.items = await buildOrderItems(req.body.items);
    }

    [
      'status', 'stage', 'orderDate', 'dueDate', 'discount',
      'taxRate', 'shippingAmount', 'paymentStatus', 'notes'
    ].forEach(field => {
      if (req.body[field] !== undefined) {
        order[field] = req.body[field];
      }
    });

    await order.save();

    if (shouldPostToFinance(order.status)) {
      try {
        await financeIntegrationService.postSalesRevenue(order, req.user);
      } catch (error) {
        console.error('Failed to sync sales order with finance module:', error.message);
      }
    }

    const populated = await order.populate('customer', 'name company status');
    res.json({
      success: true,
      message: 'Sales order updated successfully',
      data: populated
    });
  })
);

router.patch('/orders/:id/status',
  authorize(...SALES_ROLES),
  [
    body('status').optional().isString(),
    body('stage').optional().isString(),
    body('paymentStatus').optional().isString()
  ],
  asyncHandler(async (req, res) => {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales order not found' });
    }

    ['status', 'stage', 'paymentStatus'].forEach(field => {
      if (req.body[field]) {
        order[field] = req.body[field];
      }
    });

    await order.save();

    if (shouldPostToFinance(order.status)) {
      try {
        await financeIntegrationService.postSalesRevenue(order, req.user);
      } catch (error) {
        console.error('Failed to sync sales order with finance module:', error.message);
      }
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: order
    });
  })
);

router.delete('/orders/:id',
  authorize(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const deleted = await SalesOrder.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Sales order not found' });
    }

    res.json({ success: true, message: 'Sales order deleted successfully' });
  })
);

module.exports = router;
