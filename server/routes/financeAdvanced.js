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
const RecurringJournal = require('../models/finance/RecurringJournal');
const FinanceHelper = require('../utils/financeHelper');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const GoodsReceive = require('../models/procurement/GoodsReceive');

const router = express.Router();
const { ACCOUNT_TYPES_GROUPED, ACCOUNT_TYPE_TO_SECTION, DETAIL_TYPES_BY_ACCOUNT_TYPE } = require('../config/accountDetailTypes');

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

// @route   GET /api/finance/accounts/detail-types
// @desc    Get account types and detail types (QuickBooks-style)
// @access  Private
router.get('/accounts/detail-types',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        accountTypesGrouped: ACCOUNT_TYPES_GROUPED,
        detailTypesByAccountType: DETAIL_TYPES_BY_ACCOUNT_TYPE
      }
    });
  })
);

// @route   GET /api/finance/accounts
// @desc    Get all accounts with filtering and pagination
// @access  Private (Finance and Admin)
router.get('/accounts', 
  authorize('super_admin', 'admin', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
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

// @route   POST /api/finance/accounts/ensure-defaults
// @desc    Upsert critical system accounts (WHT Payable, Retained Earnings, etc.) that must exist for GL posting
// @access  Private (Finance and Admin)
router.post('/accounts/ensure-defaults',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    // Account model enum: type ∈ ['Asset','Liability','Equity','Revenue','Expense'], category is required
    const defaults = [
      { accountNumber: '1001', name: 'Cash',               type: 'Asset',     category: 'Current Asset',       detailType: 'Cash and Cash Equivalents' },
      { accountNumber: '1002', name: 'Bank Account',       type: 'Asset',     category: 'Current Asset',       detailType: 'Bank'                      },
      { accountNumber: '1100', name: 'Inventory',          type: 'Asset',     category: 'Current Asset',       detailType: 'Inventory Asset'            },
      { accountNumber: '1200', name: 'Accounts Receivable',type: 'Asset',     category: 'Current Asset',       detailType: 'Accounts Receivable'        },
      { accountNumber: '2001', name: 'Accounts Payable',   type: 'Liability', category: 'Current Liability',   detailType: 'Accounts Payable'           },
      { accountNumber: '2004', name: 'WHT Payable',        type: 'Liability', category: 'Current Liability',   detailType: 'Other Current Liabilities'  },
      { accountNumber: '2100', name: 'GRNI Clearing',      type: 'Liability', category: 'Current Liability',   detailType: 'Other Current Liabilities'  },
      { accountNumber: '2200', name: 'Salaries Payable',   type: 'Liability', category: 'Current Liability',   detailType: 'Other Current Liabilities'  },
      { accountNumber: '3001', name: 'Share Capital',      type: 'Equity',    category: 'Equity',              detailType: "Owner's Equity"             },
      { accountNumber: '3002', name: 'Retained Earnings',  type: 'Equity',    category: 'Equity',              detailType: 'Retained Earnings'          },
      { accountNumber: '4001', name: 'Sales Revenue',      type: 'Revenue',   category: 'Operating Revenue',   detailType: 'Sales'                      },
      { accountNumber: '5000', name: 'Cost of Goods Sold', type: 'Expense',   category: 'Cost of Sales',       detailType: 'Cost of Goods Sold'         },
      { accountNumber: '5001', name: 'General Expenses',   type: 'Expense',   category: 'Operating Expense',   detailType: 'Other Operating Expenses'   },
      { accountNumber: '5002', name: 'Salaries Expense',   type: 'Expense',   category: 'Operating Expense',   detailType: 'Payroll Expenses'           },
      { accountNumber: '5003', name: 'Depreciation Expense',type:'Expense',   category: 'Operating Expense',   detailType: 'Depreciation'               },
    ];

    const results = [];
    for (const acc of defaults) {
      const existing = await Account.findOne({ accountNumber: acc.accountNumber });
      if (!existing) {
        const created = await Account.create({ ...acc, isActive: true, isSystemAccount: true, description: 'Auto-created system account' });
        results.push({ status: 'created', accountNumber: acc.accountNumber, name: acc.name, _id: created._id });
      } else {
        results.push({ status: 'exists', accountNumber: acc.accountNumber, name: existing.name, _id: existing._id });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    res.json({
      success: true,
      message: created > 0 ? `${created} system account(s) created, ${results.length - created} already existed` : 'All system accounts already exist',
      data: results
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
    body('accountType').notEmpty().withMessage('Account type is required'),
    body('detailType').notEmpty().withMessage('Detail type is required')
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

    const accountType = req.body.accountType || req.body.category; // e.g. "Cash and cash equivalents"
    const section = require('../config/accountDetailTypes').getSectionForAccountType(accountType) || 'Asset';
    const type = section === 'Income' ? 'Revenue' : section;
    const { accountType: _, ...rest } = req.body;
    const accountData = {
      ...rest,
      type,
      category: accountType,
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
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
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
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filters.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.date.$lte = end;
      }
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

// @route   GET /api/finance/journal-entries/:id
// @desc    Get single journal entry with populated lines
// @access  Private (Finance and Admin)
router.get('/journal-entries/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findById(req.params.id)
      .populate('lines.account', 'accountNumber name type category')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!entry) return res.status(404).json({ success: false, message: 'Journal entry not found' });

    // Normalize lines so the form receives { account: ObjectId-string, ... }
    // but also provide account details for display
    const normalized = entry.toObject();
    res.json({ success: true, data: normalized });
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
    body('module').isIn(['payroll', 'procurement', 'sales', 'hr', 'admin', 'audit', 'general', 'finance', 'taj_utilities']).withMessage('Valid module is required'),
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
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
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
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filters.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.date.$lte = end;
      }
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
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filters.invoiceDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.invoiceDate.$lte = end;
      }
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

    // Use FinanceHelper to create AR and post to GL
    const arEntry = await FinanceHelper.createARFromInvoice({
      customerName: req.body.customer.name,
      customerEmail: req.body.customer.email || '',
      customerId: req.body.customer.customerId || null,
      invoiceNumber: req.body.invoiceNumber,
      invoiceDate: req.body.invoiceDate,
      dueDate: req.body.dueDate,
      amount: req.body.totalAmount,
      department: req.body.department || 'general',
      module: 'general',
      referenceId: null,
      charges: req.body.lineItems.map(item => ({
        type: 'OTHER',
        description: item.description,
        amount: item.amount,
        total: item.total || item.amount
      })),
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: arEntry
    });
  })
);

// @route   PUT /api/finance/accounts-receivable/:id
// @desc    Update invoice
// @access  Private (Finance and Admin)
router.put('/accounts-receivable/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const invoice = await AccountsReceivable.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  })
);

// @route   GET /api/finance/accounts-receivable/:id
// @desc    Get invoice by ID
// @access  Private (Finance and Admin)
router.get('/accounts-receivable/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const invoice = await AccountsReceivable.findById(req.params.id).lean();
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...invoice,
        customerName: invoice.customer?.name || 'Unknown Customer',
        customerEmail: invoice.customer?.email || ''
      }
    });
  })
);

// @route   POST /api/finance/accounts-receivable/:id/payment
// @desc    Record receipt for invoice (with optional specific bank account)
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
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    try {
      const updatedInvoice = await FinanceHelper.recordARPayment(req.params.id, {
        amount:        req.body.amount,
        paymentMethod: req.body.paymentMethod,
        reference:     req.body.reference,
        date:          req.body.paymentDate,
        bankAccountId: req.body.bankAccountId || null,
        createdBy:     req.user._id
      });

      res.json({ success: true, message: 'Payment recorded successfully', data: updatedInvoice });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Failed to record payment' });
    }
  })
);

// @route   PUT /api/finance/accounts-payable/:id
// @desc    Update bill
// @access  Private (Finance and Admin)
router.put('/accounts-payable/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const bill = await AccountsPayable.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      message: 'Bill updated successfully',
      data: bill
    });
  })
);

// @route   GET /api/finance/accounts-payable/pos-for-billing
// @desc    List POs with status "Sent to Finance" for billing
// @access  Private (Finance and Admin)
router.get('/accounts-payable/pos-for-billing',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const pos = await PurchaseOrder.find({ status: 'Sent to Finance' })
      .populate('vendor', 'name email phone')
      .populate('indent', 'indentNumber title department requestedBy')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ success: true, data: pos });
  })
);

// @route   POST /api/finance/accounts-payable/create-from-po
// @desc    Create bill from purchase order (Indent, Quotations, CS, PO, GRN linked)
// @access  Private (Finance and Admin)
router.post('/accounts-payable/create-from-po',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('purchaseOrderId').trim().notEmpty().withMessage('Purchase order ID is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    const po = await PurchaseOrder.findById(req.body.purchaseOrderId)
      .populate('vendor', 'name email phone')
      .populate('indent', 'indentNumber title');
    if (!po) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    if (po.status !== 'Sent to Finance') {
      return res.status(400).json({
        success: false,
        message: 'Only purchase orders with status "Sent to Finance" can be billed'
      });
    }
    const billNumber = req.body.billNumber || `BILL-PO-${po.orderNumber}-${Date.now().toString(36).toUpperCase()}`;
    const billDate = req.body.billDate || new Date();
    const dueDate = req.body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const lineItems = (po.items || []).map(it => ({
      description: it.description || 'Item',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0
    }));
    const apEntry = await FinanceHelper.createAPFromBill({
      vendorName: po.vendor?.name || 'Unknown',
      vendorEmail: po.vendor?.email || '',
      vendorId: po.vendor?._id || po.vendor,
      billNumber,
      billDate,
      dueDate,
      amount: po.totalAmount || 0,
      department: 'procurement',
      module: 'procurement',
      referenceId: po._id,
      referenceType: 'purchase_order',
      lineItems: lineItems.length > 0 ? lineItems : undefined,
      createdBy: req.user._id
    });
    res.status(201).json({
      success: true,
      message: 'Bill created from purchase order',
      data: apEntry
    });
  })
);

// @route   GET /api/finance/accounts-payable/aging  ← must come BEFORE /:id
// @desc    Get accounts payable aging report
// @access  Private (Finance and Admin)
router.get('/accounts-payable/aging',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const agingReport = await AccountsPayable.getAgingReport();
    res.json({ success: true, data: agingReport });
  })
);

// @route   GET /api/finance/accounts-payable/:id
// @desc    Get bill by ID (includes PO-linked docs: indent, quotations, comparative statement, PO, GRN)
// @access  Private (Finance and Admin)
router.get('/accounts-payable/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const bill = await AccountsPayable.findById(req.params.id).lean();
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }
    let poDetail = null;
    if (bill.referenceType === 'purchase_order' && bill.referenceId) {
      const Quotation = require('../models/procurement/Quotation');
      const Indent = require('../models/general/Indent');
      const po = await PurchaseOrder.findById(bill.referenceId)
        .populate('vendor', 'name email phone address')
        .populate('indent')
        .lean();
      if (po) {
        const indentId = po.indent?._id || po.indent;
        let quotations = [];
        let indent = null;
        if (indentId) {
          indent = await Indent.findById(indentId).populate('requestedBy', 'firstName lastName name email').populate('department', 'name').lean();
          quotations = await Quotation.find({ indent: indentId }).populate('vendor', 'name email').lean();
        }
        const grns = await GoodsReceive.find({ purchaseOrder: po._id }).populate('supplier', 'name').lean();
        poDetail = { po, indent, quotations, grns };
      }
    }
    res.json({
      success: true,
      data: {
        ...bill,
        vendorName: bill.vendor?.name || 'Unknown Vendor',
        vendorEmail: bill.vendor?.email || '',
        poDetail
      }
    });
  })
);

// @route   POST /api/finance/accounts-payable/:id/payment
// @desc    Record payment for bill (with optional WHT deduction and specific bank account)
// @access  Private (Finance and Admin)
router.post('/accounts-payable/:id/payment',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('amount').isFloat({ min: 0 }).withMessage('Payment amount must be non-negative'),
    body('paymentMethod').isIn(['cash', 'check', 'credit_card', 'bank_transfer', 'ach', 'other']).withMessage('Valid payment method is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    try {
      const updatedBill = await FinanceHelper.recordAPPayment(req.params.id, {
        amount:        req.body.amount,
        paymentMethod: req.body.paymentMethod,
        reference:     req.body.reference,
        date:          req.body.paymentDate,
        whtRate:       Number(req.body.whtRate)  || 0,
        bankAccountId: req.body.bankAccountId    || null,
        createdBy:     req.user._id
      });

      res.json({ success: true, message: 'Payment recorded successfully', data: updatedBill });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Failed to record payment' });
    }
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
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filters.billDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.billDate.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [bills, totalCount] = await Promise.all([
      AccountsPayable.find(filters)
        .sort({ billDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AccountsPayable.countDocuments(filters)
    ]);

    // Calculate summary using aggregation pipeline for better performance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const summaryResult = await AccountsPayable.aggregate([
      { $match: filters },
      {
        $project: {
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          amountPaid: { $ifNull: ['$amountPaid', 0] },
          dueDate: 1
        }
      },
      {
        $group: {
          _id: null,
          totalOutstanding: {
            $sum: {
              $subtract: ['$totalAmount', '$amountPaid']
            }
          },
          totalPaid: { $sum: '$amountPaid' },
          totalOverdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$dueDate', null] },
                    { $lt: ['$dueDate', today] },
                    { $gt: [{ $subtract: ['$totalAmount', '$amountPaid'] }, 0] }
                  ]
                },
                { $subtract: ['$totalAmount', '$amountPaid'] },
                0
              ]
            }
          }
        }
      }
    ]);

    const summary = {
      totalOutstanding: 0,
      totalOverdue: 0,
      totalPaid: 0,
      totalBills: totalCount,
      ...(summaryResult[0] || {})
    };

    // Transform bills to match frontend expectations
    const transformedBills = bills.map(bill => ({
      ...bill,
      vendorName: bill.vendor?.name || 'Unknown Vendor',
      vendorEmail: bill.vendor?.email || '',
      paidAmount: bill.amountPaid || 0
    }));

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Prevent caching to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: {
        bills: transformedBills,
        summary,
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

    // Use FinanceHelper to create AP and post to GL (lineItems from form; same pattern as REF-FINAL-001)
    const lineItems = (req.body.lineItems || []).map(li => ({
      description: li.description || 'Line item',
      quantity: Number(li.quantity) || 1,
      unitPrice: Number(li.unitPrice) ?? Number(li.amount) ?? 0
    })).filter(li => li.unitPrice >= 0);
    const apEntry = await FinanceHelper.createAPFromBill({
      vendorName: req.body.vendor.name,
      vendorEmail: req.body.vendor.email || '',
      vendorId: req.body.vendor.vendorId || null,
      billNumber: req.body.billNumber,
      billDate: req.body.billDate,
      dueDate: req.body.dueDate,
      amount: req.body.totalAmount,
      department: req.body.department || 'general',
      module: 'general',
      referenceId: null,
      lineItems: lineItems.length > 0 ? lineItems : undefined,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: apEntry
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
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filters.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.date.$lte = end;
      }
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

// NOTE: Balance Sheet, Profit & Loss, and Cash Flow routes are defined further below
// using JournalEntry aggregation for accurate GL-sourced data.

// ================================
// INVENTORY VALUATION REPORT
// ================================

// @route   GET /api/finance/reports/inventory-valuation
// @desc    Inventory valuation using Weighted Average Cost
//          Shows each item: qty × WAC = total value, grouped by category
// @access  Private (Finance and Admin)
router.get('/reports/inventory-valuation',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const Inventory = require('../models/procurement/Inventory');
    const InventoryCategory = require('../models/procurement/InventoryCategory');

    const { categoryId, search } = req.query;
    const query = { quantity: { $gt: 0 } };
    if (categoryId) query.inventoryCategory = categoryId;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { itemCode: { $regex: search, $options: 'i' } }
    ];

    const items = await Inventory.find(query)
      .populate('inventoryCategory', 'name')
      .populate('inventoryAccount', 'accountNumber name')
      .select('itemCode name category inventoryCategory quantity unitPrice averageCost totalValue inventoryAccount store storeSnapshot')
      .lean();

    // Build report with WAC-based values
    const reportItems = items.map(item => {
      const wac = item.averageCost || item.unitPrice || 0;
      const qty = item.quantity || 0;
      return {
        itemCode: item.itemCode,
        name: item.name,
        category: item.inventoryCategory?.name || item.category || '—',
        store: item.storeSnapshot || '—',
        quantity: qty,
        unitPrice: item.unitPrice || 0,
        weightedAverageCost: wac,
        totalValue: Math.round(qty * wac * 100) / 100,
        inventoryAccount: item.inventoryAccount
          ? `${item.inventoryAccount.accountNumber} – ${item.inventoryAccount.name}`
          : '—'
      };
    });

    // Group by category
    const byCategory = {};
    for (const item of reportItems) {
      const cat = item.category;
      if (!byCategory[cat]) byCategory[cat] = { name: cat, items: [], totalValue: 0, totalQty: 0 };
      byCategory[cat].items.push(item);
      byCategory[cat].totalValue = Math.round((byCategory[cat].totalValue + item.totalValue) * 100) / 100;
      byCategory[cat].totalQty += item.quantity;
    }

    const grandTotal = reportItems.reduce((s, i) => s + i.totalValue, 0);

    // Compare with GL balance on inventory accounts
    const inventoryGLBalance = await GeneralLedger.aggregate([
      {
        $lookup: {
          from: 'accounts',
          localField: 'account',
          foreignField: '_id',
          as: 'accountDoc'
        }
      },
      { $unwind: '$accountDoc' },
      {
        $match: {
          'accountDoc.type': 'Asset',
          'accountDoc.accountNumber': { $regex: /^11/ }, // 1100-1199 inventory range
          status: 'posted'
        }
      },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: '$debit' },
          totalCredit: { $sum: '$credit' }
        }
      }
    ]);

    const glBalance = inventoryGLBalance[0]
      ? Math.round((inventoryGLBalance[0].totalDebit - inventoryGLBalance[0].totalCredit) * 100) / 100
      : null;

    res.json({
      success: true,
      data: {
        generatedAt: new Date(),
        items: reportItems,
        byCategory: Object.values(byCategory),
        summary: {
          totalItems: reportItems.length,
          grandTotalValue: Math.round(grandTotal * 100) / 100,
          glInventoryBalance: glBalance,
          variance: glBalance !== null ? Math.round((grandTotal - glBalance) * 100) / 100 : null
        }
      }
    });
  })
);

// ================================
// TRIAL BALANCE — SINGLE SOURCE OF TRUTH
// ================================

// @route   GET /api/finance/reports/trial-balance-v2
// @desc    Trial balance computed ONLY from posted journal entry lines (single source of truth)
//          Fixes the two-implementation inconsistency — do NOT use Account.balance field for reporting
// @access  Private
router.get('/reports/trial-balance-v2',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { asOfDate } = req.query;
    const asOf = asOfDate ? new Date(asOfDate) : new Date();

    // Aggregate all posted JE lines up to asOfDate, summing debit/credit per account
    const rows = await JournalEntry.aggregate([
      { $match: { status: 'posted', date: { $lte: asOf } } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.account',
          totalDebit:  { $sum: '$lines.debit' },
          totalCredit: { $sum: '$lines.credit' }
        }
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id',
          foreignField: '_id',
          as: 'accountDoc'
        }
      },
      { $unwind: '$accountDoc' },
      {
        $project: {
          accountNumber: '$accountDoc.accountNumber',
          accountName:   '$accountDoc.name',
          accountType:   '$accountDoc.type',
          totalDebit:  1,
          totalCredit: 1,
          netBalance: { $subtract: ['$totalDebit', '$totalCredit'] }
        }
      },
      { $sort: { accountNumber: 1 } }
    ]);

    const totalDebits  = rows.reduce((s, r) => s + r.totalDebit, 0);
    const totalCredits = rows.reduce((s, r) => s + r.totalCredit, 0);

    res.json({
      success: true,
      data: {
        asOfDate: asOf,
        rows,
        totals: {
          totalDebits:  Math.round(totalDebits * 100) / 100,
          totalCredits: Math.round(totalCredits * 100) / 100,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01
        }
      }
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR STATEMENT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/vendor-statement/:supplierId',
  authorize('super_admin', 'admin', 'finance_manager', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const mongoose = require('mongoose');
    const { supplierId } = req.params;

    // Guard against null / invalid ObjectId (bills with no linked supplier)
    if (!supplierId || supplierId === 'null' || supplierId === 'undefined' || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier ID' });
    }

    const { fromDate, toDate } = req.query;
    const matchFilter = { supplier: new mongoose.Types.ObjectId(supplierId) };
    if (fromDate || toDate) {
      matchFilter.createdAt = {};
      if (fromDate) matchFilter.createdAt.$gte = new Date(fromDate);
      if (toDate) matchFilter.createdAt.$lte = new Date(toDate);
    }

    const bills = await AccountsPayable.find(matchFilter)
      .populate('supplier', 'name code email phone')
      .populate('createdBy', 'name')
      .sort({ createdAt: 1 });

    const totalBilled  = bills.reduce((s, b) => s + (b.amount || 0), 0);
    const totalPaid    = bills.reduce((s, b) => s + (b.paidAmount || 0), 0);
    const totalBalance = bills.reduce((s, b) => s + (b.balance || 0), 0);

    res.json({
      success: true,
      data: {
        supplier: bills[0]?.supplier || { _id: supplierId },
        bills,
        summary: {
          totalBilled:  Math.round(totalBilled * 100) / 100,
          totalPaid:    Math.round(totalPaid * 100) / 100,
          totalBalance: Math.round(totalBalance * 100) / 100
        }
      }
    });
  })
);

// Supplier list for vendor statement
router.get('/reports/vendor-statement',
  authorize('super_admin', 'admin', 'finance_manager', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const mongoose = require('mongoose');
    const summary = await AccountsPayable.aggregate([
      { $match: { supplier: { $exists: true, $ne: null } } },
      { $group: {
        _id: '$supplier',
        supplierName: { $first: '$supplierName' },
        totalBilled:  { $sum: '$amount' },
        totalPaid:    { $sum: '$paidAmount' },
        totalBalance: { $sum: '$balance' },
        lastActivity: { $max: '$createdAt' }
      }},
      { $sort: { supplierName: 1 } }
    ]);
    res.json({ success: true, data: summary });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER STATEMENT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/customer-statement',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    // customer is an embedded object {name,email,...} — group by customer.name as the key
    const summary = await AccountsReceivable.aggregate([
      { $group: {
        _id:           '$customer.name',          // plain string — safe to use as URL param
        customerEmail: { $first: '$customer.email' },
        totalInvoiced: { $sum: '$totalAmount' },
        totalReceived: { $sum: '$paidAmount' },
        totalBalance:  { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } },
        lastActivity:  { $max: '$createdAt' }
      }},
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data: summary });
  })
);

router.get('/reports/customer-statement/:customerName',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    // :customerName is URL-encoded customer.name (the embedded field)
    const customerName = decodeURIComponent(req.params.customerName);
    const { fromDate, toDate } = req.query;

    const matchFilter = { 'customer.name': customerName };
    if (fromDate || toDate) {
      matchFilter.createdAt = {};
      if (fromDate) matchFilter.createdAt.$gte = new Date(fromDate);
      if (toDate)   matchFilter.createdAt.$lte = new Date(toDate);
    }

    const invoices = await AccountsReceivable.find(matchFilter).sort({ createdAt: 1 });

    const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || i.amount || 0), 0);
    const totalReceived = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const totalBalance  = invoices.reduce((s, i) => s + ((i.totalAmount || i.amount || 0) - (i.paidAmount || 0)), 0);

    res.json({
      success: true,
      data: {
        customer: { name: customerName, email: invoices[0]?.customer?.email || '' },
        invoices,
        summary: {
          totalInvoiced: Math.round(totalInvoiced * 100) / 100,
          totalReceived: Math.round(totalReceived * 100) / 100,
          totalBalance:  Math.round(totalBalance * 100) / 100
        }
      }
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// BANK RECONCILIATION REPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/bank-reconciliation',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { accountId, asOfDate } = req.query;
    const asOf = asOfDate ? new Date(asOfDate) : new Date();

    // GL balance for the bank account
    const glRows = await GeneralLedger.aggregate([
      { $match: { account: accountId ? new (require('mongoose').Types.ObjectId)(accountId) : { $exists: true }, date: { $lte: asOf } } },
      { $group: { _id: '$account', totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' } } }
    ]);
    const glBalance = glRows.reduce((s, r) => s + r.totalDebit - r.totalCredit, 0);

    // Banking transactions
    const filter = { date: { $lte: asOf } };
    if (accountId) filter.bankAccount = accountId;
    const bankTxns = await Banking.find(filter).sort({ date: 1 });
    const bankBalance = bankTxns.reduce((s, t) => {
      if (t.type === 'credit') return s + (t.amount || 0);
      return s - (t.amount || 0);
    }, 0);

    const unreconciled = bankTxns.filter(t => !t.isReconciled);
    const unreconciledTotal = unreconciled.reduce((s, t) => {
      if (t.type === 'credit') return s + (t.amount || 0);
      return s - (t.amount || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        asOfDate: asOf,
        glBalance:          Math.round(glBalance * 100) / 100,
        bankStatementBalance: Math.round(bankBalance * 100) / 100,
        difference:         Math.round((glBalance - bankBalance) * 100) / 100,
        unreconciledCount:  unreconciled.length,
        unreconciledTotal:  Math.round(unreconciledTotal * 100) / 100,
        transactions:       bankTxns
      }
    });
  })
);

// Mark transaction as reconciled
router.post('/reports/bank-reconciliation/reconcile',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { transactionIds } = req.body;
    await Banking.updateMany(
      { _id: { $in: transactionIds } },
      { $set: { isReconciled: true, reconciledAt: new Date(), reconciledBy: req.user.id } }
    );
    res.json({ success: true, message: `${transactionIds.length} transactions reconciled` });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// COST CENTER P&L REPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/cost-center-pl',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const mongoose = require('mongoose');
    const { costCenterId, fromDate, toDate } = req.query;
    const match = { status: 'posted' };
    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) match.date.$gte = new Date(fromDate);
      if (toDate)   match.date.$lte = new Date(toDate);
    }

    const pipeline = [
      { $match: { status: 'posted', ...(match.date ? { date: match.date } : {}) } },
      { $unwind: '$lines' },
      ...(costCenterId ? [{ $match: { 'lines.costCenter': new mongoose.Types.ObjectId(costCenterId) } }] : [{ $match: { 'lines.costCenter': { $exists: true, $ne: null } } }]),
      {
        $lookup: {
          from: 'accounts', localField: 'lines.account', foreignField: '_id', as: 'accDoc'
        }
      },
      { $unwind: '$accDoc' },
      {
        $group: {
          _id: { costCenter: '$lines.costCenter', accountType: '$accDoc.type' },
          totalDebit:  { $sum: '$lines.debit' },
          totalCredit: { $sum: '$lines.credit' }
        }
      },
      {
        $lookup: {
          from: 'costcenters', localField: '_id.costCenter', foreignField: '_id', as: 'ccDoc'
        }
      },
      { $unwind: { path: '$ccDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id.costCenter',
          costCenterName: { $first: '$ccDoc.name' },
          costCenterCode: { $first: '$ccDoc.code' },
          lines: {
            $push: {
              accountType: '$_id.accountType',
              totalDebit: '$totalDebit',
              totalCredit: '$totalCredit'
            }
          }
        }
      },
      { $sort: { costCenterName: 1 } }
    ];

    const data = await JournalEntry.aggregate(pipeline);
    res.json({ success: true, data });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET vs ACTUAL REPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/budget-vs-actual',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const mongoose = require('mongoose');
    const CostCenter = require('../models/procurement/CostCenter');
    const { fromDate, toDate } = req.query;

    const costCenters = await CostCenter.find({ isActive: true }).populate('department', 'name');

    const dateMatch = {};
    if (fromDate) dateMatch.$gte = new Date(fromDate);
    if (toDate)   dateMatch.$lte = new Date(toDate);

    // Actual expenditure per cost center from GL
    const actuals = await JournalEntry.aggregate([
      { $match: { status: 'posted', ...(Object.keys(dateMatch).length ? { date: dateMatch } : {}) } },
      { $unwind: '$lines' },
      { $match: { 'lines.costCenter': { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'accounts', localField: 'lines.account', foreignField: '_id', as: 'accDoc'
        }
      },
      { $unwind: '$accDoc' },
      { $match: { 'accDoc.type': { $in: ['expense', 'cost_of_goods_sold'] } } },
      {
        $group: {
          _id: '$lines.costCenter',
          actualExpenses: { $sum: '$lines.debit' }
        }
      }
    ]);

    const actualsMap = {};
    actuals.forEach(a => { actualsMap[a._id.toString()] = a.actualExpenses; });

    const result = costCenters.map(cc => {
      const actual = actualsMap[cc._id.toString()] || 0;
      const budget = cc.budget || 0;
      const variance = budget - actual;
      return {
        _id:             cc._id,
        code:            cc.code,
        name:            cc.name,
        department:      cc.department?.name,
        budgetPeriod:    cc.budgetPeriod,
        budget:          Math.round(budget * 100) / 100,
        actual:          Math.round(actual * 100) / 100,
        variance:        Math.round(variance * 100) / 100,
        variancePct:     budget > 0 ? Math.round((variance / budget) * 10000) / 100 : null,
        overBudget:      actual > budget
      };
    });

    const totalBudget = result.reduce((s, r) => s + r.budget, 0);
    const totalActual = result.reduce((s, r) => s + r.actual, 0);

    res.json({
      success: true,
      data: {
        rows: result,
        totals: {
          budget:   Math.round(totalBudget * 100) / 100,
          actual:   Math.round(totalActual * 100) / 100,
          variance: Math.round((totalBudget - totalActual) * 100) / 100
        }
      }
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// AGED PAYABLES REPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/aged-payables',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const asOf = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();

    const bills = await AccountsPayable.find({ status: { $in: ['pending', 'partial'] } })
      .populate('supplier', 'name code');

    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 };
    const rows = bills.map(b => {
      const daysOutstanding = Math.floor((asOf - new Date(b.dueDate || b.createdAt)) / 86400000);
      const balance = b.balance || 0;
      let bucket = 'current';
      if (daysOutstanding > 90) bucket = 'over90';
      else if (daysOutstanding > 60) bucket = 'days61_90';
      else if (daysOutstanding > 30) bucket = 'days31_60';
      else if (daysOutstanding > 0)  bucket = 'days1_30';
      buckets[bucket] = Math.round((buckets[bucket] + balance) * 100) / 100;
      return { _id: b._id, reference: b.referenceNumber, supplier: b.supplier, dueDate: b.dueDate, balance, daysOutstanding, bucket };
    });

    res.json({ success: true, data: { asOfDate: asOf, rows, buckets } });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// AGED RECEIVABLES REPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/aged-receivables',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const asOf = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();

    const invoices = await AccountsReceivable.find({ status: { $in: ['pending', 'partial'] } })
      .populate('customer', 'name code');

    const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 };
    const rows = invoices.map(inv => {
      const daysOutstanding = Math.floor((asOf - new Date(inv.dueDate || inv.createdAt)) / 86400000);
      const balance = inv.balance || 0;
      let bucket = 'current';
      if (daysOutstanding > 90) bucket = 'over90';
      else if (daysOutstanding > 60) bucket = 'days61_90';
      else if (daysOutstanding > 30) bucket = 'days31_60';
      else if (daysOutstanding > 0)  bucket = 'days1_30';
      buckets[bucket] = Math.round((buckets[bucket] + balance) * 100) / 100;
      return { _id: inv._id, reference: inv.referenceNumber, customer: inv.customer, dueDate: inv.dueDate, balance, daysOutstanding, bucket };
    });

    res.json({ success: true, data: { asOfDate: asOf, rows, buckets } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// CREDIT NOTES — Customer Refunds / Invoice Corrections
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/finance/accounts-receivable/:id/credit-note
router.post('/accounts-receivable/:id/credit-note',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const invoice = await AccountsReceivable.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const { amount, reason, date } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Credit note amount is required' });

    const creditAmount = Math.min(Number(amount), invoice.totalAmount);
    const creditNoteNumber = `CN-${invoice.invoiceNumber}`;

    // Create a negative AR entry (Credit Note)
    const creditNote = new AccountsReceivable({
      invoiceNumber: creditNoteNumber,
      customer: { name: invoice.customer?.name || 'Customer', email: invoice.customer?.email || '', customerId: invoice.customer?.customerId },
      invoiceDate: date ? new Date(date) : new Date(),
      dueDate: date ? new Date(date) : new Date(),
      totalAmount: -creditAmount,
      subtotal: -creditAmount,
      status: 'paid',
      department: invoice.department,
      module: invoice.module,
      referenceId: invoice._id,
      referenceType: 'invoice',
      lineItems: [{ description: reason || `Credit Note for ${invoice.invoiceNumber}`, quantity: 1, unitPrice: -creditAmount }],
      notes: reason || `Credit note reversal for invoice ${invoice.invoiceNumber}`,
      createdBy: req.user._id
    });
    await creditNote.save();

    // Journal: DR Revenue (or AR) / CR AR — reversal
    const arAccount = await FinanceHelper.getAccountByNumber(FinanceHelper.ACCOUNTS.RECEIVABLE);
    const revenueAccount = await FinanceHelper.getAccountByNumber('4001');

    if (arAccount && revenueAccount) {
      await FinanceHelper.createAndPostJournalEntry({
        date: creditNote.invoiceDate,
        reference: creditNoteNumber,
        description: `Credit Note: ${creditNoteNumber} – ${reason || 'Customer refund'}`,
        department: invoice.department,
        module: invoice.module,
        referenceId: creditNote._id,
        referenceType: 'invoice',
        journalCode: 'INV',
        createdBy: req.user._id,
        lines: [
          { account: revenueAccount._id, description: `Revenue reversal – ${creditNoteNumber}`, debit: creditAmount, department: invoice.department },
          { account: arAccount._id, description: `AR credit – ${creditNoteNumber}`, credit: creditAmount, department: invoice.department }
        ]
      });
    }

    res.status(201).json({
      success: true,
      message: `Credit Note ${creditNoteNumber} created for PKR ${creditAmount}`,
      data: creditNote
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// SALES ORDER → AR INVOICE (one-click, Odoo-style)
// ═════════════════════════════════════════════════════════════════════════════
const SalesOrder = require('../models/sales/SalesOrder');

// POST /api/finance/sales-orders/:orderId/create-invoice
router.post('/sales-orders/:orderId/create-invoice',
  authorize('super_admin', 'admin', 'finance_manager', 'sales_manager'),
  asyncHandler(async (req, res) => {
    const mongoose = require('mongoose');
    const order = await SalesOrder.findById(req.params.orderId)
      .populate('customer', 'name email phone');
    if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });
    if (order.billingStatus === 'fully_invoiced') {
      return res.status(400).json({ success: false, message: 'This sales order is already fully invoiced' });
    }

    const { dueDate, notes } = req.body;
    const invoiceNumber = `INV-${order.orderNumber}`;

    const lineItems = (order.items || []).map(item => ({
      description: `${item.productName} – SO ${order.orderNumber}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: order.taxRate || 0
    }));

    const subtotal = lineItems.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const taxAmount = Math.round(subtotal * ((order.taxRate || 0) / 100) * 100) / 100;
    const totalAmount = subtotal + taxAmount - (order.discount || 0);

    const billDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const arInvoice = await FinanceHelper.createARFromInvoice({
      customerName:  order.customer?.name || order.customerName || 'Customer',
      customerEmail: order.customer?.email || '',
      customerId:    order.customer?._id || null,
      invoiceNumber,
      invoiceDate:   order.orderDate || new Date(),
      dueDate:       billDueDate,
      amount:        totalAmount,
      taxAmount,
      department:    'sales',
      module:        'sales',
      referenceId:   order._id,
      referenceType: 'invoice',
      lineItems,
      notes:         notes || `Auto-generated from Sales Order ${order.orderNumber}`,
      createdBy:     req.user._id
    });

    // Mark sales order as invoiced
    order.billingStatus = 'fully_invoiced';
    order.arInvoice     = arInvoice._id;
    await order.save();

    res.status(201).json({
      success: true,
      message: `Invoice ${invoiceNumber} created from Sales Order ${order.orderNumber}`,
      data: { invoice: arInvoice, order: { _id: order._id, orderNumber: order.orderNumber, billingStatus: order.billingStatus } }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// YEAR-END CLOSING
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/finance/year-end-closing — transfer net income to Retained Earnings
router.post('/year-end-closing',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { year, retainedEarningsAccountId } = req.body;
    if (!year) return res.status(400).json({ success: false, message: 'Year is required' });

    const from = new Date(`${year}-01-01`);
    const to   = new Date(`${year}-12-31T23:59:59.999Z`);

    // Aggregate income/expense balances for the year
    const rows = await JournalEntry.aggregate([
      { $match: { status: 'posted', date: { $gte: from, $lte: to } } },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.account', totalDebit: { $sum: '$lines.debit' }, totalCredit: { $sum: '$lines.credit' } } },
      { $lookup: { from: 'accounts', localField: '_id', foreignField: '_id', as: 'acc' } },
      { $unwind: '$acc' },
      { $match: { 'acc.type': { $in: ['revenue', 'income', 'other_income', 'expense', 'cost_of_goods_sold', 'operating_expense', 'other_expense', 'depreciation'] } } },
      { $project: { accountType: '$acc.type', totalDebit: 1, totalCredit: 1,
        balance: { $cond: {
          if: { $in: ['$acc.type', ['expense','cost_of_goods_sold','operating_expense','other_expense','depreciation']] },
          then: { $subtract: ['$totalDebit','$totalCredit'] },
          else: { $subtract: ['$totalCredit','$totalDebit'] }
        }}
      }}
    ]);

    const revenueTypes = ['revenue','income','other_income'];
    const totalRevenue  = rows.filter(r => revenueTypes.includes(r.accountType)).reduce((s,r) => s+(r.balance||0), 0);
    const totalExpenses = rows.filter(r => !revenueTypes.includes(r.accountType)).reduce((s,r) => s+(r.balance||0), 0);
    const netIncome     = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    if (Math.abs(netIncome) < 0.01) {
      return res.json({ success: true, message: 'Net income is zero — no closing entry needed', data: { netIncome } });
    }

    // Resolve retained earnings account
    let reAccount = retainedEarningsAccountId
      ? await Account.findById(retainedEarningsAccountId)
      : await Account.findOne({ accountNumber: '3002' }); // Retained Earnings default
    if (!reAccount) reAccount = await Account.findOne({ type: { $in: ['retained_earnings','equity'] } });
    if (!reAccount) return res.status(400).json({ success: false, message: 'Retained Earnings account not found. Please provide retainedEarningsAccountId.' });

    // Close income/expense accounts via a closing entry
    // Net profit: DR Revenue accounts / CR Retained Earnings (net income > 0)
    //             DR Retained Earnings / CR Expense accounts  (conceptually balanced)
    // Simplified: single line closing entry for the net
    const closingLines = netIncome > 0
      ? [
          { account: reAccount._id, description: `Net profit for ${year} transferred to Retained Earnings`, credit: netIncome, department: 'finance' },
          // Placeholder debit to Income Summary (use a clearing approach)
          // In practice this balances via the revenue/expense accounts already closed
        ]
      : [];

    if (netIncome > 0) {
      // Use a simple closing: DR Income Summary concept — post net income to retained earnings
      const revAccount = await Account.findOne({ type: { $in: ['revenue','income'] } });
      if (revAccount) {
        await FinanceHelper.createAndPostJournalEntry({
          date: new Date(`${year}-12-31`),
          reference: `CLOSE-${year}`,
          description: `Year-End Closing — Net Income for ${year}`,
          department: 'finance',
          module: 'finance',
          referenceType: 'adjustment',
          journalCode: 'GEN',
          createdBy: req.user._id,
          lines: [
            { account: revAccount._id, description: `Closing revenue to retained earnings`, debit: netIncome, department: 'finance' },
            { account: reAccount._id,  description: `Net income ${year} — retained earnings`, credit: netIncome, department: 'finance' }
          ]
        });
      }
    } else {
      const expAccount = await Account.findOne({ type: { $in: ['expense','operating_expense'] } });
      if (expAccount) {
        await FinanceHelper.createAndPostJournalEntry({
          date: new Date(`${year}-12-31`),
          reference: `CLOSE-${year}`,
          description: `Year-End Closing — Net Loss for ${year}`,
          department: 'finance',
          module: 'finance',
          referenceType: 'adjustment',
          journalCode: 'GEN',
          createdBy: req.user._id,
          lines: [
            { account: reAccount._id,  description: `Net loss ${year} — retained earnings`, debit: Math.abs(netIncome), department: 'finance' },
            { account: expAccount._id, description: `Closing expense to retained earnings`, credit: Math.abs(netIncome), department: 'finance' }
          ]
        });
      }
    }

    res.json({
      success: true,
      message: `Year-End closing entry posted for ${year}. Net ${netIncome >= 0 ? 'Income' : 'Loss'}: PKR ${Math.abs(netIncome).toLocaleString()}`,
      data: { year, netIncome, totalRevenue: Math.round(totalRevenue*100)/100, totalExpenses: Math.round(totalExpenses*100)/100 }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// CASH FLOW STATEMENT
// ═════════════════════════════════════════════════════════════════════════════
router.get('/reports/cash-flow',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { fromDate, toDate } = req.query;
    const from = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const to   = toDate   ? new Date(toDate)   : new Date();

    // Operating: P&L accounts + AR/AP changes
    // Investing: Fixed Asset / Capex accounts
    // Financing: Equity + Long-term Liability changes

    const operatingTypes  = ['revenue','income','other_income','expense','cost_of_goods_sold','operating_expense','other_expense','depreciation','accounts_receivable','accounts_payable','current_asset','current_liability'];
    const investingTypes  = ['fixed_asset','other_asset'];
    const financingTypes  = ['equity','long_term_liability','retained_earnings','owners_equity'];

    const allRows = await JournalEntry.aggregate([
      { $match: { status: 'posted', date: { $gte: from, $lte: to } } },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.account', totalDebit: { $sum: '$lines.debit' }, totalCredit: { $sum: '$lines.credit' } } },
      { $lookup: { from: 'accounts', localField: '_id', foreignField: '_id', as: 'acc' } },
      { $unwind: '$acc' },
      { $project: { accountNumber: '$acc.accountNumber', accountName: '$acc.name', accountType: '$acc.type', totalDebit: 1, totalCredit: 1,
          netFlow: { $subtract: ['$totalCredit', '$totalDebit'] }
      }},
      { $sort: { accountNumber: 1 } }
    ]);

    const operating  = allRows.filter(r => operatingTypes.some(t => r.accountType?.includes(t)));
    const investing  = allRows.filter(r => investingTypes.some(t => r.accountType?.includes(t)));
    const financing  = allRows.filter(r => financingTypes.some(t => r.accountType?.includes(t)));

    const totalOperating = Math.round(operating.reduce((s,r)  => s+(r.netFlow||0), 0)*100)/100;
    const totalInvesting = Math.round(investing.reduce((s,r)  => s+(r.netFlow||0), 0)*100)/100;
    const totalFinancing = Math.round(financing.reduce((s,r)  => s+(r.netFlow||0), 0)*100)/100;
    const netCashChange  = Math.round((totalOperating + totalInvesting + totalFinancing)*100)/100;

    res.json({
      success: true,
      data: {
        fromDate: from, toDate: to,
        operating:  { rows: operating,  total: totalOperating },
        investing:  { rows: investing,  total: totalInvesting },
        financing:  { rows: financing,  total: totalFinancing },
        summary: { totalOperating, totalInvesting, totalFinancing, netCashChange }
      }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// BILL FROM GRN — Three-Way Match
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/finance/grn/:grnId/create-bill
// Creates a vendor AP bill from a GRN in one click (Odoo-style)
router.post('/grn/:grnId/create-bill',
  authorize('super_admin', 'admin', 'finance_manager', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const grn = await GoodsReceive.findById(req.params.grnId)
      .populate('supplier', 'name email phone')
      .populate('purchaseOrder', 'poNumber');

    if (!grn) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (grn.billingStatus === 'fully_billed') {
      return res.status(400).json({ success: false, message: 'This GRN is already fully billed' });
    }

    const { vendorInvoiceNumber, dueDate, notes } = req.body;

    // Build line items from GRN items
    const lineItems = grn.items.map(item => ({
      description: `${item.itemName} (${item.itemCode}) — GRN ${grn.receiveNumber}`,
      quantity:  item.quantity,
      unitPrice: item.unitPrice || 0,
      taxRate:   0
    }));

    const subtotal = lineItems.reduce((s, l) => s + (l.quantity * l.unitPrice), 0);
    const billNumber = `BILL-${grn.receiveNumber}`;

    // Build due date (30 days default)
    const billDueDate = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create AP bill via FinanceHelper (posts GRNI → AP journal)
    const apBill = await FinanceHelper.createAPFromBill({
      vendorName:  grn.supplierName || grn.supplier?.name || 'Unknown Vendor',
      vendorEmail: grn.supplier?.email || '',
      vendorId:    grn.supplier?._id || null,
      billNumber,
      vendorInvoiceNumber: vendorInvoiceNumber || '',
      billDate:    grn.receiveDate || new Date(),
      dueDate:     billDueDate,
      amount:      subtotal,
      department:  'procurement',
      module:      'procurement',
      referenceId: grn._id,
      referenceType: 'grn',
      lineItems,
      notes:       notes || `Auto-generated from GRN ${grn.receiveNumber}`,
      createdBy:   req.user._id
    });

    // Update GRN billing status
    grn.billingStatus    = 'fully_billed';
    grn.vendorBill       = apBill._id;
    grn.vendorBillNumber = billNumber;
    await grn.save();

    res.status(201).json({
      success: true,
      message: `Vendor bill ${billNumber} created from GRN ${grn.receiveNumber}`,
      data: { bill: apBill, grn: { _id: grn._id, receiveNumber: grn.receiveNumber, billingStatus: grn.billingStatus } }
    });
  })
);

// GET /api/finance/grn/:grnId/billing-status
router.get('/grn/:grnId/billing-status',
  authorize('super_admin', 'admin', 'finance_manager', 'procurement_manager'),
  asyncHandler(async (req, res) => {
    const grn = await GoodsReceive.findById(req.params.grnId)
      .select('receiveNumber billingStatus vendorBill vendorBillNumber financePosted')
      .populate('vendorBill', 'billNumber totalAmount status');
    if (!grn) return res.status(404).json({ success: false, message: 'GRN not found' });
    res.json({ success: true, data: grn });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRY REVERSAL
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/finance/journal-entries/:id/reverse
router.post('/journal-entries/:id/reverse',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const original = await JournalEntry.findById(req.params.id).populate('lines.account');
    if (!original) return res.status(404).json({ success: false, message: 'Journal entry not found' });
    if (original.status !== 'posted') {
      return res.status(400).json({ success: false, message: 'Only posted entries can be reversed' });
    }
    if (original.isReversed) {
      return res.status(400).json({ success: false, message: 'This entry has already been reversed' });
    }

    const { date, reason } = req.body;
    const reversalDate = date ? new Date(date) : new Date();

    // Mirror lines: swap debit ↔ credit
    const reversalLines = original.lines.map(line => ({
      account:     line.account._id || line.account,
      description: `Reversal: ${line.description || ''}`,
      debit:       line.credit,
      credit:      line.debit,
      department:  line.department,
      costCenter:  line.costCenter
    }));

    const reversalEntry = await FinanceHelper.createAndPostJournalEntry({
      date:          reversalDate,
      reference:     `REV-${original.entryNumber}`,
      description:   reason || `Reversal of ${original.entryNumber}`,
      department:    original.department,
      module:        original.module,
      referenceId:   original._id,
      referenceType: original.referenceType,
      journalCode:   'GEN',
      createdBy:     req.user.id,
      lines:         reversalLines
    });

    // Mark original as reversed
    original.isReversed   = true;
    original.reversalEntry = reversalEntry._id;
    original.status        = 'reversed';
    await original.save();

    res.json({
      success: true,
      message: `Entry ${original.entryNumber} reversed — reversal entry ${reversalEntry.entryNumber} created`,
      data: { original, reversal: reversalEntry }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// BALANCE SHEET REPORT
// ═════════════════════════════════════════════════════════════════════════════
router.get('/reports/balance-sheet',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const asOf = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();

    // Aggregate balances from posted journal entries
    const rows = await JournalEntry.aggregate([
      { $match: { status: 'posted', date: { $lte: asOf } } },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.account', totalDebit: { $sum: '$lines.debit' }, totalCredit: { $sum: '$lines.credit' } } },
      { $lookup: { from: 'accounts', localField: '_id', foreignField: '_id', as: 'acc' } },
      { $unwind: '$acc' },
      {
        $project: {
          accountNumber: '$acc.accountNumber',
          accountName:   '$acc.name',
          accountType:   '$acc.type',
          normalBalance: '$acc.normalBalance',
          totalDebit:    1,
          totalCredit:   1,
          balance: {
            $cond: {
              if: { $in: ['$acc.normalBalance', ['debit']] },
              then: { $subtract: ['$totalDebit', '$totalCredit'] },
              else: { $subtract: ['$totalCredit', '$totalDebit'] }
            }
          }
        }
      },
      { $sort: { accountNumber: 1 } }
    ]);

    // Group into BS sections
    const assetTypes    = ['asset', 'current_asset', 'fixed_asset', 'other_asset', 'bank', 'cash'];
    const liabTypes     = ['liability', 'current_liability', 'long_term_liability', 'accounts_payable'];
    const equityTypes   = ['equity', 'retained_earnings', 'owners_equity'];

    const assets      = rows.filter(r => assetTypes.some(t => r.accountType?.toLowerCase().includes(t)));
    const liabilities = rows.filter(r => liabTypes.some(t => r.accountType?.toLowerCase().includes(t)));
    const equity      = rows.filter(r => equityTypes.some(t => r.accountType?.toLowerCase().includes(t)));

    const totalAssets      = assets.reduce((s, r) => s + (r.balance || 0), 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + (r.balance || 0), 0);
    const totalEquity      = equity.reduce((s, r) => s + (r.balance || 0), 0);

    res.json({
      success: true,
      data: {
        asOfDate:   asOf,
        assets:     { rows: assets,      total: Math.round(totalAssets * 100) / 100 },
        liabilities: { rows: liabilities, total: Math.round(totalLiabilities * 100) / 100 },
        equity:     { rows: equity,       total: Math.round(totalEquity * 100) / 100 },
        totals: {
          totalAssets:      Math.round(totalAssets * 100) / 100,
          totalLiabilities: Math.round(totalLiabilities * 100) / 100,
          totalEquity:      Math.round(totalEquity * 100) / 100,
          liabilitiesAndEquity: Math.round((totalLiabilities + totalEquity) * 100) / 100,
          isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1
        }
      }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// PROFIT & LOSS REPORT
// ═════════════════════════════════════════════════════════════════════════════
router.get('/reports/profit-loss',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { fromDate, toDate } = req.query;
    const from = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const to   = toDate   ? new Date(toDate)   : new Date();

    const rows = await JournalEntry.aggregate([
      { $match: { status: 'posted', date: { $gte: from, $lte: to } } },
      { $unwind: '$lines' },
      { $group: { _id: '$lines.account', totalDebit: { $sum: '$lines.debit' }, totalCredit: { $sum: '$lines.credit' } } },
      { $lookup: { from: 'accounts', localField: '_id', foreignField: '_id', as: 'acc' } },
      { $unwind: '$acc' },
      {
        $match: {
          'acc.type': {
            $in: ['revenue', 'income', 'other_income', 'expense', 'cost_of_goods_sold',
                  'operating_expense', 'other_expense', 'depreciation']
          }
        }
      },
      {
        $project: {
          accountNumber: '$acc.accountNumber',
          accountName:   '$acc.name',
          accountType:   '$acc.type',
          totalDebit:    1,
          totalCredit:   1,
          balance: {
            $cond: {
              if: { $in: ['$acc.type', ['expense', 'cost_of_goods_sold', 'operating_expense', 'other_expense', 'depreciation']] },
              then: { $subtract: ['$totalDebit', '$totalCredit'] },
              else: { $subtract: ['$totalCredit', '$totalDebit'] }
            }
          }
        }
      },
      { $sort: { accountNumber: 1 } }
    ]);

    const revenueTypes = ['revenue', 'income', 'other_income'];
    const expenseTypes = ['expense', 'cost_of_goods_sold', 'operating_expense', 'other_expense', 'depreciation'];

    const revenue  = rows.filter(r => revenueTypes.includes(r.accountType));
    const expenses = rows.filter(r => expenseTypes.includes(r.accountType));

    const totalRevenue  = revenue.reduce((s, r) => s + (r.balance || 0), 0);
    const totalExpenses = expenses.reduce((s, r) => s + (r.balance || 0), 0);
    const netProfit     = totalRevenue - totalExpenses;

    res.json({
      success: true,
      data: {
        fromDate: from,
        toDate:   to,
        revenue:  { rows: revenue,  total: Math.round(totalRevenue * 100) / 100 },
        expenses: { rows: expenses, total: Math.round(totalExpenses * 100) / 100 },
        totals: {
          totalRevenue:  Math.round(totalRevenue * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          netProfit:     Math.round(netProfit * 100) / 100,
          isProfitable:  netProfit >= 0
        }
      }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// TAX SUMMARY / FBR REPORT
// ═════════════════════════════════════════════════════════════════════════════
router.get('/reports/tax-summary',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { fromDate, toDate } = req.query;
    const from = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const to   = toDate   ? new Date(toDate)   : new Date();

    // Input tax (GST paid on purchases)
    const inputTaxBills = await AccountsPayable.find({
      createdAt: { $gte: from, $lte: to },
      taxAmount: { $gt: 0 }
    }).select('billNumber vendor totalAmount taxAmount subtotal createdAt');

    // Output tax (GST collected on sales)
    const AccountsReceivable = require('../models/finance/AccountsReceivable');
    const outputTaxInvoices = await AccountsReceivable.find({
      createdAt: { $gte: from, $lte: to },
      taxAmount: { $gt: 0 }
    }).select('invoiceNumber customerName amount taxAmount createdAt');

    const totalInputTax  = inputTaxBills.reduce((s, b) => s + (b.taxAmount || 0), 0);
    const totalOutputTax = outputTaxInvoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const netTaxPayable  = totalOutputTax - totalInputTax;

    res.json({
      success: true,
      data: {
        fromDate: from,
        toDate:   to,
        inputTax: {
          rows:  inputTaxBills,
          total: Math.round(totalInputTax * 100) / 100
        },
        outputTax: {
          rows:  outputTaxInvoices,
          total: Math.round(totalOutputTax * 100) / 100
        },
        summary: {
          totalInputTax:  Math.round(totalInputTax * 100) / 100,
          totalOutputTax: Math.round(totalOutputTax * 100) / 100,
          netTaxPayable:  Math.round(netTaxPayable * 100) / 100,
          isRefundable:   netTaxPayable < 0
        }
      }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// OPENING BALANCES
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/finance/opening-balances — post opening balances as a special journal entry
router.post('/opening-balances',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { date, lines, notes } = req.body;

    if (!lines || lines.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one balance line is required' });
    }

    // Validate balance: debits must equal credits
    const totalDebits  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
    const totalCredits = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Opening balances must balance. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}, Difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)}`
      });
    }

    const entry = await FinanceHelper.createAndPostJournalEntry({
      date:          date ? new Date(date) : new Date(),
      reference:     'OPEN-BAL',
      description:   notes || 'Opening balances — system setup',
      department:    'finance',
      module:        'finance',
      referenceType: 'adjustment',
      journalCode:   'GEN',
      createdBy:     req.user.id,
      lines:         lines.map(l => ({
        account:     l.account,
        description: l.description || 'Opening balance',
        debit:       Number(l.debit)  || 0,
        credit:      Number(l.credit) || 0,
        department:  'finance'
      }))
    });

    res.status(201).json({
      success: true,
      message: 'Opening balances posted successfully',
      data: entry
    });
  })
);

// GET /api/finance/opening-balances — get all opening balance entries
router.get('/opening-balances',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const entries = await JournalEntry.find({ reference: 'OPEN-BAL' })
      .populate('lines.account', 'name accountNumber type')
      .populate('createdBy', 'name')
      .sort({ date: -1 });
    res.json({ success: true, data: entries });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOMER PAYMENTS — all AR receipts consolidated
// ═════════════════════════════════════════════════════════════════════════════
router.get('/customer-payments',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { fromDate, toDate, search } = req.query;

    // Match AR docs that have at least one payment recorded
    const match = { 'payments.0': { $exists: true } };
    if (fromDate || toDate) {
      match['payments.paymentDate'] = {};
      if (fromDate) match['payments.paymentDate'].$gte = new Date(fromDate);
      if (toDate)   match['payments.paymentDate'].$lte = new Date(toDate);
    }

    const records = await AccountsReceivable.find(match)
      .select('invoiceNumber customer payments paidAmount totalAmount department')
      .sort({ 'payments.paymentDate': -1 })
      .lean();

    // Flatten payments array across all invoices
    const payments = [];
    for (const inv of records) {
      for (const p of (inv.payments || [])) {
        const payDate = p.paymentDate ? new Date(p.paymentDate) : null;
        if (fromDate && payDate && payDate < new Date(fromDate)) continue;
        if (toDate   && payDate && payDate > new Date(toDate))   continue;
        if (search) {
          const q = search.toLowerCase();
          const matches = inv.customer?.name?.toLowerCase().includes(q)
            || inv.invoiceNumber?.toLowerCase().includes(q)
            || p.reference?.toLowerCase().includes(q);
          if (!matches) continue;
        }
        payments.push({
          _id:           p._id,
          invoiceNumber: inv.invoiceNumber,
          customerName:  inv.customer?.name || '—',
          customerEmail: inv.customer?.email || '',
          paymentDate:   p.paymentDate,
          amount:        p.amount,
          paymentMethod: p.paymentMethod,
          reference:     p.reference,
          department:    inv.department,
          invoiceId:     inv._id
        });
      }
    }

    // Sort by date desc
    payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    const totalAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
    res.json({ success: true, data: { payments, totalAmount: Math.round(totalAmount * 100) / 100, count: payments.length } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// CREDIT NOTES — all AR credit notes (negative-amount AR entries)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/credit-notes',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { fromDate, toDate, search } = req.query;
    const match = { totalAmount: { $lt: 0 } };   // credit notes are stored as negative
    if (fromDate || toDate) {
      match.invoiceDate = {};
      if (fromDate) match.invoiceDate.$gte = new Date(fromDate);
      if (toDate)   match.invoiceDate.$lte = new Date(toDate);
    }
    if (search) {
      match.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }

    const notes = await AccountsReceivable.find(match)
      .select('invoiceNumber customer invoiceDate totalAmount paidAmount status notes department referenceId')
      .sort({ invoiceDate: -1 })
      .lean();

    const total = notes.reduce((s, n) => s + Math.abs(n.totalAmount || 0), 0);
    res.json({ success: true, data: { notes, total: Math.round(total * 100) / 100, count: notes.length } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// VENDOR PAYMENTS — all AP payments consolidated
// ═════════════════════════════════════════════════════════════════════════════
router.get('/vendor-payments',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { fromDate, toDate, search } = req.query;

    const match = { 'payments.0': { $exists: true } };
    const records = await AccountsPayable.find(match)
      .select('billNumber vendor payments amountPaid totalAmount department')
      .sort({ 'payments.paymentDate': -1 })
      .lean();

    const payments = [];
    for (const bill of records) {
      for (const p of (bill.payments || [])) {
        const payDate = p.paymentDate ? new Date(p.paymentDate) : null;
        if (fromDate && payDate && payDate < new Date(fromDate)) continue;
        if (toDate   && payDate && payDate > new Date(toDate))   continue;
        if (search) {
          const q = search.toLowerCase();
          const matches = bill.vendor?.name?.toLowerCase().includes(q)
            || bill.billNumber?.toLowerCase().includes(q)
            || p.reference?.toLowerCase().includes(q);
          if (!matches) continue;
        }
        payments.push({
          _id:           p._id,
          billNumber:    bill.billNumber,
          vendorName:    bill.vendor?.name || bill.vendor || '—',
          vendorEmail:   bill.vendor?.email || '',
          paymentDate:   p.paymentDate,
          amount:        p.amount,
          paymentMethod: p.paymentMethod,
          reference:     p.reference,
          department:    bill.department,
          billId:        bill._id
        });
      }
    }

    payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    const totalAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
    res.json({ success: true, data: { payments, totalAmount: Math.round(totalAmount * 100) / 100, count: payments.length } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// VENDOR REFUNDS — purchase returns with finance impact
// ═════════════════════════════════════════════════════════════════════════════
router.get('/vendor-refunds',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const PurchaseReturn = require('../models/procurement/PurchaseReturn');
    const { fromDate, toDate, search, status } = req.query;

    const match = {};
    if (status) match.status = status;
    if (fromDate || toDate) {
      match.returnDate = {};
      if (fromDate) match.returnDate.$gte = new Date(fromDate);
      if (toDate)   match.returnDate.$lte = new Date(toDate);
    }
    if (search) {
      match.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } }
      ];
    }

    const returns = await PurchaseReturn.find(match)
      .populate('supplier', 'name email')
      .populate('goodsReceive', 'grnNumber receiveDate')
      .populate('purchaseOrder', 'orderNumber')
      .populate('journalEntry', 'entryNumber status')
      .sort({ returnDate: -1 })
      .lean();

    const total = returns.reduce((s, r) => s + (r.totalAmount || 0), 0);
    res.json({ success: true, data: { returns, total: Math.round(total * 100) / 100, count: returns.length } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// BILL TO RECEIVE — GRNs received but not yet billed (accrual gap)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/bill-to-receive',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const GoodsReceive = require('../models/procurement/GoodsReceive');
    const { fromDate, toDate, search } = req.query;

    const match = { billingStatus: 'waiting_bills', status: { $in: ['Received', 'Complete', 'Partial'] } };
    if (fromDate || toDate) {
      match.receiveDate = {};
      if (fromDate) match.receiveDate.$gte = new Date(fromDate);
      if (toDate)   match.receiveDate.$lte = new Date(toDate);
    }
    if (search) {
      match.$or = [
        { grnNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const grns = await GoodsReceive.find(match)
      .populate('purchaseOrder', 'orderNumber totalAmount vendor')
      .populate('receivedBy', 'firstName lastName')
      .select('grnNumber receiveDate purchaseOrder receivedBy totalValue billingStatus status items notes')
      .sort({ receiveDate: -1 })
      .lean();

    // Compute accrual value: sum of received items (qty * unitPrice)
    const enriched = grns.map(grn => {
      const accrualValue = (grn.items || []).reduce((s, i) => {
        return s + ((i.receivedQuantity || i.quantity || 0) * (i.unitPrice || i.rate || 0));
      }, 0);
      return { ...grn, accrualValue: Math.round(accrualValue * 100) / 100 };
    });

    const totalAccrual = enriched.reduce((s, g) => s + g.accrualValue, 0);
    res.json({ success: true, data: { grns: enriched, totalAccrual: Math.round(totalAccrual * 100) / 100, count: enriched.length } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// BILLED NOT RECEIVED — AP bills where GRN not yet received (reverse accrual)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/billed-not-received',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const GoodsReceive = require('../models/procurement/GoodsReceive');
    const { fromDate, toDate, search } = req.query;

    // AP bills that were created from a PO but no GRN links back to them
    const match = { status: { $in: ['draft', 'pending', 'approved'] } };
    if (fromDate || toDate) {
      match.billDate = {};
      if (fromDate) match.billDate.$gte = new Date(fromDate);
      if (toDate)   match.billDate.$lte = new Date(toDate);
    }
    if (search) {
      match.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { 'vendor.name': { $regex: search, $options: 'i' } }
      ];
    }

    const bills = await AccountsPayable.find(match)
      .select('billNumber billDate dueDate vendor totalAmount amountPaid status purchaseOrder department')
      .sort({ billDate: -1 })
      .lean();

    // Filter: bills linked to a PO that has no fully-received GRN
    const enriched = [];
    for (const bill of bills) {
      if (!bill.purchaseOrder) {
        // Manual bill with no PO — include as billed-not-received
        enriched.push({ ...bill, grnStatus: 'no_po', grnCount: 0 });
        continue;
      }
      const grnCount = await GoodsReceive.countDocuments({
        purchaseOrder: bill.purchaseOrder,
        status: { $in: ['Received', 'Complete'] }
      });
      if (grnCount === 0) {
        enriched.push({ ...bill, grnStatus: 'not_received', grnCount: 0 });
      }
    }

    const total = enriched.reduce((s, b) => s + ((b.totalAmount || 0) - (b.amountPaid || 0)), 0);
    res.json({ success: true, data: { bills: enriched, total: Math.round(total * 100) / 100, count: enriched.length } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// RECURRING JOURNAL ENTRIES
// ═════════════════════════════════════════════════════════════════════════════

// GET all recurring journals
router.get('/recurring-journals',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const journals = await RecurringJournal.find()
      .populate('lines.account', 'accountNumber name type')
      .populate('createdBy', 'firstName lastName')
      .sort({ nextRunDate: 1 })
      .lean();
    res.json({ success: true, data: journals });
  })
);

// GET single recurring journal
router.get('/recurring-journals/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const j = await RecurringJournal.findById(req.params.id)
      .populate('lines.account', 'accountNumber name type')
      .lean();
    if (!j) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: j });
  })
);

// POST create recurring journal
router.post('/recurring-journals',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { name, description, frequency, dayOfMonth, startDate, endDate, journalCode, department, lines, isActive } = req.body;

    if (!lines || lines.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 journal lines required' });
    }
    const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: `Lines not balanced: DR ${totalDebit} ≠ CR ${totalCredit}` });
    }

    const rj = new RecurringJournal({
      name, description, frequency, dayOfMonth, startDate, endDate,
      journalCode: journalCode || 'GEN', department: department || 'finance',
      lines, isActive: isActive !== false, createdBy: req.user.id
    });
    // Set initial nextRunDate = startDate
    rj.nextRunDate = new Date(startDate);
    await rj.save();
    res.status(201).json({ success: true, data: rj, message: 'Recurring journal created' });
  })
);

// PUT update recurring journal
router.put('/recurring-journals/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const rj = await RecurringJournal.findById(req.params.id);
    if (!rj) return res.status(404).json({ success: false, message: 'Not found' });
    const allowed = ['name', 'description', 'frequency', 'dayOfMonth', 'startDate', 'endDate', 'journalCode', 'department', 'lines', 'isActive'];
    allowed.forEach(f => { if (req.body[f] !== undefined) rj[f] = req.body[f]; });
    rj.updatedBy = req.user.id;
    await rj.save();
    res.json({ success: true, data: rj, message: 'Updated' });
  })
);

// DELETE recurring journal
router.delete('/recurring-journals/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    await RecurringJournal.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  })
);

// POST manually trigger / run a recurring journal now
router.post('/recurring-journals/:id/run',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const rj = await RecurringJournal.findById(req.params.id).populate('lines.account', 'accountNumber name type');
    if (!rj) return res.status(404).json({ success: false, message: 'Not found' });

    // Build journal entry
    const entry = await FinanceHelper.createAndPostJournalEntry({
      date:          new Date(),
      reference:     `REC-${rj.name.substring(0, 20).replace(/\s/g, '-')}-${Date.now()}`,
      description:   `[Recurring] ${rj.name}`,
      department:    rj.department || 'finance',
      module:        'manual',
      referenceType: 'manual',
      journalCode:   rj.journalCode || 'GEN',
      createdBy:     req.user.id,
      lines:         rj.lines.map(l => ({
        account:     l.account._id || l.account,
        description: l.description || rj.name,
        debit:       l.debit  || 0,
        credit:      l.credit || 0,
        department:  l.department || rj.department
      }))
    });

    rj.lastRunDate  = new Date();
    rj.runCount     += 1;
    rj.nextRunDate  = rj.computeNextRunDate(new Date());
    rj.postedEntries.push(entry._id);
    await rj.save();

    res.json({ success: true, message: `Journal posted: ${entry.entryNumber}`, data: { entryId: entry._id, entryNumber: entry.entryNumber } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// EMAIL INVOICE — send AR invoice to customer by email
// ═════════════════════════════════════════════════════════════════════════════
router.post('/accounts-receivable/:id/send-email',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const invoice = await AccountsReceivable.findById(req.params.id).lean();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const toEmail = invoice.customer?.email;
    if (!toEmail) return res.status(400).json({ success: false, message: 'Customer has no email address on file' });

    const EmailService = require('../services/emailService');
    const emailSvc = new EmailService();

    const fmt = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const balance = (invoice.totalAmount || 0) - (invoice.amountPaid || invoice.paidAmount || 0);
    const statusColor = { paid: '#2e7d32', partial: '#e65100', overdue: '#c62828', pending: '#1565c0', draft: '#555' };

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
  <!-- Header -->
  <tr><td style="background:#1976d2;padding:28px 32px">
    <table width="100%"><tr>
      <td><span style="color:#fff;font-size:22px;font-weight:900">SGC International</span><br><span style="color:#bbdefb;font-size:13px">Tax Invoice</span></td>
      <td align="right"><span style="color:#fff;font-size:26px;font-weight:700">${invoice.invoiceNumber}</span><br>
        <span style="background:${statusColor[invoice.status]||'#555'};color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700">${(invoice.status||'').toUpperCase()}</span>
      </td>
    </tr></table>
  </td></tr>
  <!-- Bill To -->
  <tr><td style="padding:28px 32px 0">
    <table width="100%"><tr>
      <td width="50%" valign="top">
        <div style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Bill To</div>
        <div style="font-size:16px;font-weight:700;color:#222">${invoice.customer?.name || '—'}</div>
        ${invoice.customer?.email  ? `<div style="color:#555;font-size:13px">${invoice.customer.email}</div>` : ''}
        ${invoice.customer?.phone  ? `<div style="color:#555;font-size:13px">${invoice.customer.phone}</div>` : ''}
        ${invoice.customer?.address? `<div style="color:#555;font-size:13px">${invoice.customer.address}</div>` : ''}
      </td>
      <td width="50%" valign="top" align="right">
        <table cellpadding="3" cellspacing="0">
          <tr><td style="color:#888;font-size:13px">Invoice Date:</td><td style="font-weight:600;font-size:13px;padding-left:8px">${fmtDate(invoice.invoiceDate)}</td></tr>
          <tr><td style="color:#888;font-size:13px">Due Date:</td><td style="font-weight:600;font-size:13px;padding-left:8px;color:${balance>0?'#c62828':'#2e7d32'}">${fmtDate(invoice.dueDate)}</td></tr>
          ${invoice.department ? `<tr><td style="color:#888;font-size:13px">Department:</td><td style="font-weight:600;font-size:13px;padding-left:8px">${invoice.department}</td></tr>` : ''}
        </table>
      </td>
    </tr></table>
  </td></tr>
  <!-- Amount summary -->
  <tr><td style="padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;overflow:hidden">
      <tr style="background:#e3f2fd">
        <td style="padding:10px 16px;font-size:13px;color:#888">Invoice Total</td>
        <td style="padding:10px 16px;font-size:16px;font-weight:800;color:#1565c0;text-align:right">${fmt(invoice.totalAmount)}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;font-size:13px;color:#888">Amount Paid</td>
        <td style="padding:8px 16px;font-size:13px;text-align:right;color:#2e7d32">${fmt(invoice.amountPaid || invoice.paidAmount || 0)}</td>
      </tr>
      <tr style="background:${balance>0?'#ffebee':'#e8f5e9'}">
        <td style="padding:10px 16px;font-size:14px;font-weight:700;color:${balance>0?'#c62828':'#2e7d32'}">Balance Due</td>
        <td style="padding:10px 16px;font-size:18px;font-weight:900;color:${balance>0?'#c62828':'#2e7d32'};text-align:right">${fmt(balance)}</td>
      </tr>
    </table>
  </td></tr>
  ${invoice.notes ? `<tr><td style="padding:0 32px 16px"><div style="background:#fffde7;border-left:4px solid #fbc02d;padding:12px 16px;border-radius:4px;font-size:13px;color:#555"><strong>Notes:</strong> ${invoice.notes}</div></td></tr>` : ''}
  <!-- Footer -->
  <tr><td style="padding:20px 32px;background:#f5f5f5;border-top:1px solid #e0e0e0;text-align:center">
    <div style="font-size:12px;color:#999">SGC International &bull; tax@sgc.international &bull; www.sgc.international</div>
    <div style="font-size:11px;color:#bbb;margin-top:4px">Please retain this invoice for your records.</div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    await emailSvc.transporter.sendMail({
      from: `"SGC International Finance" <${emailSvc.getFromAddress()}>`,
      to: toEmail,
      subject: `Invoice ${invoice.invoiceNumber} — SGC International`,
      html
    });

    res.json({ success: true, message: `Invoice emailed to ${toEmail}` });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// BUDGET MANAGEMENT (CRUD)
// ═════════════════════════════════════════════════════════════════════════════
const Budget = require('../models/finance/Budget');

router.get('/budgets',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { fiscalYear, department, status } = req.query;
    const filter = {};
    if (fiscalYear)  filter.fiscalYear  = Number(fiscalYear);
    if (department)  filter.department  = department;
    if (status)      filter.status      = status;
    const budgets = await Budget.find(filter)
      .populate('lines.account', 'name accountNumber type')
      .populate('createdBy', 'name')
      .sort({ fiscalYear: -1, name: 1 });
    res.json({ success: true, data: budgets });
  })
);

router.get('/budgets/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const budget = await Budget.findById(req.params.id)
      .populate('lines.account', 'name accountNumber type')
      .populate('createdBy', 'name').populate('approvedBy', 'name');
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    res.json({ success: true, data: budget });
  })
);

router.post('/budgets',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const budget = await Budget.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: budget, message: 'Budget created' });
  })
);

router.put('/budgets/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    if (budget.status === 'locked') return res.status(400).json({ success: false, message: 'Budget is locked' });
    const allowed = ['name', 'fiscalYear', 'startDate', 'endDate', 'department', 'description', 'status', 'lines'];
    allowed.forEach(f => { if (req.body[f] !== undefined) budget[f] = req.body[f]; });
    if (req.body.status === 'approved') { budget.approvedBy = req.user.id; budget.approvedAt = new Date(); }
    budget.updatedBy = req.user.id;
    await budget.save();
    res.json({ success: true, data: budget, message: 'Budget updated' });
  })
);

router.delete('/budgets/:id',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });
    if (budget.status === 'locked') return res.status(400).json({ success: false, message: 'Cannot delete locked budget' });
    await budget.deleteOne();
    res.json({ success: true, message: 'Budget deleted' });
  })
);

// Budget vs Actual (account-level, using Budget model)
router.get('/reports/budget-vs-actual-detailed',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { budgetId } = req.query;
    if (!budgetId) return res.status(400).json({ success: false, message: 'budgetId is required' });

    const budget = await Budget.findById(budgetId).populate('lines.account', 'name accountNumber type');
    if (!budget) return res.status(404).json({ success: false, message: 'Budget not found' });

    // Get actual GL for the budget period
    const actualRows = await GeneralLedger.aggregate([
      { $match: { status: 'posted', date: { $gte: budget.startDate, $lte: budget.endDate }, ...(budget.department ? { department: budget.department } : {}) } },
      { $lookup: { from: 'accounts', localField: 'account', foreignField: '_id', as: 'acc' } },
      { $unwind: '$acc' },
      { $match: { 'acc.type': { $in: ['Expense', 'Revenue'] } } },
      { $group: { _id: '$account', totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' }, type: { $first: '$acc.type' } } }
    ]);

    const actualMap = {};
    actualRows.forEach(r => { actualMap[r._id.toString()] = r; });

    const lines = budget.lines.map(l => {
      const actual = actualMap[l.account?._id?.toString()] || {};
      const type   = l.account?.type;
      const actualAmt = type === 'Revenue'
        ? (actual.totalCredit || 0) - (actual.totalDebit || 0)
        : (actual.totalDebit || 0) - (actual.totalCredit || 0);
      const variance = l.budgetAmount - actualAmt;
      return {
        accountId:    l.account?._id,
        accountName:  l.account?.name || l.accountName,
        accountNumber:l.account?.accountNumber,
        accountType:  type,
        budgetAmount: l.budgetAmount,
        actualAmount: Math.round(actualAmt * 100) / 100,
        variance:     Math.round(variance * 100) / 100,
        variancePct:  l.budgetAmount > 0 ? Math.round((variance / l.budgetAmount) * 10000) / 100 : null,
        overBudget:   actualAmt > l.budgetAmount
      };
    });

    const totalBudget = lines.reduce((s, l) => s + l.budgetAmount, 0);
    const totalActual = lines.reduce((s, l) => s + l.actualAmount, 0);

    res.json({ success: true, data: { budget, lines, totals: { totalBudget, totalActual, variance: totalBudget - totalActual } } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// DEFERRED REVENUE / EXPENSES
// ═════════════════════════════════════════════════════════════════════════════
const DeferredEntry = require('../models/finance/DeferredEntry');

router.get('/deferred-entries',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { type, status } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    const entries = await DeferredEntry.find(filter)
      .populate('deferredAccount', 'name accountNumber')
      .populate('recognitionAccount', 'name accountNumber')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: entries });
  })
);

router.get('/deferred-entries/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const entry = await DeferredEntry.findById(req.params.id)
      .populate('deferredAccount', 'name accountNumber')
      .populate('recognitionAccount', 'name accountNumber')
      .populate('schedule.journalEntry', 'entryNumber date');
    if (!entry) return res.status(404).json({ success: false, message: 'Deferred entry not found' });
    res.json({ success: true, data: entry });
  })
);

router.post('/deferred-entries',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const entry = new DeferredEntry({ ...req.body, createdBy: req.user.id });
    entry.generateSchedule();
    await entry.save();
    res.status(201).json({ success: true, data: entry, message: 'Deferred entry created with recognition schedule' });
  })
);

router.delete('/deferred-entries/:id',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const entry = await DeferredEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
    if (entry.recognizedAmount > 0) return res.status(400).json({ success: false, message: 'Cannot delete entry with posted recognitions' });
    await entry.deleteOne();
    res.json({ success: true, message: 'Deferred entry deleted' });
  })
);

// Manually recognize a specific schedule line
router.post('/deferred-entries/:id/recognize/:lineId',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const entry = await DeferredEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    const line = entry.schedule.id(req.params.lineId);
    if (!line) return res.status(404).json({ success: false, message: 'Schedule line not found' });
    if (line.status === 'posted') return res.status(400).json({ success: false, message: 'Already posted' });

    const isRevenue = entry.type === 'deferred_revenue';
    const je = await FinanceHelper.createAndPostJournalEntry({
      date:          new Date(),
      reference:     `DEFERRED-${entry._id}-${line.period}`,
      description:   `${isRevenue ? 'Revenue' : 'Expense'} Recognition – ${entry.name} (${line.period})`,
      department:    entry.department || 'finance',
      module:        'finance',
      referenceId:   entry._id,
      referenceType: 'deferred',
      journalCode:   isRevenue ? 'REV' : 'GEN',
      createdBy:     req.user.id,
      lines: isRevenue
        ? [
            { account: entry.deferredAccount,    description: `Deferred revenue – ${entry.name}`, debit:  line.amount, department: entry.department },
            { account: entry.recognitionAccount, description: `Revenue recognized – ${entry.name}`,credit: line.amount, department: entry.department }
          ]
        : [
            { account: entry.recognitionAccount, description: `Expense recognized – ${entry.name}`,  debit:  line.amount, department: entry.department },
            { account: entry.deferredAccount,    description: `Deferred expense – ${entry.name}`,    credit: line.amount, department: entry.department }
          ]
    });

    line.journalEntry = je._id;
    line.postedAt     = new Date();
    line.status       = 'posted';
    entry.markModified('schedule');
    await entry.save();

    res.json({ success: true, message: `Period ${line.period} recognized`, data: entry });
  })
);

// Run recognition for current month (manual trigger)
router.post('/deferred-entries/run-recognition',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { runDeferredEntryRecognition } = require('../utils/deferredEntryCron');
    const results = await runDeferredEntryRecognition();
    res.json({ success: true, message: `Recognition run – ${results.posted} posted`, data: results });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// BANK STATEMENT IMPORT (CSV / Excel)
// ═════════════════════════════════════════════════════════════════════════════
router.post('/banking/import-statement',
  authorize('super_admin', 'admin', 'finance_manager'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const XLSX    = require('xlsx');
    const Banking = require('../models/finance/Banking');
    const { bankAccountId, dateColumn = 'Date', descColumn = 'Description',
            debitColumn = 'Debit', creditColumn = 'Credit', balanceColumn = 'Balance' } = req.body;

    if (!bankAccountId) return res.status(400).json({ success: false, message: 'bankAccountId is required' });

    const account = await Banking.findById(bankAccountId);
    if (!account) return res.status(404).json({ success: false, message: 'Bank account not found' });

    // Parse file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });

    const imported = [];
    const skipped  = [];

    for (const row of rows) {
      try {
        const rawDate = row[dateColumn] || row['date'] || row['DATE'] || row['Transaction Date'];
        const desc    = row[descColumn]  || row['description'] || row['DESC'] || row['Narration'] || '';
        const debit   = parseFloat((row[debitColumn]  || row['debit']  || row['DEBIT']  || '0').toString().replace(/,/g, '')) || 0;
        const credit  = parseFloat((row[creditColumn] || row['credit'] || row['CREDIT'] || '0').toString().replace(/,/g, '')) || 0;
        const balance = parseFloat((row[balanceColumn]|| row['balance']|| row['BALANCE']|| '0').toString().replace(/,/g, '')) || undefined;

        if (!rawDate) { skipped.push({ row, reason: 'No date' }); continue; }

        const txDate = new Date(rawDate);
        if (isNaN(txDate)) { skipped.push({ row, reason: 'Invalid date' }); continue; }
        if (debit === 0 && credit === 0) { skipped.push({ row, reason: 'Zero amount' }); continue; }

        const amount = credit - debit;
        const type   = amount >= 0 ? 'credit' : 'debit';

        // Avoid duplicate imports
        const exists = account.transactions?.some(t =>
          t.date?.toISOString().split('T')[0] === txDate.toISOString().split('T')[0] &&
          Math.abs((t.amount || 0) - Math.abs(amount)) < 0.01 &&
          (t.description || '').toLowerCase().includes((desc || '').toLowerCase().substring(0, 10))
        );
        if (exists) { skipped.push({ row, reason: 'Duplicate' }); continue; }

        account.transactions = account.transactions || [];
        account.transactions.push({
          date: txDate,
          description: desc,
          amount: Math.abs(amount),
          type,
          balance,
          reference: row['Ref'] || row['Reference'] || row['Cheque No'] || '',
          status: 'unreconciled',
          source: 'imported',
          createdBy: req.user.id
        });

        imported.push({ date: txDate, description: desc, amount: Math.abs(amount), type });
      } catch (err) {
        skipped.push({ reason: err.message });
      }
    }

    // Recalculate running balance
    if (account.transactions?.length) {
      const lastTx = account.transactions[account.transactions.length - 1];
      if (lastTx?.balance) account.currentBalance = lastTx.balance;
    }

    await account.save();

    // Clean up temp file
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Imported ${imported.length} transaction(s), skipped ${skipped.length}`,
      data: { imported: imported.length, skipped: skipped.length, skippedRows: skipped.slice(0, 10) }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// BATCH VENDOR PAYMENTS
// ═════════════════════════════════════════════════════════════════════════════
router.post('/accounts-payable/batch-payment',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { billIds, paymentMethod, reference, date, bankAccountId, whtRate = 0 } = req.body;

    if (!billIds || !Array.isArray(billIds) || billIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No bills selected' });
    }

    const results = [];
    const errors  = [];

    for (const billId of billIds) {
      try {
        const bill = await AccountsPayable.findById(billId);
        if (!bill) { errors.push({ billId, error: 'Bill not found' }); continue; }
        if (bill.status === 'paid') { errors.push({ billId: bill.billNumber, error: 'Already paid' }); continue; }

        const balance = Math.round((bill.totalAmount - (bill.amountPaid || 0)) * 100) / 100;
        if (balance <= 0) continue;

        await FinanceHelper.recordAPPayment(billId, {
          amount:        balance,
          paymentMethod: paymentMethod || 'bank_transfer',
          reference:     reference || `BATCH-${Date.now()}`,
          date:          date ? new Date(date) : new Date(),
          createdBy:     req.user.id,
          whtRate:       Number(whtRate) || 0,
          bankAccountId
        });

        results.push({ billId, billNumber: bill.billNumber, vendor: bill.vendor?.name || '—', amount: balance });
      } catch (err) {
        errors.push({ billId, error: err.message });
      }
    }

    const total = results.reduce((s, r) => s + r.amount, 0);
    res.json({
      success: true,
      message: `${results.length} bill(s) paid | Total: PKR ${total.toLocaleString()}`,
      data: { paid: results, errors, total: Math.round(total * 100) / 100 }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// COMPANY PROFILE — GET / PUT via SystemSettings singleton
// ═════════════════════════════════════════════════════════════════════════════
router.get('/company-profile',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const SystemSettings = require('../models/general/SystemSettings');
    const settings = await SystemSettings.getSingleton();
    res.json({ success: true, data: settings.companyProfile || {} });
  })
);

router.put('/company-profile',
  authorize('super_admin', 'admin'),
  asyncHandler(async (req, res) => {
    const SystemSettings = require('../models/general/SystemSettings');
    const settings = await SystemSettings.getSingleton();
    const allowed = ['name', 'legalName', 'ntn', 'strn', 'address', 'city', 'country',
                     'phone', 'email', 'website', 'logoUrl', 'currency',
                     'bankName', 'bankAccount', 'bankIBAN', 'invoiceFooter'];
    if (!settings.companyProfile) settings.companyProfile = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) settings.companyProfile[f] = req.body[f]; });
    settings.updatedBy = req.user.id;
    settings.markModified('companyProfile');
    await settings.save();
    res.json({ success: true, data: settings.companyProfile, message: 'Company profile saved' });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// COMPARATIVE PROFIT & LOSS — two periods side-by-side
// ═════════════════════════════════════════════════════════════════════════════
router.get('/reports/comparative-pl',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { p1From, p1To, p2From, p2To } = req.query;

    const getPeriodData = async (fromDate, toDate) => {
      const match = { status: 'posted' };
      if (fromDate) match.date = { ...(match.date || {}), $gte: new Date(fromDate) };
      if (toDate)   match.date = { ...(match.date || {}), $lte: new Date(toDate) };

      const rows = await GeneralLedger.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'accounts', localField: 'account', foreignField: '_id', as: 'acc'
          }
        },
        { $unwind: '$acc' },
        { $match: { 'acc.type': { $in: ['Revenue', 'Expense'] } } },
        {
          $group: {
            _id: '$account',
            accountName:   { $first: '$acc.name' },
            accountNumber: { $first: '$acc.accountNumber' },
            accountType:   { $first: '$acc.type' },
            totalDebit:    { $sum: '$debit' },
            totalCredit:   { $sum: '$credit' }
          }
        },
        { $sort: { accountNumber: 1 } }
      ]);

      const revenue  = rows.filter(r => r.accountType === 'Revenue');
      const expenses = rows.filter(r => r.accountType === 'Expense');
      const totalRev = revenue.reduce((s, r)  => s + ((r.totalCredit || 0) - (r.totalDebit || 0)), 0);
      const totalExp = expenses.reduce((s, r) => s + ((r.totalDebit || 0) - (r.totalCredit || 0)), 0);
      return { revenue, expenses, totalRevenue: totalRev, totalExpenses: totalExp, netProfit: totalRev - totalExp };
    };

    const [period1, period2] = await Promise.all([
      getPeriodData(p1From, p1To),
      getPeriodData(p2From, p2To)
    ]);

    // Merge account lists for aligned display
    const allAccIds = new Set([
      ...period1.revenue.map(r => r._id?.toString()),
      ...period2.revenue.map(r => r._id?.toString()),
      ...period1.expenses.map(r => r._id?.toString()),
      ...period2.expenses.map(r => r._id?.toString())
    ]);

    res.json({
      success: true,
      data: {
        period1: { from: p1From, to: p1To, ...period1 },
        period2: { from: p2From, to: p2To, ...period2 }
      }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// DEPARTMENT / COST-CENTER P&L — proper revenue vs expense by dept
// ═════════════════════════════════════════════════════════════════════════════
router.get('/reports/department-pl',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { department, fromDate, toDate } = req.query;

    const match = { status: 'posted' };
    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) match.date.$gte = new Date(fromDate);
      if (toDate)   match.date.$lte = new Date(toDate);
    }
    if (department) match.department = department;

    const rows = await GeneralLedger.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'accounts', localField: 'account', foreignField: '_id', as: 'acc'
        }
      },
      { $unwind: '$acc' },
      { $match: { 'acc.type': { $in: ['Revenue', 'Expense'] } } },
      {
        $group: {
          _id: { account: '$account', dept: '$department' },
          accountName:   { $first: '$acc.name' },
          accountNumber: { $first: '$acc.accountNumber' },
          accountType:   { $first: '$acc.type' },
          department:    { $first: '$department' },
          totalDebit:    { $sum: '$debit' },
          totalCredit:   { $sum: '$credit' }
        }
      },
      { $sort: { '_id.dept': 1, accountNumber: 1 } }
    ]);

    // Group by department
    const byDept = {};
    for (const r of rows) {
      const dept = r.department || 'General';
      if (!byDept[dept]) byDept[dept] = { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
      const balance = r.accountType === 'Revenue'
        ? (r.totalCredit || 0) - (r.totalDebit || 0)
        : (r.totalDebit || 0) - (r.totalCredit || 0);
      const entry = { accountName: r.accountName, accountNumber: r.accountNumber, balance };
      if (r.accountType === 'Revenue') {
        byDept[dept].revenue.push(entry);
        byDept[dept].totalRevenue += balance;
      } else {
        byDept[dept].expenses.push(entry);
        byDept[dept].totalExpenses += balance;
      }
    }
    Object.values(byDept).forEach(d => { d.netProfit = d.totalRevenue - d.totalExpenses; });

    // Also return all unique departments for filter dropdown
    const allDepts = await GeneralLedger.distinct('department', { status: 'posted' });

    res.json({ success: true, data: { byDept, departments: allDepts.filter(Boolean).sort() } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// FINANCE ADMIN — RESET & SEED (super_admin only)
// ═════════════════════════════════════════════════════════════════════════════

// Reset all transactional finance data (keeps config like taxes, journals, payment terms)
router.post('/admin/reset-finance',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const { confirm } = req.body;
    if (confirm !== 'RESET_FINANCE') {
      return res.status(400).json({ success: false, message: 'Send { confirm: "RESET_FINANCE" } to confirm' });
    }

    const Inventory      = require('../models/procurement/Inventory');
    const SalesOrder     = require('../models/sales/SalesOrder');
    const DeferredEntry  = require('../models/finance/DeferredEntry');
    const Budget         = require('../models/finance/Budget');
    const FixedAsset     = require('../models/finance/FixedAsset');

    const results = {};

    // 1. Clear all transactional finance collections
    results.journalEntries   = (await JournalEntry.deleteMany({})).deletedCount;
    results.generalLedger    = (await GeneralLedger.deleteMany({})).deletedCount;
    results.accountsPayable  = (await AccountsPayable.deleteMany({})).deletedCount;
    results.accountsReceivable = (await AccountsReceivable.deleteMany({})).deletedCount;
    results.recurringJournals  = (await RecurringJournal.deleteMany({})).deletedCount;
    results.deferredEntries    = (await DeferredEntry.deleteMany({})).deletedCount;
    results.budgets            = (await Budget.deleteMany({})).deletedCount;
    results.fixedAssets        = (await FixedAsset.deleteMany({})).deletedCount;

    // 2. Clear Chart of Accounts
    results.accounts = (await Account.deleteMany({})).deletedCount;

    // 3. Clear banking transactions but keep bank account records intact
    await Banking.updateMany({}, { $set: { transactions: [], currentBalance: 0, availableBalance: 0 } });
    results.bankingTransactions = 'cleared (accounts kept)';

    // 4. Reset procurement finance flags on GRNs
    const GRN = require('../models/procurement/GoodsReceive');
    await GRN.updateMany({}, {
      $unset: { vendorBill: 1, vendorBillNumber: 1, journalEntry: 1 },
      $set: { billingStatus: 'waiting_bills', financePosted: false }
    });
    results.grnsReset = 'billingStatus reset, finance links cleared';

    // 5. Reset AR invoice links on Sales Orders
    await SalesOrder.updateMany({}, {
      $unset: { arInvoice: 1, arInvoiceNumber: 1 },
      $set: { billingStatus: 'not_billed' }
    });
    results.salesOrdersReset = 'AR invoice links cleared';

    // 6. Reset inventory stock quantities and costs to zero
    await Inventory.updateMany({}, {
      $set: { quantity: 0, averageCost: 0, totalValue: 0, status: 'out_of_stock', stockTransactions: [] }
    });
    results.inventoryReset = 'all stock quantities and costs reset to zero';

    console.log('[FinanceReset] Complete reset performed by:', req.user?.email);
    res.json({ success: true, message: '✅ Finance module fully reset. Ready for fresh setup.', data: results });
  })
);

// Seed standard Pakistan-ready Chart of Accounts
router.post('/admin/seed-accounts',
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    // Check if accounts already exist
    const existing = await Account.countDocuments();
    if (existing > 0) {
      return res.status(400).json({
        success: false,
        message: `${existing} accounts already exist. Reset finance first, or delete accounts manually.`
      });
    }

    const uid = req.user.id;

    const standardAccounts = [
      // ── ASSETS ──────────────────────────────────────────────────────
      // Current Assets
      { accountNumber: '1010', name: 'Cash in Hand',                  type: 'Asset',     category: 'Current Asset',   isSystemAccount: false },
      { accountNumber: '1020', name: 'Bank Account – Main (HBL)',     type: 'Asset',     category: 'Current Asset',   isSystemAccount: true  },
      { accountNumber: '1030', name: 'Bank Account – Secondary',      type: 'Asset',     category: 'Current Asset',   isSystemAccount: false },
      { accountNumber: '1100', name: 'Accounts Receivable',           type: 'Asset',     category: 'Current Asset',   isSystemAccount: true  },
      { accountNumber: '1110', name: 'Advance to Suppliers',          type: 'Asset',     category: 'Current Asset',   isSystemAccount: false },
      { accountNumber: '1200', name: 'Raw Materials Inventory',       type: 'Asset',     category: 'Current Asset',   isSystemAccount: true  },
      { accountNumber: '1210', name: 'Work in Progress',              type: 'Asset',     category: 'Current Asset',   isSystemAccount: false },
      { accountNumber: '1220', name: 'Finished Goods Inventory',      type: 'Asset',     category: 'Current Asset',   isSystemAccount: false },
      { accountNumber: '1300', name: 'GST Input Tax Recoverable',     type: 'Asset',     category: 'Current Asset',   isSystemAccount: true  },
      { accountNumber: '1310', name: 'Prepaid Expenses',              type: 'Asset',     category: 'Current Asset',   isSystemAccount: false },
      { accountNumber: '1320', name: 'Other Current Assets',          type: 'Asset',     category: 'Current Asset',   isSystemAccount: false },
      // Non-Current Assets
      { accountNumber: '1500', name: 'Land & Buildings',              type: 'Asset',     category: 'Fixed Asset',     isSystemAccount: false },
      { accountNumber: '1510', name: 'Plant & Machinery',             type: 'Asset',     category: 'Fixed Asset',     isSystemAccount: false },
      { accountNumber: '1520', name: 'Vehicles',                      type: 'Asset',     category: 'Fixed Asset',     isSystemAccount: false },
      { accountNumber: '1530', name: 'Furniture & Fixtures',          type: 'Asset',     category: 'Fixed Asset',     isSystemAccount: false },
      { accountNumber: '1540', name: 'Computer & IT Equipment',       type: 'Asset',     category: 'Fixed Asset',     isSystemAccount: false },
      { accountNumber: '1590', name: 'Accumulated Depreciation',      type: 'Asset',     category: 'Fixed Asset',     isSystemAccount: true  },

      // ── LIABILITIES ─────────────────────────────────────────────────
      // Current Liabilities
      { accountNumber: '2100', name: 'Accounts Payable',              type: 'Liability', category: 'Current Liability', isSystemAccount: true  },
      { accountNumber: '2110', name: 'WHT Payable (FBR)',             type: 'Liability', category: 'Current Liability', isSystemAccount: true  },
      { accountNumber: '2120', name: 'GST / Sales Tax Payable',       type: 'Liability', category: 'Current Liability', isSystemAccount: true  },
      { accountNumber: '2130', name: 'Salary & Wages Payable',        type: 'Liability', category: 'Current Liability', isSystemAccount: true  },
      { accountNumber: '2140', name: 'GRNI – Goods Received Not Invoiced', type: 'Liability', category: 'Current Liability', isSystemAccount: true },
      { accountNumber: '2150', name: 'Advance from Customers',        type: 'Liability', category: 'Current Liability', isSystemAccount: false },
      { accountNumber: '2160', name: 'Deferred Revenue',              type: 'Liability', category: 'Current Liability', isSystemAccount: false },
      { accountNumber: '2170', name: 'EOBI Payable',                  type: 'Liability', category: 'Current Liability', isSystemAccount: false },
      { accountNumber: '2180', name: 'PESSI / SESSI Payable',         type: 'Liability', category: 'Current Liability', isSystemAccount: false },
      { accountNumber: '2190', name: 'Other Current Liabilities',     type: 'Liability', category: 'Current Liability', isSystemAccount: false },
      // Non-Current Liabilities
      { accountNumber: '2500', name: 'Long-Term Loan',                type: 'Liability', category: 'Long-term Liability', isSystemAccount: false },

      // ── EQUITY ──────────────────────────────────────────────────────
      { accountNumber: '3000', name: 'Share Capital',                 type: 'Equity',    category: 'Equity',          isSystemAccount: false },
      { accountNumber: '3100', name: 'Retained Earnings',             type: 'Equity',    category: 'Equity',          isSystemAccount: true  },
      { accountNumber: '3200', name: 'Current Year Profit / Loss',    type: 'Equity',    category: 'Equity',          isSystemAccount: true  },
      { accountNumber: '3300', name: 'Owner Drawings',                type: 'Equity',    category: 'Equity',          isSystemAccount: false },

      // ── REVENUE ─────────────────────────────────────────────────────
      { accountNumber: '4000', name: 'Sales Revenue',                 type: 'Revenue',   category: 'Revenue',         isSystemAccount: true  },
      { accountNumber: '4100', name: 'Service Revenue',               type: 'Revenue',   category: 'Revenue',         isSystemAccount: false },
      { accountNumber: '4200', name: 'Other Income',                  type: 'Revenue',   category: 'Revenue',         isSystemAccount: false },
      { accountNumber: '4300', name: 'Interest Income',               type: 'Revenue',   category: 'Revenue',         isSystemAccount: false },

      // ── EXPENSES ────────────────────────────────────────────────────
      // Cost of Goods Sold
      { accountNumber: '5000', name: 'Cost of Goods Sold (COGS)',     type: 'Expense',   category: 'Cost of Revenue', isSystemAccount: true  },
      { accountNumber: '5100', name: 'Direct Materials Cost',         type: 'Expense',   category: 'Cost of Revenue', isSystemAccount: false },
      { accountNumber: '5200', name: 'Direct Labour Cost',            type: 'Expense',   category: 'Cost of Revenue', isSystemAccount: false },
      // Operating Expenses
      { accountNumber: '6000', name: 'Salaries & Wages',              type: 'Expense',   category: 'Operating Expense', isSystemAccount: true },
      { accountNumber: '6010', name: 'EOBI Expense',                  type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6020', name: 'PESSI / SESSI Expense',         type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6100', name: 'Rent Expense',                  type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6200', name: 'Utilities (Electricity/Gas)',   type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6300', name: 'Fuel & Transport',              type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6400', name: 'Repairs & Maintenance',         type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6500', name: 'Depreciation Expense',          type: 'Expense',   category: 'Operating Expense', isSystemAccount: true  },
      { accountNumber: '6600', name: 'Insurance Expense',             type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6700', name: 'Office Supplies & Stationery',  type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6800', name: 'Communication & Internet',      type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '6900', name: 'Travel & Conveyance',           type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '7000', name: 'Professional Fees (Legal/Audit)',type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '7100', name: 'Bank Charges & Interest',       type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '7200', name: 'Income Tax Expense',            type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
      { accountNumber: '7300', name: 'Miscellaneous Expense',         type: 'Expense',   category: 'Operating Expense', isSystemAccount: false },
    ];

    const created = await Account.insertMany(
      standardAccounts.map(a => ({ ...a, createdBy: uid, description: a.name }))
    );

    res.json({
      success: true,
      message: `✅ ${created.length} standard accounts created successfully`,
      data: {
        total: created.length,
        byType: {
          Assets:      created.filter(a => a.type === 'Asset').length,
          Liabilities: created.filter(a => a.type === 'Liability').length,
          Equity:      created.filter(a => a.type === 'Equity').length,
          Revenue:     created.filter(a => a.type === 'Revenue').length,
          Expenses:    created.filter(a => a.type === 'Expense').length,
        },
        criticalAccounts: created
          .filter(a => a.isSystemAccount)
          .map(a => ({ number: a.accountNumber, name: a.name, type: a.type }))
      }
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRY ATTACHMENTS
// ═════════════════════════════════════════════════════════════════════════════

// Upload attachment to a journal entry
router.post('/journal-entries/:id/attachments',
  authorize('super_admin', 'admin', 'finance_manager'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Journal entry not found' });
    if (!req.file)  return res.status(400).json({ success: false, message: 'No file uploaded' });

    const attachment = {
      filename:     req.file.filename,
      originalName: req.file.originalname,
      path:         `/uploads/finance/${req.file.filename}`,
      uploadedBy:   req.user.id,
      uploadedAt:   new Date(),
      size:         req.file.size,
      mimetype:     req.file.mimetype
    };

    entry.attachments = entry.attachments || [];
    entry.attachments.push(attachment);
    await entry.save();

    res.json({ success: true, message: 'Attachment uploaded', data: attachment });
  })
);

// Delete attachment from a journal entry
router.delete('/journal-entries/:id/attachments/:filename',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    const idx = entry.attachments.findIndex(a => a.filename === req.params.filename);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Attachment not found' });

    // Delete file from disk
    const filePath = path.join(__dirname, '..', 'uploads', 'finance', req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    entry.attachments.splice(idx, 1);
    await entry.save();
    res.json({ success: true, message: 'Attachment deleted' });
  })
);

module.exports = router;
