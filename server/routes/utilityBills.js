const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const UtilityBill = require('../models/hr/UtilityBill');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/utility-bills');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bill-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Apply authentication middleware
router.use(authMiddleware);

// Get all utility bills with optional filters
router.get('/', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const { 
      search, 
      utilityType, 
      status, 
      provider,
      location,
      page = 1, 
      limit = 10 
    } = req.query;

    // Build query
    const query = {};
    
    if (utilityType) query.utilityType = utilityType;
    if (status) query.status = status;
    if (provider) query.provider = { $regex: provider, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population
    const bills = await UtilityBill.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ billDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UtilityBill.countDocuments(query);

    // Filter by search term if provided
    let filteredBills = bills;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBills = bills.filter(bill => 
        bill.billId?.toLowerCase().includes(searchLower) ||
        bill.provider?.toLowerCase().includes(searchLower) ||
        bill.accountNumber?.toLowerCase().includes(searchLower) ||
        bill.description?.toLowerCase().includes(searchLower) ||
        bill.location?.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: filteredBills,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching utility bills:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch utility bills' });
  }
});

// Get utility bills by type
router.get('/by-type/:utilityType', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const { utilityType } = req.params;
    const { status = 'Pending' } = req.query;

    const query = { 
      utilityType,
      status 
    };

    const bills = await UtilityBill.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ billDate: -1 });

    res.json({
      success: true,
      data: bills,
      count: bills.length,
      utilityType,
      status
    });

  } catch (error) {
    console.error('Error fetching utility bills by type:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch utility bills by type',
      error: error.message 
    });
  }
});

// Get utility bills summary by type
router.get('/summary', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const summary = await UtilityBill.aggregate([
      {
        $group: {
          _id: '$utilityType',
          total: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          paidAmount: { $sum: '$paidAmount' },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
          },
          paid: {
            $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] }
          },
          overdue: {
            $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] }
          },
          partial: {
            $sum: { $cond: [{ $eq: ['$status', 'Partial'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get monthly totals
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const monthlySummary = await UtilityBill.aggregate([
      {
        $match: {
          billDate: { $gte: currentMonth, $lt: nextMonth }
        }
      },
      {
        $group: {
          _id: null,
          monthlyTotal: { $sum: '$amount' },
          monthlyPaid: { $sum: '$paidAmount' },
          monthlyBills: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byType: summary,
        monthly: monthlySummary[0] || { monthlyTotal: 0, monthlyPaid: 0, monthlyBills: 0 }
      }
    });

  } catch (error) {
    console.error('Error fetching utility bills summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch utility bills summary',
      error: error.message 
    });
  }
});

// Get overdue bills
router.get('/overdue', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const bills = await UtilityBill.find({ 
      status: 'Overdue',
      dueDate: { $lt: new Date() }
    })
      .populate('createdBy', 'firstName lastName')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching overdue bills:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overdue bills',
      error: error.message
    });
  }
});

// Get pending bills
router.get('/pending', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const bills = await UtilityBill.find({ status: 'Pending' })
      .populate('createdBy', 'firstName lastName')
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching pending bills:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending bills',
      error: error.message
    });
  }
});

// Get single utility bill
router.get('/:id', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'read'), async (req, res) => {
  try {
    const bill = await UtilityBill.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Utility bill not found' });
    }

    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Error fetching utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch utility bill' });
  }
});

// Create new utility bill
router.post('/', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'create'), upload.single('billImage'), async (req, res) => {
  try {
    const billData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Add image path if uploaded
    if (req.file) {
      billData.billImage = `/uploads/utility-bills/${req.file.filename}`;
    } else {
      // Ensure billImage is not an empty object
      delete billData.billImage;
    }

    // Convert string values to appropriate types
    if (billData.amount) billData.amount = parseFloat(billData.amount);
    if (billData.paidAmount) billData.paidAmount = parseFloat(billData.paidAmount);
    if (billData.billDate) billData.billDate = new Date(billData.billDate);
    if (billData.dueDate) billData.dueDate = new Date(billData.dueDate);

    const bill = new UtilityBill(billData);
    await bill.save();

    // Populate data for response
    await bill.populate('createdBy', 'firstName lastName');

    res.status(201).json({ success: true, data: bill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bill ID already exists'
      });
    }
    console.error('Error creating utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to create utility bill' });
  }
});

// Update utility bill
router.put('/:id', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'), upload.single('billImage'), async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Add image path if uploaded
    if (req.file) {
      updateData.billImage = `/uploads/utility-bills/${req.file.filename}`;
    } else if (updateData.billImage === '{}' || updateData.billImage === '') {
      // Remove empty billImage field
      delete updateData.billImage;
    }

    // Convert string values to appropriate types
    if (updateData.amount) updateData.amount = parseFloat(updateData.amount);
    if (updateData.paidAmount) updateData.paidAmount = parseFloat(updateData.paidAmount);
    if (updateData.billDate) updateData.billDate = new Date(updateData.billDate);
    if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);

    const bill = await UtilityBill.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Utility bill not found' });
    }

    res.json({ success: true, data: bill });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bill ID already exists'
      });
    }
    console.error('Error updating utility bill:', error);
    res.status(500).json({ success: false, message: 'Failed to update utility bill' });
  }
});

// Record payment
router.put('/:id/payment', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'update'), async (req, res) => {
  try {
    const { paidAmount, paymentMethod, paymentDate, notes } = req.body;

    const bill = await UtilityBill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Utility bill not found'
      });
    }

    bill.paidAmount = paidAmount;
    bill.paymentMethod = paymentMethod;
    bill.paymentDate = paymentDate || new Date();
    if (notes) bill.notes = notes;
    
    await bill.save();

    const populatedBill = await UtilityBill.findById(bill._id)
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: populatedBill
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording payment',
      error: error.message
    });
  }
});

// Delete utility bill
router.delete('/:id', permissions.checkSubRolePermission('admin', 'utility_bills_management', 'delete'), async (req, res) => {
  try {
    const bill = await UtilityBill.findByIdAndDelete(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Utility bill not found'
      });
    }

    res.json({
      success: true,
      message: 'Utility bill deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting utility bill:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting utility bill',
      error: error.message
    });
  }
});

module.exports = router;
