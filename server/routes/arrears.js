const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');

const router = express.Router();

// @route   GET /api/hr/arrears/:employeeId
// @desc    Get all arrears for a specific employee
// @access  Private (HR and Admin)
router.get('/:employeeId', 
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const { month, year, status } = req.query;

    // Build query
    const query = { employee: employeeId };
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.arrearsStatus = status;

    // Get payrolls with arrears
    const payrolls = await Payroll.find(query)
      .select('month year arrears status createdAt updatedAt remarks')
      .sort({ year: -1, month: -1 });

    // Get employee's arrears object structure
    const employee = await Employee.findById(employeeId).select('arrears');
    
    // Transform arrears object data for frontend
    const arrearsData = [];
    if (employee && employee.arrears) {
      Object.keys(employee.arrears).forEach(key => {
        const arrearsEntry = employee.arrears[key];
        if (arrearsEntry.isActive && arrearsEntry.amount > 0) {
          arrearsData.push({
            _id: `${employeeId}_${key}_${arrearsEntry.month}_${arrearsEntry.year}`,
            type: key,
            month: arrearsEntry.month,
            year: arrearsEntry.year,
            monthName: new Date(arrearsEntry.year, arrearsEntry.month - 1).toLocaleString('default', { month: 'long' }),
            amount: arrearsEntry.amount,
            status: arrearsEntry.status,
            description: arrearsEntry.description || `${key} arrears`,
            createdDate: arrearsEntry.createdDate,
            updatedDate: arrearsEntry.createdDate
          });
        }
      });
    }

    res.json({
      success: true,
      data: arrearsData
    });
  })
);

// @route   POST /api/hr/arrears
// @desc    Add new arrears for an employee
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'),
  [
    body('employeeId').notEmpty().withMessage('Employee ID is required'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month is required'),
    body('year').isInt({ min: 2020 }).withMessage('Valid year is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
    body('description').notEmpty().withMessage('Description is required')
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

    const {
      employeeId,
      month,
      year,
      amount,
      description,
      status = 'Pending',
      type = 'Salary Adjustment'
    } = req.body;

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Note: No automatic payroll creation when adding arrears
    // Payrolls should only be created through bulk payroll generation

    // Update employee's arrears object structure
    const arrearsType = type.toLowerCase().replace(/\s+/g, '');
    const arrearsField = arrearsType === 'salaryadjustment' ? 'salaryAdjustment' :
                        arrearsType === 'bonuspayment' ? 'bonusPayment' :
                        arrearsType === 'overtimepayment' ? 'overtimePayment' :
                        arrearsType === 'allowanceadjustment' ? 'allowanceAdjustment' :
                        arrearsType === 'deductionreversal' ? 'deductionReversal' :
                        'other';

    // Initialize arrears object if it doesn't exist
    if (!employee.arrears) {
      employee.arrears = {
        salaryAdjustment: { isActive: false, amount: 0, month: 0, year: 0, description: '', status: 'Pending', createdDate: new Date() },
        bonusPayment: { isActive: false, amount: 0, month: 0, year: 0, description: '', status: 'Pending', createdDate: new Date() },
        overtimePayment: { isActive: false, amount: 0, month: 0, year: 0, description: '', status: 'Pending', createdDate: new Date() },
        allowanceAdjustment: { isActive: false, amount: 0, month: 0, year: 0, description: '', status: 'Pending', createdDate: new Date() },
        deductionReversal: { isActive: false, amount: 0, month: 0, year: 0, description: '', status: 'Pending', createdDate: new Date() },
        other: { isActive: false, amount: 0, month: 0, year: 0, description: '', status: 'Pending', createdDate: new Date() }
      };
    }

    // Update the specific arrears field
    employee.arrears[arrearsField] = {
      isActive: true,
      amount: parseFloat(amount),
      month: parseInt(month),
      year: parseInt(year),
      description: description,
      status: status,
      createdDate: new Date()
    };

    await employee.save();

    res.json({
      success: true,
      message: 'Arrears added successfully to employee record',
      data: {
        employeeId: employee.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        arrearsType: arrearsField,
        amount: parseFloat(amount),
        month: parseInt(month),
        year: parseInt(year),
        status: status
      }
    });
  })
);

// @route   PUT /api/hr/arrears/:id
// @desc    Update arrears for a specific payroll
// @access  Private (HR and Admin)
router.put('/:id',
  authorize('admin', 'hr_manager'),
  [
    body('amount').optional().isFloat({ min: 0 }).withMessage('Valid amount is required'),
    body('status').optional().isIn(['Pending', 'Paid', 'Overdue', 'Cancelled']).withMessage('Valid status is required'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty')
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

    const { id } = req.params;
    const { amount, status, description } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Update fields
    if (amount !== undefined) payroll.arrears = parseFloat(amount);
    if (status !== undefined) payroll.arrearsStatus = status;
    if (description !== undefined) payroll.arrearsDescription = description;
    
    payroll.updatedBy = req.user._id;
    await payroll.save();

    // Update employee's arrears object structure
    const employee = await Employee.findById(payroll.employee);
    if (employee && employee.arrears) {
      // Find and update the specific arrears entry
      Object.keys(employee.arrears).forEach(key => {
        const arrearsEntry = employee.arrears[key];
        if (arrearsEntry.isActive && arrearsEntry.month === payroll.month && arrearsEntry.year === payroll.year) {
          if (amount !== undefined) arrearsEntry.amount = parseFloat(amount);
          if (status !== undefined) arrearsEntry.status = status;
          if (description !== undefined) arrearsEntry.description = description;
        }
      });
      await employee.save();
    }

    res.json({
      success: true,
      message: 'Arrears updated successfully',
      data: payroll
    });
  })
);

// @route   DELETE /api/hr/arrears/:id
// @desc    Delete arrears from a payroll
// @access  Private (HR and Admin)
router.delete('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Remove arrears from payroll
    const employeeId = payroll.employee;
    payroll.arrears = 0;
    payroll.arrearsStatus = null;
    payroll.arrearsDescription = null;
    payroll.arrearsType = null;
    payroll.updatedBy = req.user._id;
    
    await payroll.save();

    // Update employee's arrears object structure
    const employee = await Employee.findById(employeeId);
    if (employee && employee.arrears) {
      // Find and deactivate the specific arrears entry
      Object.keys(employee.arrears).forEach(key => {
        const arrearsEntry = employee.arrears[key];
        if (arrearsEntry.isActive && arrearsEntry.month === payroll.month && arrearsEntry.year === payroll.year) {
          arrearsEntry.isActive = false;
          arrearsEntry.status = 'Cancelled';
        }
      });
      await employee.save();
    }

    res.json({
      success: true,
      message: 'Arrears removed successfully'
    });
  })
);

// @route   GET /api/hr/arrears/stats/:employeeId
// @desc    Get arrears statistics for an employee
// @access  Private (HR and Admin)
router.get('/stats/:employeeId',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId).select('arrears');
    
    // Calculate stats from arrears object
    const stats = {
      totalArrears: 0,
      totalPaid: 0,
      totalPending: 0,
      totalOverdue: 0,
      monthsWithArrears: 0,
      overdueMonths: 0
    };

    if (employee && employee.arrears) {
      Object.keys(employee.arrears).forEach(key => {
        const arrearsEntry = employee.arrears[key];
        if (arrearsEntry.isActive && arrearsEntry.amount > 0) {
          stats.totalArrears += arrearsEntry.amount;
          stats.monthsWithArrears++;
          
          if (arrearsEntry.status === 'Paid') {
            stats.totalPaid += arrearsEntry.amount;
          } else if (arrearsEntry.status === 'Pending') {
            stats.totalPending += arrearsEntry.amount;
          } else if (arrearsEntry.status === 'Overdue') {
            stats.totalOverdue += arrearsEntry.amount;
            stats.overdueMonths++;
          }
        }
      });
    }

    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;
