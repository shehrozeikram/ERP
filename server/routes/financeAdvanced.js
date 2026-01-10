const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import models
const Account = require('../models/finance/Account');
const JournalEntry = require('../models/finance/JournalEntry');
const GeneralLedger = require('../models/finance/GeneralLedger');
const AccountsReceivable = require('../models/finance/AccountsReceivable');
const AccountsPayable = require('../models/finance/AccountsPayable');
const Banking = require('../models/finance/Banking');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'finance');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ================================
// CHART OF ACCOUNTS ROUTES
// ================================

// @route   GET /api/finance/accounts
// @desc    Get all accounts with filtering and pagination
// @access  Private (Finance and Admin)
router.get('/accounts', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      category,
      department,
      module,
      search 
    } = req.query;

    const query = { isActive: true };

    // Add filters
    if (type) query.type = type;
    if (category) query.category = category;
    if (department) query.department = department;
    if (module) query.module = module;
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
          totalCount: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/finance/accounts/hierarchy
// @desc    Get accounts in hierarchical structure
// @access  Private (Finance and Admin)
router.get('/accounts/hierarchy', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const hierarchy = await Account.getHierarchy();
    res.json({
      success: true,
      data: hierarchy
    });
  })
);

// @route   GET /api/finance/accounts/trial-balance
// @desc    Get trial balance
// @access  Private (Finance and Admin)
router.get('/accounts/trial-balance', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const trialBalance = await Account.getTrialBalance();
    res.json({
      success: true,
      data: trialBalance
    });
  })
);

// @route   POST /api/finance/accounts
// @desc    Create new account
// @access  Private (Finance and Admin)
router.post('/accounts',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
    body('name').trim().notEmpty().withMessage('Account name is required'),
    body('type').isIn(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']).withMessage('Valid account type is required'),
    body('category').notEmpty().withMessage('Account category is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const accountData = {
      ...req.body,
      metadata: {
        createdBy: req.user._id
      }
    };

    const account = new Account(accountData);
    await account.save();

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: account
    });
  })
);

// ================================
// JOURNAL ENTRIES ROUTES
// ================================

// @route   GET /api/finance/journal-entries
// @desc    Get all journal entries with filtering
// @access  Private (Finance and Admin)
router.get('/journal-entries', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      department,
      module,
      status,
      startDate,
      endDate,
      search 
    } = req.query;

    const filters = {};

    if (department) filters.department = department;
    if (module) filters.module = module;
    if (status) filters.status = status;
    if (search) {
      filters.$or = [
        { entryNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.$gte = new Date(startDate);
      if (endDate) filters.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [entries, totalCount] = await Promise.all([
      JournalEntry.find(filters)
        .populate('lines.account', 'accountNumber name type')
        .populate('createdBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .sort({ date: -1, entryNumber: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      JournalEntry.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   POST /api/finance/journal-entries
// @desc    Create new journal entry
// @access  Private (Finance and Admin)
router.post('/journal-entries',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('department').isIn(['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general']).withMessage('Valid department is required'),
    body('module').isIn(['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general']).withMessage('Valid module is required'),
    body('lines').isArray({ min: 2 }).withMessage('At least 2 lines are required'),
    body('lines.*.account').isMongoId().withMessage('Valid account is required for each line'),
    body('lines.*.debit').isFloat({ min: 0 }).withMessage('Debit amount must be non-negative'),
    body('lines.*.credit').isFloat({ min: 0 }).withMessage('Credit amount must be non-negative')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const entryData = {
      ...req.body,
      createdBy: req.user._id
    };

    const entry = new JournalEntry(entryData);
    await entry.save();

    res.status(201).json({
      success: true,
      message: 'Journal entry created successfully',
      data: entry
    });
  })
);

// @route   PUT /api/finance/journal-entries/:id/post
// @desc    Post a journal entry
// @access  Private (Finance and Admin)
router.put('/journal-entries/:id/post',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Journal entry not found'
      });
    }

    if (entry.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft entries can be posted'
      });
    }

    await entry.post(req.user._id);

    res.json({
      success: true,
      message: 'Journal entry posted successfully',
      data: entry
    });
  })
);

// ================================
// GENERAL LEDGER ROUTES
// ================================

// @route   GET /api/finance/general-ledger
// @desc    Get general ledger entries
// @access  Private (Finance and Admin)
router.get('/general-ledger', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      accountId,
      department,
      module,
      startDate,
      endDate,
      search 
    } = req.query;

    const filters = { status: 'posted' };

    if (accountId) filters.account = accountId;
    if (department) filters.department = department;
    if (module) filters.module = module;
    if (search) {
      filters.$or = [
        { entryNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.$gte = new Date(startDate);
      if (endDate) filters.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [entries, totalCount] = await Promise.all([
      GeneralLedger.find(filters)
        .populate('account', 'accountNumber name type')
        .populate('journalEntry', 'entryNumber reference description')
        .populate('createdBy', 'firstName lastName')
        .sort({ date: 1, entryNumber: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      GeneralLedger.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/finance/general-ledger/account/:id
// @desc    Get ledger for specific account
// @access  Private (Finance and Admin)
router.get('/general-ledger/account/:id', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    const entries = await GeneralLedger.getAccountLedger(
      req.params.id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    res.json({
      success: true,
      data: entries
    });
  })
);

// ================================
// ACCOUNTS RECEIVABLE ROUTES
// ================================

// @route   GET /api/finance/accounts-receivable
// @desc    Get all accounts receivable
// @access  Private (Finance and Admin)
router.get('/accounts-receivable', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      status,
      customerId,
      startDate,
      endDate,
      search 
    } = req.query;

    const filters = {};

    if (status) filters.status = status;
    if (customerId) filters['customer.customerId'] = customerId;
    if (search) {
      filters.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      filters.invoiceDate = {};
      if (startDate) filters.invoiceDate.$gte = new Date(startDate);
      if (endDate) filters.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [invoices, totalCount] = await Promise.all([
      AccountsReceivable.find(filters)
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AccountsReceivable.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/finance/accounts-receivable/aging
// @desc    Get accounts receivable aging report
// @access  Private (Finance and Admin)
router.get('/accounts-receivable/aging', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const agingReport = await AccountsReceivable.getAgingReport();
    res.json({
      success: true,
      data: agingReport
    });
  })
);

// @route   POST /api/finance/accounts-receivable
// @desc    Create new invoice
// @access  Private (Finance and Admin)
router.post('/accounts-receivable',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
    body('invoiceNumber').trim().notEmpty().withMessage('Invoice number is required'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be non-negative'),
    body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const invoiceData = {
      ...req.body,
      createdBy: req.user._id
    };

    const invoice = new AccountsReceivable(invoiceData);
    await invoice.save();

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  })
);

// @route   POST /api/finance/accounts-receivable/:id/payment
// @desc    Record payment for invoice
// @access  Private (Finance and Admin)
router.post('/accounts-receivable/:id/payment',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('amount').isFloat({ min: 0 }).withMessage('Payment amount must be non-negative'),
    body('paymentMethod').isIn(['cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'other']).withMessage('Valid payment method is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const invoice = await AccountsReceivable.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const paymentData = {
      ...req.body,
      createdBy: req.user._id
    };

    await invoice.recordPayment(paymentData);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: invoice
    });
  })
);

// ================================
// ACCOUNTS PAYABLE ROUTES
// ================================

// @route   GET /api/finance/accounts-payable
// @desc    Get all accounts payable
// @access  Private (Finance and Admin)
router.get('/accounts-payable', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      status,
      vendorId,
      startDate,
      endDate,
      search 
    } = req.query;

    const filters = {};

    if (status) filters.status = status;
    if (vendorId) filters['vendor.vendorId'] = vendorId;
    if (search) {
      filters.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { vendorInvoiceNumber: { $regex: search, $options: 'i' } },
        { 'vendor.name': { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      filters.billDate = {};
      if (startDate) filters.billDate.$gte = new Date(startDate);
      if (endDate) filters.billDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bills, totalCount] = await Promise.all([
      AccountsPayable.find(filters)
        .sort({ billDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AccountsPayable.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        bills,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/finance/accounts-payable/aging
// @desc    Get accounts payable aging report
// @access  Private (Finance and Admin)
router.get('/accounts-payable/aging', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const agingReport = await AccountsPayable.getAgingReport();
    res.json({
      success: true,
      data: agingReport
    });
  })
);

// @route   POST /api/finance/accounts-payable
// @desc    Create new bill
// @access  Private (Finance and Admin)
router.post('/accounts-payable',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('vendor.name').trim().notEmpty().withMessage('Vendor name is required'),
    body('billNumber').trim().notEmpty().withMessage('Bill number is required'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be non-negative'),
    body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const billData = {
      ...req.body,
      createdBy: req.user._id
    };

    const bill = new AccountsPayable(billData);
    await bill.save();

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill
    });
  })
);

// ================================
// BANKING ROUTES
// ================================

// @route   GET /api/finance/banking/accounts
// @desc    Get all bank accounts
// @access  Private (Finance and Admin)
router.get('/banking/accounts', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      accountType,
      department,
      isActive,
      search 
    } = req.query;

    const filters = {};

    if (accountType) filters.accountType = accountType;
    if (department) filters.department = department;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) {
      filters.$or = [
        { accountName: { $regex: search, $options: 'i' } },
        { accountNumber: { $regex: search, $options: 'i' } },
        { bankName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [accounts, totalCount] = await Promise.all([
      Banking.find(filters)
        .sort({ accountName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Banking.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        accounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/finance/banking
// @desc    Get all bank accounts (alias for /banking/accounts)
// @access  Private (Finance and Admin)
router.get('/banking', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      accountType,
      department,
      isActive,
      search 
    } = req.query;

    const filters = {};

    if (accountType) filters.accountType = accountType;
    if (department) filters.department = department;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) {
      filters.$or = [
        { accountName: { $regex: search, $options: 'i' } },
        { accountNumber: { $regex: search, $options: 'i' } },
        { bankName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [accounts, totalCount] = await Promise.all([
      Banking.find(filters)
        .sort({ accountName: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'firstName lastName')
        .exec(),
      Banking.countDocuments(filters)
    ]);

    const summary = await Banking.getAccountSummary();

    res.json({
      success: true,
      data: {
        accounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNextPage: page < Math.ceil(totalCount / parseInt(limit)),
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        },
        summary
      }
    });
  })
);

// @route   GET /api/finance/banking/transactions
// @desc    Get banking transactions
// @access  Private (Finance and Admin)
router.get('/banking/transactions', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      accountId,
      type,
      startDate,
      endDate,
      search 
    } = req.query;

    const filters = {};

    if (accountId) filters.account = accountId;
    if (type) filters.type = type;
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.$gte = new Date(startDate);
      if (endDate) filters.date.$lte = new Date(endDate);
    }
    if (search) {
      filters.$or = [
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get all bank accounts first
    const bankAccounts = await Banking.find({}).exec();
    
    // Extract transactions from all accounts
    let allTransactions = [];
    bankAccounts.forEach(account => {
      if (account.transactions && account.transactions.length > 0) {
        account.transactions.forEach(transaction => {
          allTransactions.push({
            ...transaction.toObject(),
            account: {
              _id: account._id,
              name: account.accountName,
              type: account.accountType
            }
          });
        });
      }
    });

    // Apply filters
    let filteredTransactions = allTransactions;
    if (filters.account) {
      filteredTransactions = filteredTransactions.filter(t => t.account._id.toString() === filters.account);
    }
    if (filters.type) {
      filteredTransactions = filteredTransactions.filter(t => t.type === filters.type);
    }
    if (filters.date) {
      filteredTransactions = filteredTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= filters.date.$gte && transactionDate <= filters.date.$lte;
      });
    }
    if (filters.$or) {
      filteredTransactions = filteredTransactions.filter(t => {
        return filters.$or.some(condition => {
          return Object.keys(condition).some(field => {
            return t[field] && t[field].toLowerCase().includes(condition[field].$regex.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, ''));
          });
        });
      });
    }

    // Sort by date (newest first)
    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply pagination
    const totalCount = filteredTransactions.length;
    const paginatedTransactions = filteredTransactions.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNextPage: page < Math.ceil(totalCount / parseInt(limit)),
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/finance/banking/summary
// @desc    Get banking summary
// @access  Private (Finance and Admin)
router.get('/banking/summary', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const summary = await Banking.getAccountSummary();
    res.json({
      success: true,
      data: summary
    });
  })
);

// @route   POST /api/finance/banking
// @desc    Create new bank account
// @access  Private (Finance and Admin)
router.post('/banking',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('accountName').trim().notEmpty().withMessage('Account name is required'),
    body('accountNumber').trim().notEmpty().withMessage('Account number is required'),
    body('bankName').trim().notEmpty().withMessage('Bank name is required'),
    body('accountType').isIn(['checking', 'savings', 'money_market', 'cd', 'line_of_credit', 'credit_card']).withMessage('Valid account type is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const accountData = {
      ...req.body,
      createdBy: req.user._id
    };

    const account = new Banking(accountData);
    await account.save();

    res.status(201).json({
      success: true,
      message: 'Bank account created successfully',
      data: account
    });
  })
);

// ================================
// FINANCIAL REPORTS ROUTES
// ================================

// @route   GET /api/finance/reports
// @desc    Get financial reports (unified endpoint)
// @access  Private (Finance and Admin)
router.get('/reports', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { reportType = 'overview', startDate, endDate, department } = req.query;
    
    try {
      let reportData = {};
      
      if (reportType === 'overview') {
        // Calculate date range
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
        const end = endDate ? new Date(endDate) : new Date();
        
        // Get all accounts
        const [revenueAccounts, expenseAccounts, cashAccounts] = await Promise.all([
          Account.find({ type: 'Revenue', isActive: true }),
          Account.find({ type: 'Expense', isActive: true }),
          Account.find({ type: 'Asset', category: 'Cash', isActive: true })
        ]);

        // Calculate period balances
        const calculatePeriodBalance = async (accountId, startDate, endDate) => {
          const ledgerEntries = await GeneralLedger.find({
            account: accountId,
            date: { $gte: startDate, $lte: endDate },
            status: 'posted'
          });
          
          let balance = 0;
          ledgerEntries.forEach(entry => {
            balance += entry.debit - entry.credit;
          });
          return balance;
        };

        // Calculate revenue
        let totalRevenue = 0;
        const departmentBreakdown = {};
        
        for (const account of revenueAccounts) {
          const balance = await calculatePeriodBalance(account._id, start, end);
          totalRevenue += Math.abs(balance);
          
          const dept = account.department || 'general';
          if (!departmentBreakdown[dept]) {
            departmentBreakdown[dept] = { revenue: 0, expenses: 0, netProfit: 0 };
          }
          departmentBreakdown[dept].revenue += Math.abs(balance);
        }

        // Calculate expenses
        let totalExpenses = 0;
        for (const account of expenseAccounts) {
          const balance = await calculatePeriodBalance(account._id, start, end);
          totalExpenses += Math.abs(balance);
          
          const dept = account.department || 'general';
          if (!departmentBreakdown[dept]) {
            departmentBreakdown[dept] = { revenue: 0, expenses: 0, netProfit: 0 };
          }
          departmentBreakdown[dept].expenses += Math.abs(balance);
        }

        // Calculate department net profit
        Object.keys(departmentBreakdown).forEach(dept => {
          departmentBreakdown[dept].netProfit = 
            departmentBreakdown[dept].revenue - departmentBreakdown[dept].expenses;
        });

        // Calculate cash balance
        let cashBalance = 0;
        for (const account of cashAccounts) {
          cashBalance += account.balance;
        }

        reportData = {
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,
          cashBalance,
          departmentBreakdown
        };
      } 
      else if (reportType === 'profit-loss') {
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
        const end = endDate ? new Date(endDate) : new Date();
        
        const [revenueAccounts, expenseAccounts] = await Promise.all([
          Account.find({ type: 'Revenue', isActive: true }),
          Account.find({ type: 'Expense', isActive: true })
        ]);

        const profitLossData = [];
        
        // Add revenue items
        for (const account of revenueAccounts) {
          const ledgerEntries = await GeneralLedger.find({
            account: account._id,
            date: { $gte: start, $lte: end },
            status: 'posted'
          });
          
          let amount = 0;
          ledgerEntries.forEach(entry => {
            amount += entry.credit - entry.debit;
          });
          
          if (amount !== 0) {
            profitLossData.push({
              name: account.name,
              category: account.category,
              department: account.department,
              type: 'revenue',
              amount: Math.abs(amount)
            });
          }
        }
        
        // Add expense items
        for (const account of expenseAccounts) {
          const ledgerEntries = await GeneralLedger.find({
            account: account._id,
            date: { $gte: start, $lte: end },
            status: 'posted'
          });
          
          let amount = 0;
          ledgerEntries.forEach(entry => {
            amount += entry.debit - entry.credit;
          });
          
          if (amount !== 0) {
            profitLossData.push({
              name: account.name,
              category: account.category,
              department: account.department,
              type: 'expense',
              amount: Math.abs(amount)
            });
          }
        }
        
        reportData = { profitLossData };
      }
      else if (reportType === 'balance-sheet') {
        const asOf = endDate ? new Date(endDate) : new Date();
        
        const [assets, liabilities] = await Promise.all([
          Account.find({ type: 'Asset', isActive: true }),
          Account.find({ type: 'Liability', isActive: true })
        ]);

        const assetData = [];
        const liabilityData = [];
        
        for (const account of assets) {
          if (account.balance !== 0) {
            assetData.push({
              name: account.name,
              balance: account.balance
            });
          }
        }
        
        for (const account of liabilities) {
          if (account.balance !== 0) {
            liabilityData.push({
              name: account.name,
              balance: account.balance
            });
          }
        }
        
        reportData = {
          balanceSheetData: {
            assets: assetData,
            liabilities: liabilityData
          }
        };
      }
      
      res.json({
        success: true,
        data: reportData
      });
    } catch (error) {
      console.error('Error generating financial report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating financial report',
        error: error.message
      });
    }
  })
);

// @route   GET /api/finance/reports/trial-balance
// @desc    Get trial balance report
// @access  Private (Finance and Admin)
router.get('/reports/trial-balance', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { asOfDate } = req.query;
    const trialBalance = await JournalEntry.getTrialBalance(asOfDate ? new Date(asOfDate) : new Date());
    res.json({
      success: true,
      data: trialBalance
    });
  })
);

// @route   GET /api/finance/reports/balance-sheet
// @desc    Get balance sheet report
// @access  Private (Finance and Admin)
router.get('/reports/balance-sheet', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { asOfDate } = req.query;
    const asOf = asOfDate ? new Date(asOfDate) : new Date();
    
    // Get accounts by type
    const [assets, liabilities, equity] = await Promise.all([
      Account.find({ type: 'Asset', isActive: true }),
      Account.find({ type: 'Liability', isActive: true }),
      Account.find({ type: 'Equity', isActive: true })
    ]);

    // Calculate balances
    const calculateBalances = async (accounts) => {
      return Promise.all(accounts.map(async (account) => {
        const balance = await GeneralLedger.getAccountBalance(account._id, asOf);
        return { ...account.toObject(), balance };
      }));
    };

    const [assetBalances, liabilityBalances, equityBalances] = await Promise.all([
      calculateBalances(assets),
      calculateBalances(liabilities),
      calculateBalances(equity)
    ]);

    // Calculate totals
    const totalAssets = assetBalances.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = liabilityBalances.reduce((sum, acc) => sum + acc.balance, 0);
    const totalEquity = equityBalances.reduce((sum, acc) => sum + acc.balance, 0);

    res.json({
      success: true,
      data: {
        asOfDate: asOf,
        assets: {
          accounts: assetBalances,
          total: totalAssets
        },
        liabilities: {
          accounts: liabilityBalances,
          total: totalLiabilities
        },
        equity: {
          accounts: equityBalances,
          total: totalEquity
        },
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
      }
    });
  })
);

// @route   GET /api/finance/reports/profit-loss
// @desc    Get profit & loss report
// @access  Private (Finance and Admin)
router.get('/reports/profit-loss', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate, department } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get revenue and expense accounts
    const [revenueAccounts, expenseAccounts] = await Promise.all([
      Account.find({ type: 'Revenue', isActive: true }),
      Account.find({ type: 'Expense', isActive: true })
    ]);

    // Calculate balances for period
    const calculatePeriodBalances = async (accounts) => {
      return Promise.all(accounts.map(async (account) => {
        const balance = await GeneralLedger.getAccountBalance(account._id, end) - 
                       await GeneralLedger.getAccountBalance(account._id, start);
        return { ...account.toObject(), balance };
      }));
    };

    const [revenueBalances, expenseBalances] = await Promise.all([
      calculatePeriodBalances(revenueAccounts),
      calculatePeriodBalances(expenseAccounts)
    ]);

    // Calculate totals
    const totalRevenue = revenueBalances.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpenses = expenseBalances.reduce((sum, acc) => sum + acc.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        period: { startDate: start, endDate: end },
        revenue: {
          accounts: revenueBalances,
          total: totalRevenue
        },
        expenses: {
          accounts: expenseBalances,
          total: totalExpenses
        },
        netIncome
      }
    });
  })
);

// @route   GET /api/finance/reports/cash-flow
// @desc    Get cash flow report
// @access  Private (Finance and Admin)
router.get('/reports/cash-flow', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const cashFlowReport = await Banking.getCashFlowReport(
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        cashFlow: cashFlowReport
      }
    });
  })
);

module.exports = router;
