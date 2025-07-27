const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');

const router = express.Router();

// @route   GET /api/payroll
// @desc    Get all payrolls with filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      employeeId,
      startDate,
      endDate,
      payPeriodType
    } = req.query;

    const matchStage = {};
    
    if (status) matchStage.status = status;
    if (employeeId) matchStage.employee = employeeId;
    if (payPeriodType) matchStage['payPeriod.type'] = payPeriodType;
    
    if (startDate && endDate) {
      matchStage['payPeriod.startDate'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const payrolls = await Payroll.find(matchStage)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Payroll.countDocuments(matchStage);

    res.json({
      success: true,
      data: payrolls,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  })
);

// @route   GET /api/payroll/stats
// @desc    Get payroll statistics
// @access  Private (HR and Admin)
router.get('/stats',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, status } = req.query;
    
    const stats = await Payroll.getPayrollStats({
      startDate,
      endDate,
      status
    });

    res.json({
      success: true,
      data: stats
    });
  })
);

// @route   GET /api/payroll/:id
// @desc    Get payroll by ID
// @access  Private (HR and Admin)
router.get('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID format'
      });
    }

    const payroll = await Payroll.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId department position salary')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      data: payroll
    });
  })
);

// @route   POST /api/payroll
// @desc    Create new payroll
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('employee').isMongoId().withMessage('Valid employee ID is required'),
  body('payPeriod.startDate').notEmpty().withMessage('Start date is required'),
  body('payPeriod.endDate').notEmpty().withMessage('End date is required'),
  body('payPeriod.type').isIn(['weekly', 'bi-weekly', 'monthly']).withMessage('Valid pay period type is required'),
  body('basicSalary').isNumeric().withMessage('Valid basic salary is required'),
  body('overtime.hours').optional().isNumeric().withMessage('Overtime hours must be numeric'),
  body('overtime.rate').optional().isNumeric().withMessage('Overtime rate must be numeric')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Check if employee exists
  const employee = await Employee.findById(req.body.employee);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Check for duplicate payroll for the same employee and period
  const existingPayroll = await Payroll.findOne({
    employee: req.body.employee,
    'payPeriod.startDate': new Date(req.body.payPeriod.startDate),
    'payPeriod.endDate': new Date(req.body.payPeriod.endDate)
  });

  if (existingPayroll) {
    return res.status(400).json({
      success: false,
      message: 'Payroll already exists for this employee and pay period'
    });
  }

  const payrollData = {
    ...req.body,
    createdBy: req.user.id,
    payPeriod: {
      startDate: new Date(req.body.payPeriod.startDate),
      endDate: new Date(req.body.payPeriod.endDate),
      type: req.body.payPeriod.type
    },
    basicSalary: parseFloat(req.body.basicSalary) || 0,
    currency: req.body.currency || 'PKR',
    allowances: {
      housing: parseFloat(req.body.allowances?.housing) || 0,
      transport: parseFloat(req.body.allowances?.transport) || 0,
      meal: parseFloat(req.body.allowances?.meal) || 0,
      medical: parseFloat(req.body.allowances?.medical) || 0,
      other: parseFloat(req.body.allowances?.other) || 0
    },
    overtime: {
      hours: parseFloat(req.body.overtime?.hours) || 0,
      rate: parseFloat(req.body.overtime?.rate) || 0,
      amount: 0
    },
    bonuses: {
      performance: parseFloat(req.body.bonuses?.performance) || 0,
      attendance: parseFloat(req.body.bonuses?.attendance) || 0,
      other: parseFloat(req.body.bonuses?.other) || 0
    },
    deductions: {
      tax: parseFloat(req.body.deductions?.tax) || 0,
      insurance: parseFloat(req.body.deductions?.insurance) || 0,
      pension: parseFloat(req.body.deductions?.pension) || 0,
      loan: parseFloat(req.body.deductions?.loan) || 0,
      other: parseFloat(req.body.deductions?.other) || 0
    },
    attendance: {
      totalDays: parseInt(req.body.attendance?.totalDays) || 0,
      presentDays: parseInt(req.body.attendance?.presentDays) || 0,
      absentDays: parseInt(req.body.attendance?.absentDays) || 0,
      lateDays: parseInt(req.body.attendance?.lateDays) || 0,
      halfDays: parseInt(req.body.attendance?.halfDays) || 0
    },
    leaveDeductions: {
      unpaidLeave: parseInt(req.body.leaveDeductions?.unpaidLeave) || 0,
      sickLeave: parseInt(req.body.leaveDeductions?.sickLeave) || 0,
      casualLeave: parseInt(req.body.leaveDeductions?.casualLeave) || 0,
      annualLeave: parseInt(req.body.leaveDeductions?.annualLeave) || 0,
      otherLeave: parseInt(req.body.leaveDeductions?.otherLeave) || 0,
      totalLeaveDays: 0,
      leaveDeductionAmount: 0
    },
    calculations: {
      grossPay: 0,
      totalAllowances: 0,
      totalDeductions: 0,
      netPay: 0
    }
  };

  const payroll = new Payroll(payrollData);
  await payroll.save();

  const populatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'firstName lastName employeeId department position')
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Payroll created successfully',
    data: populatedPayroll
  });
}));

// @route   PUT /api/payroll/:id
// @desc    Update payroll
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('payPeriod.startDate').optional().notEmpty().withMessage('Start date is required'),
  body('payPeriod.endDate').optional().notEmpty().withMessage('End date is required'),
  body('payPeriod.type').optional().isIn(['weekly', 'bi-weekly', 'monthly']).withMessage('Valid pay period type is required'),
  body('basicSalary').optional().isNumeric().withMessage('Valid basic salary is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payroll ID format'
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Payroll not found'
    });
  }

  // Don't allow updates if payroll is already paid
  if (payroll.status === 'paid') {
    return res.status(400).json({
      success: false,
      message: 'Cannot update a paid payroll'
    });
  }

  const updateData = { ...req.body };
  
  // Convert dates if provided
  if (req.body.payPeriod) {
    updateData.payPeriod = {
      startDate: req.body.payPeriod.startDate ? new Date(req.body.payPeriod.startDate) : payroll.payPeriod.startDate,
      endDate: req.body.payPeriod.endDate ? new Date(req.body.payPeriod.endDate) : payroll.payPeriod.endDate,
      type: req.body.payPeriod.type || payroll.payPeriod.type
    };
  }

  // Convert numeric fields
  if (req.body.basicSalary) {
    updateData.basicSalary = parseFloat(req.body.basicSalary);
  }

  const updatedPayroll = await Payroll.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('employee', 'firstName lastName employeeId department position')
   .populate('createdBy', 'firstName lastName')
   .populate('approvedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Payroll updated successfully',
    data: updatedPayroll
  });
}));

// @route   PATCH /api/payroll/:id/approve
// @desc    Approve payroll
// @access  Private (HR and Admin)
router.patch('/:id/approve',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID format'
      });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft payrolls can be approved'
      });
    }

    await payroll.approve(req.user.id);

    const updatedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Payroll approved successfully',
      data: updatedPayroll
    });
  })
);

// @route   PATCH /api/payroll/:id/mark-paid
// @desc    Mark payroll as paid
// @access  Private (HR and Admin)
router.patch('/:id/mark-paid', [
  authorize('admin', 'hr_manager'),
  body('paymentMethod').optional().isIn(['bank_transfer', 'check', 'cash']).withMessage('Valid payment method is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payroll ID format'
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Payroll not found'
    });
  }

  if (payroll.status !== 'approved') {
    return res.status(400).json({
      success: false,
      message: 'Only approved payrolls can be marked as paid'
    });
  }

  await payroll.markAsPaid(req.body.paymentMethod);

  const updatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'firstName lastName employeeId department position')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Payroll marked as paid successfully',
    data: updatedPayroll
  });
}));

// @route   DELETE /api/payroll/:id
// @desc    Delete payroll
// @access  Private (HR and Admin)
router.delete('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID format'
      });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a paid payroll'
      });
    }

    await Payroll.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Payroll deleted successfully'
    });
  })
);

// @route   POST /api/payroll/bulk-generate
// @desc    Generate payrolls for multiple employees
// @access  Private (HR and Admin)
router.post('/bulk-generate', [
  authorize('admin', 'hr_manager'),
  body('employeeIds').isArray().withMessage('Employee IDs array is required'),
  body('payPeriod.startDate').notEmpty().withMessage('Start date is required'),
  body('payPeriod.endDate').notEmpty().withMessage('End date is required'),
  body('payPeriod.type').isIn(['weekly', 'bi-weekly', 'monthly']).withMessage('Valid pay period type is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { employeeIds, payPeriod } = req.body;
  const createdPayrolls = [];
  const bulkErrors = [];

  for (const employeeId of employeeIds) {
    try {
      // Check if employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        bulkErrors.push(`Employee ${employeeId} not found`);
        continue;
      }

      // Check for existing payroll
      const existingPayroll = await Payroll.findOne({
        employee: employeeId,
        'payPeriod.startDate': new Date(payPeriod.startDate),
        'payPeriod.endDate': new Date(payPeriod.endDate)
      });

      if (existingPayroll) {
        bulkErrors.push(`Payroll already exists for employee ${employee.firstName} ${employee.lastName}`);
        continue;
      }

      // Create payroll
      const payrollData = {
        employee: employeeId,
        payPeriod: {
          startDate: new Date(payPeriod.startDate),
          endDate: new Date(payPeriod.endDate),
          type: payPeriod.type
        },
        basicSalary: employee.salary || 0,
        createdBy: req.user.id
      };

      const payroll = new Payroll(payrollData);
      await payroll.save();
      
      const populatedPayroll = await Payroll.findById(payroll._id)
        .populate('employee', 'firstName lastName employeeId department position');
      
      createdPayrolls.push(populatedPayroll);
    } catch (error) {
      bulkErrors.push(`Error creating payroll for employee ${employeeId}: ${error.message}`);
    }
  }

  res.status(201).json({
    success: true,
    message: `Generated ${createdPayrolls.length} payrolls successfully`,
    data: {
      created: createdPayrolls,
      errors: bulkErrors
    }
  });
}));

module.exports = router; 