const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const SalaryAdvance = require('../models/hr/SalaryAdvance');
const Employee = require('../models/hr/Employee');

const router = express.Router();

// GET /api/hr/salary-advances - Get all salary advances with filter options
router.get('/', asyncHandler(async (req, res) => {
  const { month, year, employeeId, status } = req.query;
  const filter = {};

  if (month) filter.payrollMonth = Number(month);
  if (year) filter.payrollYear = Number(year);
  if (employeeId) filter.employee = employeeId;
  if (status) filter.status = status;

  const advances = await SalaryAdvance.find(filter)
    .populate('employee', 'firstName lastName employeeId department designation basicSalary')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: advances.length,
    data: advances
  });
}));

// POST /api/hr/salary-advances - Issue single salary advance
router.post('/', [
  body('employee').notEmpty().withMessage('Employee is required'),
  body('amount').isNumeric().withMessage('Amount must be a number').custom(val => val > 0).withMessage('Amount must be greater than 0'),
  body('payrollMonth').isInt({ min: 1, max: 12 }).withMessage('Valid payroll month is required'),
  body('payrollYear').isInt({ min: 2020 }).withMessage('Valid payroll year is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { employee, amount, advanceDate, payrollMonth, payrollYear, reason, paymentMethod } = req.body;

  // Verify employee exists
  const emp = await Employee.findById(employee);
  if (!emp) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  const advance = await SalaryAdvance.create({
    employee,
    amount: Number(amount),
    advanceDate: advanceDate || new Date(),
    payrollMonth: Number(payrollMonth),
    payrollYear: Number(payrollYear),
    reason: reason || '',
    paymentMethod: paymentMethod || 'Bank Transfer',
    createdBy: req.user?._id
  });

  const populated = await SalaryAdvance.findById(advance._id)
    .populate('employee', 'firstName lastName employeeId department designation');

  res.status(201).json({
    success: true,
    message: 'Salary advance issued successfully',
    data: populated
  });
}));

// POST /api/hr/salary-advances/bulk - Issue bulk salary advances to multiple employees
router.post('/bulk', [
  body('employees').isArray({ min: 1 }).withMessage('At least one employee must be selected'),
  body('amount').isNumeric().withMessage('Amount must be a number').custom(val => val > 0).withMessage('Amount must be greater than 0'),
  body('payrollMonth').isInt({ min: 1, max: 12 }).withMessage('Valid payroll month is required'),
  body('payrollYear').isInt({ min: 2020 }).withMessage('Valid payroll year is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { employees, amount, advanceDate, payrollMonth, payrollYear, reason, paymentMethod } = req.body;

  const records = employees.map(empId => ({
    employee: empId,
    amount: Number(amount),
    advanceDate: advanceDate || new Date(),
    payrollMonth: Number(payrollMonth),
    payrollYear: Number(payrollYear),
    reason: reason || 'Bulk Advance',
    paymentMethod: paymentMethod || 'Bank Transfer',
    createdBy: req.user?._id
  }));

  const inserted = await SalaryAdvance.insertMany(records);

  res.status(201).json({
    success: true,
    message: `Salary advance issued successfully to ${inserted.length} employees`,
    count: inserted.length,
    data: inserted
  });
}));

// DELETE /api/hr/salary-advances/:id - Cancel/Delete unadjusted salary advance
router.delete('/:id', asyncHandler(async (req, res) => {
  const advance = await SalaryAdvance.findById(req.params.id);
  if (!advance) {
    return res.status(404).json({ success: false, message: 'Salary advance record not found' });
  }

  if (advance.status === 'Adjusted') {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete salary advance that has already been adjusted in payroll'
    });
  }

  await advance.deleteOne();

  res.json({
    success: true,
    message: 'Salary advance deleted successfully'
  });
}));

module.exports = router;
