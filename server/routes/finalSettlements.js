const express = require('express');
const router = express.Router();
const FinalSettlement = require('../models/hr/FinalSettlement');
const Employee = require('../models/hr/Employee');
const Loan = require('../models/hr/Loan');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Get all final settlements with pagination and filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      settlementType,
      department,
      search,
      startDate,
      endDate
    } = req.query;

    const query = {};

    // Add filters
    if (status) query.status = status;
    if (settlementType) query.settlementType = settlementType;
    if (department) query.department = department;

    // Date range filter
    if (startDate || endDate) {
      query.settlementDate = {};
      if (startDate) query.settlementDate.$gte = new Date(startDate);
      if (endDate) query.settlementDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'employee', select: 'employeeId name department designation' },
        { path: 'approvedBy', select: 'name' },
        { path: 'processedBy', select: 'name' }
      ],
      sort: { createdAt: -1 }
    };

    const settlements = await FinalSettlement.paginate(query, options);

    // Add virtual fields to each document
    settlements.docs = settlements.docs.map(doc => {
      const settlement = doc.toObject();
      settlement.settlementProgress = settlement.settlementProgress;
      settlement.noticePeriodShortfallDays = settlement.noticePeriodShortfallDays;
      settlement.totalOutstandingLoans = settlement.totalOutstandingLoans;
      return settlement;
    });

    res.json({
      success: true,
      data: settlements
    });
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settlements',
      error: error.message
    });
  }
});

// Get settlement statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const stats = await FinalSettlement.getSettlementStats();
    
    // Get recent settlements
    const recentSettlements = await FinalSettlement.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('employee', 'employeeId name');

    // Get settlements by type
    const settlementsByType = await FinalSettlement.aggregate([
      {
        $group: {
          _id: '$settlementType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netSettlementAmount' }
        }
      }
    ]);

    // Get settlements by department
    const settlementsByDepartment = await FinalSettlement.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          totalAmount: { $sum: '$netSettlementAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats,
        recentSettlements,
        settlementsByType,
        settlementsByDepartment
      }
    });
  } catch (error) {
    console.error('Error fetching settlement stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settlement statistics',
      error: error.message
    });
  }
});

// Get employee settlements
router.get('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const settlements = await FinalSettlement.find({ employeeId })
      .populate('employee', 'employeeId name department designation')
      .populate('approvedBy', 'name')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: settlements
    });
  } catch (error) {
    console.error('Error fetching employee settlements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee settlements',
      error: error.message
    });
  }
});

// Get settlement by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const settlement = await FinalSettlement.findById(req.params.id)
      .populate('employee', 'employeeId name department designation joiningDate salary')
      .populate('loans.loanId')
      .populate('approvedBy', 'name')
      .populate('processedBy', 'name')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .populate('comments.user', 'name');

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    // Add virtual fields
    const settlementData = settlement.toObject();
    settlementData.settlementProgress = settlement.settlementProgress;
    settlementData.noticePeriodShortfallDays = settlement.noticePeriodShortfallDays;
    settlementData.totalOutstandingLoans = settlement.totalOutstandingLoans;

    res.json({
      success: true,
      data: settlementData
    });
  } catch (error) {
    console.error('Error fetching settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settlement',
      error: error.message
    });
  }
});

// Create new settlement
router.post('/', authMiddleware, checkPermission('settlement_create'), async (req, res) => {
  try {
    const {
      employeeId,
      settlementType,
      reason,
      lastWorkingDate,
      settlementDate,
      noticePeriod,
      noticePeriodServed,
      paymentMethod,
      bankDetails,
      notes
    } = req.body;

    // Get employee details with populated department and position
    const employee = await Employee.findOne({ employeeId })
      .populate('department', 'name')
      .populate('position', 'title');
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get employee's active loans
    const activeLoans = await Loan.find({
      employee: employee._id,
      status: { $in: ['active', 'approved'] }
    });

    // Calculate notice period shortfall
    const noticePeriodShortfall = Math.max(0, noticePeriod - noticePeriodServed);

    // Calculate salary components (you might want to get this from the latest payroll)
    const basicSalary = employee.salary?.basic || 0;
    const grossSalary = employee.salary?.gross || 0;
    const netSalary = employee.salary?.net || 0;

    // Calculate earnings
    const earnings = {
      basicSalary: basicSalary,
      houseRent: employee.salary?.houseRent || 0,
      medicalAllowance: employee.salary?.medicalAllowance || 0,
      conveyanceAllowance: employee.salary?.conveyanceAllowance || 0,
      otherAllowances: employee.salary?.otherAllowances || 0,
      overtime: 0, // Calculate based on actual overtime
      bonus: 0, // Calculate based on company policy
      gratuity: 0, // Calculate based on years of service
      leaveEncashment: 0, // Calculate based on leave balance
      providentFund: 0, // Calculate based on company policy
      eobi: 0 // Calculate based on company policy
    };

    // Calculate deductions
    const deductions = {
      incomeTax: 0, // Calculate based on tax slabs
      providentFund: 0, // Calculate based on company policy
      eobi: 0, // Calculate based on company policy
      loanDeductions: 0, // Will be calculated from loans
      noticePeriodDeduction: 0, // Calculate based on shortfall
      otherDeductions: 0
    };

    // Calculate notice period deduction
    if (noticePeriodShortfall > 0) {
      const dailyRate = basicSalary / 30;
      deductions.noticePeriodDeduction = dailyRate * noticePeriodShortfall;
    }

    // Prepare loan settlements
    const loans = activeLoans.map(loan => ({
      loanId: loan._id,
      loanType: loan.loanType,
      originalAmount: loan.loanAmount,
      outstandingBalance: loan.outstandingBalance,
      settledAmount: 0,
      settlementType: 'pending'
    }));

    // Calculate initial amounts
    const totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);
    const grossSettlementAmount = totalEarnings;
    const netSettlementAmount = grossSettlementAmount - totalDeductions;

    const settlement = new FinalSettlement({
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department?.name || 'Unknown',
      designation: employee.position?.title || 'Unknown',
      settlementType,
      reason,
      noticePeriod,
      noticePeriodServed,
      noticePeriodShortfall,
      lastWorkingDate,
      settlementDate,
      basicSalary,
      grossSalary,
      netSalary,
      earnings,
      deductions,
      loans,
      grossSettlementAmount,
      netSettlementAmount,
      paymentMethod,
      bankDetails,
      notes,
      createdBy: req.user._id
    });

    await settlement.save();

    res.status(201).json({
      success: true,
      message: 'Settlement created successfully',
      data: settlement
    });
  } catch (error) {
    console.error('Error creating settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating settlement',
      error: error.message
    });
  }
});

// Update settlement
router.put('/:id', authMiddleware, checkPermission('settlement_management'), async (req, res) => {
  try {
    const settlement = await FinalSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    // Only allow updates if status is pending
    if (settlement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update settlement that is not pending'
      });
    }

    const updatedSettlement = await FinalSettlement.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Settlement updated successfully',
      data: updatedSettlement
    });
  } catch (error) {
    console.error('Error updating settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settlement',
      error: error.message
    });
  }
});

// Approve settlement
router.patch('/:id/approve', authMiddleware, checkPermission('settlement_approval'), async (req, res) => {
  try {
    const settlement = await FinalSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Settlement is not in pending status'
      });
    }

    settlement.status = 'approved';
    settlement.approvalDate = new Date();
    settlement.approvedBy = req.user._id;
    settlement.updatedBy = req.user._id;

    await settlement.save();

    res.json({
      success: true,
      message: 'Settlement approved successfully',
      data: settlement
    });
  } catch (error) {
    console.error('Error approving settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving settlement',
      error: error.message
    });
  }
});

// Process settlement
router.patch('/:id/process', authMiddleware, checkPermission('settlement_processing'), async (req, res) => {
  try {
    const settlement = await FinalSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Settlement must be approved before processing'
      });
    }

    // Process loan settlements
    settlement.processLoanSettlements();

    settlement.status = 'processed';
    settlement.processedDate = new Date();
    settlement.processedBy = req.user._id;
    settlement.updatedBy = req.user._id;

    await settlement.save();

    res.json({
      success: true,
      message: 'Settlement processed successfully',
      data: settlement
    });
  } catch (error) {
    console.error('Error processing settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing settlement',
      error: error.message
    });
  }
});

// Mark as paid
router.patch('/:id/paid', authMiddleware, checkPermission('settlement_processing'), async (req, res) => {
  try {
    const settlement = await FinalSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.status !== 'processed') {
      return res.status(400).json({
        success: false,
        message: 'Settlement must be processed before marking as paid'
      });
    }

    settlement.status = 'paid';
    settlement.updatedBy = req.user._id;

    await settlement.save();

    res.json({
      success: true,
      message: 'Settlement marked as paid successfully',
      data: settlement
    });
  } catch (error) {
    console.error('Error marking settlement as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking settlement as paid',
      error: error.message
    });
  }
});

// Cancel settlement
router.patch('/:id/cancel', authMiddleware, checkPermission('settlement_management'), async (req, res) => {
  try {
    const settlement = await FinalSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a paid settlement'
      });
    }

    settlement.status = 'cancelled';
    settlement.updatedBy = req.user._id;

    await settlement.save();

    res.json({
      success: true,
      message: 'Settlement cancelled successfully',
      data: settlement
    });
  } catch (error) {
    console.error('Error cancelling settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling settlement',
      error: error.message
    });
  }
});

// Add comment to settlement
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { comment } = req.body;
    
    const settlement = await FinalSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    settlement.comments.push({
      user: req.user._id,
      comment
    });

    await settlement.save();

    res.json({
      success: true,
      message: 'Comment added successfully',
      data: settlement.comments[settlement.comments.length - 1]
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message
    });
  }
});

// Delete settlement (only if pending)
router.delete('/:id', authMiddleware, checkPermission('settlement_management'), async (req, res) => {
  try {
    const settlement = await FinalSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Settlement not found'
      });
    }

    if (settlement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete settlement that is not pending'
      });
    }

    await FinalSettlement.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Settlement deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting settlement:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting settlement',
      error: error.message
    });
  }
});

module.exports = router; 