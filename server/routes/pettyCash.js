const express = require('express');
const router = express.Router();
const PettyCashFund = require('../models/hr/PettyCashFund');
const PettyCashExpense = require('../models/hr/PettyCashExpense');
const Employee = require('../models/hr/Employee');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ========== PETTY CASH FUNDS ==========

// GET /api/petty-cash/funds - Get all petty cash funds
router.get('/funds', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'read'), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fundId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const funds = await PettyCashFund.find(filter)
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PettyCashFund.countDocuments(filter);

    res.json({
      success: true,
      data: funds,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching petty cash funds',
      error: error.message
    });
  }
});

// GET /api/petty-cash/funds/:id - Get single fund
router.get('/funds/:id', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'read'), async (req, res) => {
  try {
    const fund = await PettyCashFund.findById(req.params.id)
      .populate('custodian', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName');

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Petty cash fund not found'
      });
    }

    res.json({
      success: true,
      data: fund
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching petty cash fund',
      error: error.message
    });
  }
});

// POST /api/petty-cash/funds - Create new fund
router.post('/funds', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'create'), async (req, res) => {
  try {
    const fundData = {
      ...req.body,
      createdBy: req.user._id,
      currentBalance: req.body.initialAmount || 0
    };

    const fund = new PettyCashFund(fundData);
    await fund.save();

    const populatedFund = await PettyCashFund.findById(fund._id)
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Petty cash fund created successfully',
      data: populatedFund
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Fund ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating petty cash fund',
      error: error.message
    });
  }
});

// PUT /api/petty-cash/funds/:id - Update fund
router.put('/funds/:id', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'update'), async (req, res) => {
  try {
    const fund = await PettyCashFund.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('custodian', 'firstName lastName employeeId')
     .populate('createdBy', 'firstName lastName');

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Petty cash fund not found'
      });
    }

    res.json({
      success: true,
      message: 'Petty cash fund updated successfully',
      data: fund
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Fund ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating petty cash fund',
      error: error.message
    });
  }
});

// PUT /api/petty-cash/funds/:id/balance - Update fund balance
router.put('/funds/:id/balance', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'update'), async (req, res) => {
  try {
    const { amount, operation } = req.body; // operation: 'add', 'subtract', 'set'

    const fund = await PettyCashFund.findById(req.params.id);
    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Petty cash fund not found'
      });
    }

    let newBalance = fund.currentBalance;
    if (operation === 'add') {
      newBalance += amount;
    } else if (operation === 'subtract') {
      newBalance -= amount;
    } else if (operation === 'set') {
      newBalance = amount;
    }

    fund.currentBalance = Math.max(0, newBalance);
    await fund.save();

    const populatedFund = await PettyCashFund.findById(fund._id)
      .populate('custodian', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Fund balance updated successfully',
      data: populatedFund
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating fund balance',
      error: error.message
    });
  }
});

// DELETE /api/petty-cash/funds/:id - Delete fund
router.delete('/funds/:id', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'delete'), async (req, res) => {
  try {
    const fund = await PettyCashFund.findByIdAndDelete(req.params.id);

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Petty cash fund not found'
      });
    }

    res.json({
      success: true,
      message: 'Petty cash fund deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting petty cash fund',
      error: error.message
    });
  }
});

// ========== PETTY CASH EXPENSES ==========

// GET /api/petty-cash/expenses - Get all expenses
router.get('/expenses', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'read'), async (req, res) => {
  try {
    const { status, category, fundId, search, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (fundId) filter.fundId = fundId;
    if (search) {
      filter.$or = [
        { expenseId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const expenses = await PettyCashExpense.find(filter)
      .populate('fundId', 'fundId name')
      .populate('requestedBy', 'firstName lastName employeeId')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PettyCashExpense.countDocuments(filter);

    res.json({
      success: true,
      data: expenses,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses',
      error: error.message
    });
  }
});

// GET /api/petty-cash/expenses/pending - Get pending expenses
router.get('/expenses/pending', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'read'), async (req, res) => {
  try {
    const expenses = await PettyCashExpense.find({ status: 'Pending' })
      .populate('fundId', 'fundId name')
      .populate('requestedBy', 'firstName lastName employeeId')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: expenses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending expenses',
      error: error.message
    });
  }
});

// GET /api/petty-cash/expenses/:id - Get single expense
router.get('/expenses/:id', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'read'), async (req, res) => {
  try {
    const expense = await PettyCashExpense.findById(req.params.id)
      .populate('fundId', 'fundId name currentBalance')
      .populate('requestedBy', 'firstName lastName employeeId department')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      data: expense
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching expense',
      error: error.message
    });
  }
});

// POST /api/petty-cash/expenses - Create new expense
router.post('/expenses', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'create'), async (req, res) => {
  try {
    const expenseData = {
      ...req.body,
      createdBy: req.user._id
    };

    const expense = new PettyCashExpense(expenseData);
    await expense.save();

    const populatedExpense = await PettyCashExpense.findById(expense._id)
      .populate('fundId', 'fundId name')
      .populate('requestedBy', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: populatedExpense
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Expense ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating expense',
      error: error.message
    });
  }
});

// PUT /api/petty-cash/expenses/:id - Update expense
router.put('/expenses/:id', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'update'), async (req, res) => {
  try {
    const expense = await PettyCashExpense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('fundId', 'fundId name')
     .populate('requestedBy', 'firstName lastName employeeId')
     .populate('approvedBy', 'firstName lastName')
     .populate('createdBy', 'firstName lastName');

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense updated successfully',
      data: expense
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Expense ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating expense',
      error: error.message
    });
  }
});

// PUT /api/petty-cash/expenses/:id/approve - Approve/reject expense
router.put('/expenses/:id/approve', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'approve'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    const expense = await PettyCashExpense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    expense.status = status;
    expense.approvedBy = req.user._id;
    if (status === 'Rejected' && rejectionReason) {
      expense.rejectionReason = rejectionReason;
    }

    await expense.save();

    const populatedExpense = await PettyCashExpense.findById(expense._id)
      .populate('fundId', 'fundId name')
      .populate('requestedBy', 'firstName lastName employeeId')
      .populate('approvedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: `Expense ${status.toLowerCase()} successfully`,
      data: populatedExpense
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating expense status',
      error: error.message
    });
  }
});

// DELETE /api/petty-cash/expenses/:id - Delete expense
router.delete('/expenses/:id', permissions.checkSubRolePermission('admin', 'petty_cash_management', 'delete'), async (req, res) => {
  try {
    const expense = await PettyCashExpense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting expense',
      error: error.message
    });
  }
});

module.exports = router;
