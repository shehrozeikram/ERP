const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');
const { calculateMonthlyTax, calculateTaxableIncome } = require('../utils/taxCalculator');
const FBRTaxSlab = require('../models/hr/FBRTaxSlab');

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
    
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Match by month and year instead of payPeriod
      matchStage.$or = [
        {
          year: { $gte: startDateObj.getFullYear(), $lte: endDateObj.getFullYear() },
          month: { $gte: startDateObj.getMonth() + 1, $lte: endDateObj.getMonth() + 1 }
        }
      ];
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
    employee: req.body.employee,
    month: new Date(req.body.payPeriod.startDate).getMonth() + 1, // Extract month from start date
    year: new Date(req.body.payPeriod.startDate).getFullYear(), // Extract year from start date
    basicSalary: parseFloat(req.body.basicSalary) || 0,
    houseRentAllowance: parseFloat(req.body.allowances?.housing) || 0,
    medicalAllowance: parseFloat(req.body.allowances?.medical) || 0,
    conveyanceAllowance: parseFloat(req.body.allowances?.transport) || 0,
    specialAllowance: parseFloat(req.body.allowances?.meal) || 0,
    otherAllowance: parseFloat(req.body.allowances?.other) || 0,
    overtimeHours: parseFloat(req.body.overtime?.hours) || 0,
    overtimeRate: parseFloat(req.body.overtime?.rate) || 0,
    overtimeAmount: parseFloat(req.body.overtime?.amount) || 0,
    performanceBonus: parseFloat(req.body.bonuses?.performance) || 0,
    otherBonus: parseFloat(req.body.bonuses?.other) || 0,
    providentFund: parseFloat(req.body.deductions?.pension) || 0,
    incomeTax: parseFloat(req.body.deductions?.tax) || 0,
    healthInsurance: parseFloat(req.body.deductions?.insurance) || 0,
    otherDeductions: parseFloat(req.body.deductions?.other) || 0,
    eobi: parseFloat(req.body.deductions?.eobi) || 0,
    totalWorkingDays: parseInt(req.body.attendance?.totalDays) || 22,
    presentDays: parseInt(req.body.attendance?.presentDays) || 22,
    absentDays: parseInt(req.body.attendance?.absentDays) || 0,
    leaveDays: parseInt(req.body.leaveDeductions?.totalLeaveDays) || 0,
    currency: req.body.currency || 'PKR',
    remarks: req.body.notes || '',
    createdBy: req.user.id
  };

  // Calculate gross salary
  payrollData.grossSalary = payrollData.basicSalary + 
    payrollData.houseRentAllowance + 
    payrollData.medicalAllowance + 
    payrollData.conveyanceAllowance + 
    payrollData.specialAllowance + 
    payrollData.otherAllowance + 
    payrollData.overtimeAmount + 
    payrollData.performanceBonus + 
    payrollData.otherBonus;

  // Auto-calculate tax if not provided
  if (!payrollData.incomeTax) {
    const taxableIncome = calculateTaxableIncome({
      basic: payrollData.basicSalary,
      allowances: {
        housing: payrollData.houseRentAllowance,
        transport: payrollData.conveyanceAllowance,
        meal: payrollData.specialAllowance,
        other: payrollData.otherAllowance,
        medical: payrollData.medicalAllowance
      }
    });
    
    try {
      // Use the new database-driven tax calculation
      const annualTaxableIncome = taxableIncome * 12;
      const taxAmount = await FBRTaxSlab.calculateTax(annualTaxableIncome);
      payrollData.incomeTax = Math.round(taxAmount / 12);
    } catch (error) {
      console.error('Error calculating tax:', error);
      // Fallback to old calculation
      payrollData.incomeTax = calculateMonthlyTax(taxableIncome);
    }
  }

  // Calculate total deductions
  payrollData.totalDeductions = (payrollData.providentFund || 0) + 
    (payrollData.incomeTax || 0) + 
    (payrollData.healthInsurance || 0) + 
    (payrollData.eobi || 0) + 
    (payrollData.otherDeductions || 0);

  // Calculate net salary
  payrollData.netSalary = (payrollData.grossSalary || 0) - (payrollData.totalDeductions || 0);

  // Ensure all numeric fields are properly converted
  payrollData.basicSalary = parseFloat(payrollData.basicSalary) || 0;
  payrollData.houseRentAllowance = parseFloat(payrollData.houseRentAllowance) || 0;
  payrollData.medicalAllowance = parseFloat(payrollData.medicalAllowance) || 0;
  payrollData.conveyanceAllowance = parseFloat(payrollData.conveyanceAllowance) || 0;
  payrollData.specialAllowance = parseFloat(payrollData.specialAllowance) || 0;
  payrollData.otherAllowance = parseFloat(payrollData.otherAllowance) || 0;
  payrollData.overtimeHours = parseFloat(payrollData.overtimeHours) || 0;
  payrollData.overtimeRate = parseFloat(payrollData.overtimeRate) || 0;
  payrollData.overtimeAmount = parseFloat(payrollData.overtimeAmount) || 0;
  payrollData.performanceBonus = parseFloat(payrollData.performanceBonus) || 0;
  payrollData.otherBonus = parseFloat(payrollData.otherBonus) || 0;
  payrollData.providentFund = parseFloat(payrollData.providentFund) || 0;
  payrollData.incomeTax = parseFloat(payrollData.incomeTax) || 0;
  payrollData.healthInsurance = parseFloat(payrollData.healthInsurance) || 0;
  payrollData.otherDeductions = parseFloat(payrollData.otherDeductions) || 0;
  payrollData.eobi = parseFloat(payrollData.eobi) || 0;
  payrollData.totalWorkingDays = parseInt(payrollData.totalWorkingDays) || 22;
  payrollData.presentDays = parseInt(payrollData.presentDays) || 22;
  payrollData.absentDays = parseInt(payrollData.absentDays) || 0;
  payrollData.leaveDays = parseInt(payrollData.leaveDays) || 0;
  payrollData.grossSalary = parseFloat(payrollData.grossSalary) || 0;
  payrollData.totalDeductions = parseFloat(payrollData.totalDeductions) || 0;
  payrollData.netSalary = parseFloat(payrollData.netSalary) || 0;

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
  
  // Convert dates if provided - extract month and year from payPeriod if provided
  if (req.body.payPeriod && req.body.payPeriod.startDate) {
    const startDate = new Date(req.body.payPeriod.startDate);
    updateData.month = startDate.getMonth() + 1;
    updateData.year = startDate.getFullYear();
  }

  // Convert numeric fields
  if (req.body.basicSalary) {
    updateData.basicSalary = parseFloat(req.body.basicSalary);
  }

  // Map allowance fields if provided
  if (req.body.allowances) {
    updateData.houseRentAllowance = parseFloat(req.body.allowances.housing) || 0;
    updateData.medicalAllowance = parseFloat(req.body.allowances.medical) || 0;
    updateData.conveyanceAllowance = parseFloat(req.body.allowances.transport) || 0;
    updateData.specialAllowance = parseFloat(req.body.allowances.meal) || 0;
    updateData.otherAllowance = parseFloat(req.body.allowances.other) || 0;
  }

  // Map deduction fields if provided
  if (req.body.deductions) {
    updateData.providentFund = parseFloat(req.body.deductions.providentFund) || 0;
    updateData.incomeTax = parseFloat(req.body.deductions.tax) || 0;
    updateData.healthInsurance = parseFloat(req.body.deductions.insurance) || 0;
    updateData.eobi = parseFloat(req.body.deductions.eobi) || 0;
    updateData.otherDeductions = parseFloat(req.body.deductions.other) || 0;
  }

  // Get EOBI from employee if not provided
  if (!updateData.eobi && employee.eobi?.isActive) {
    updateData.eobi = employee.eobi.amount || 0;
  }

  // Get Provident Fund from employee if not provided
  if (!updateData.providentFund && employee.providentFund?.isActive) {
    updateData.providentFund = employee.providentFund.amount || 0;
  }

  // Recalculate totals
  updateData.grossSalary = (updateData.basicSalary || payroll.basicSalary) + 
    (updateData.houseRentAllowance || payroll.houseRentAllowance) + 
    (updateData.medicalAllowance || payroll.medicalAllowance) + 
    (updateData.conveyanceAllowance || payroll.conveyanceAllowance) + 
    (updateData.specialAllowance || payroll.specialAllowance) + 
    (updateData.otherAllowance || payroll.otherAllowance) + 
    (updateData.overtimeAmount || payroll.overtimeAmount) + 
    (updateData.performanceBonus || payroll.performanceBonus) + 
    (updateData.otherBonus || payroll.otherBonus);

  updateData.totalDeductions = (updateData.providentFund || payroll.providentFund) + 
    (updateData.incomeTax || payroll.incomeTax) + 
    (updateData.healthInsurance || payroll.healthInsurance) + 
    (updateData.eobi || payroll.eobi) + 
    (updateData.otherDeductions || payroll.otherDeductions);

  updateData.netSalary = updateData.grossSalary - updateData.totalDeductions;

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

    if (payroll.status !== 'Draft') {
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

  if (payroll.status !== 'Approved') {
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

// @route   PATCH /api/payroll/:id/mark-unpaid
// @desc    Mark payroll as unpaid (revert to draft)
// @access  Private (HR and Admin)
router.patch('/:id/mark-unpaid',
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

    if (payroll.status !== 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Only paid payrolls can be marked as unpaid'
      });
    }

    await payroll.markAsUnpaid();

    const updatedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Payroll marked as unpaid successfully',
      data: updatedPayroll
    });
  })
);

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

    if (payroll.status === 'Paid') {
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