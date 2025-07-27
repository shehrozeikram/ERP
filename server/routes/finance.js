const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Account = require('../models/finance/Account');

const router = express.Router();

// @route   GET /api/finance/accounts
// @desc    Get all accounts
// @access  Private (Finance and Admin)
router.get('/accounts', 
  authorize('admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      category,
      search 
    } = req.query;

    const query = { isActive: true };

    // Add filters
    if (type) query.type = type;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { accountNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const accounts = await Account.find(query)
      .populate('parentAccount', 'accountNumber name')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ accountNumber: 1 });

    const total = await Account.countDocuments(query);

    res.json({
      success: true,
      data: {
        accounts,
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

// @route   POST /api/finance/accounts
// @desc    Create new account
// @access  Private (Finance and Admin)
router.post('/accounts', [
  authorize('admin', 'finance_manager'),
  body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
  body('name').trim().notEmpty().withMessage('Account name is required'),
  body('type').isIn(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']).withMessage('Valid account type is required'),
  body('category').notEmpty().withMessage('Account category is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const account = new Account(req.body);
  await account.save();

  const populatedAccount = await Account.findById(account._id)
    .populate('parentAccount', 'accountNumber name');

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { account: populatedAccount }
  });
}));

// @route   GET /api/finance/accounts/:id
// @desc    Get account by ID
// @access  Private (Finance and Admin)
router.get('/accounts/:id', 
  authorize('admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const account = await Account.findById(req.params.id)
      .populate('parentAccount', 'accountNumber name');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: { account }
    });
  })
);

// @route   PUT /api/finance/accounts/:id
// @desc    Update account
// @access  Private (Finance and Admin)
router.put('/accounts/:id', 
  authorize('admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('parentAccount', 'accountNumber name');

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: { account }
    });
  })
);

// @route   GET /api/finance/trial-balance
// @desc    Get trial balance
// @access  Private (Finance and Admin)
router.get('/trial-balance', 
  authorize('admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const trialBalance = await Account.getTrialBalance();

    res.json({
      success: true,
      data: { trialBalance }
    });
  })
);

// @route   GET /api/finance/account-hierarchy
// @desc    Get account hierarchy
// @access  Private (Finance and Admin)
router.get('/account-hierarchy', 
  authorize('admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const hierarchy = await Account.getHierarchy();

    res.json({
      success: true,
      data: { hierarchy }
    });
  })
);

// @route   GET /api/finance/statistics
// @desc    Get financial statistics
// @access  Private (Finance and Admin)
router.get('/statistics', 
  authorize('admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const accounts = await Account.find({ isActive: true });
    
    const stats = {
      totalAccounts: accounts.length,
      totalAssets: accounts.filter(acc => acc.type === 'Asset').reduce((sum, acc) => sum + acc.balance, 0),
      totalLiabilities: accounts.filter(acc => acc.type === 'Liability').reduce((sum, acc) => sum + acc.balance, 0),
      totalEquity: accounts.filter(acc => acc.type === 'Equity').reduce((sum, acc) => sum + acc.balance, 0),
      totalRevenue: accounts.filter(acc => acc.type === 'Revenue').reduce((sum, acc) => sum + acc.balance, 0),
      totalExpenses: accounts.filter(acc => acc.type === 'Expense').reduce((sum, acc) => sum + acc.balance, 0)
    };

    stats.netIncome = stats.totalRevenue - stats.totalExpenses;
    stats.totalLiabilitiesAndEquity = stats.totalLiabilities + stats.totalEquity;

    res.json({
      success: true,
      data: { stats }
    });
  })
);

module.exports = router; 