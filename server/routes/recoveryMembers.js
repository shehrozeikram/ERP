const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryMember = require('../models/finance/RecoveryMember');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');

const router = express.Router();

// @route   GET /api/finance/recovery-members/eligible-employees
// @desc    Get employees from Finance department who are not already recovery members
// @access  Private (Finance and Admin)
router.get(
  '/eligible-employees',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const financeDept = await Department.findOne({
      name: { $regex: /^Finance$/i },
      isActive: true
    }).lean();

    if (!financeDept) {
      return res.json({
        success: true,
        data: [],
        message: 'Finance department not found'
      });
    }

    const existingMemberIds = await RecoveryMember.find({ isActive: true })
      .select('employee')
      .lean()
      .then((members) => members.map((m) => m.employee));

    const employees = await Employee.find({
      isDeleted: false,
      $or: [
        { department: financeDept._id },
        { placementDepartment: financeDept._id }
      ],
      _id: { $nin: existingMemberIds }
    })
      .select('firstName lastName employeeId email phone _id')
      .sort({ employeeId: 1 })
      .lean();

    const withFullName = employees.map((emp) => ({
      ...emp,
      fullName: [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim()
    }));

    res.json({
      success: true,
      data: withFullName
    });
  })
);

// @route   GET /api/finance/recovery-members
// @desc    Get all recovery members (populated with employee)
// @access  Private (Finance and Admin)
router.get(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { search, isActive } = req.query;
    const query = {};

    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true';
    }
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const employees = await Employee.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { employeeId: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).select('_id').lean();
      const employeeIds = employees.map((e) => e._id);
      if (employeeIds.length > 0) {
        query.employee = { $in: employeeIds };
      } else {
        query.employee = { $in: [] };
      }
    }

    const members = await RecoveryMember.find(query)
      .populate('employee', 'firstName lastName employeeId email phone')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: members
    });
  })
);

// @route   POST /api/finance/recovery-members
// @desc    Create new recovery member (link existing employee)
// @access  Private (Finance and Admin)
router.post(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('employee').isMongoId().withMessage('Valid employee is required'),
    body('notes').optional().trim(),
    body('isActive').optional().isBoolean()
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

    const employee = await Employee.findById(req.body.employee);
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const existing = await RecoveryMember.findOne({
      employee: req.body.employee,
      isActive: true
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This employee is already a recovery member'
      });
    }

    const memberData = {
      employee: req.body.employee,
      notes: req.body.notes?.trim() || '',
      isActive: req.body.isActive !== false,
      createdBy: req.user?.id
    };

    const member = new RecoveryMember(memberData);
    await member.save();
    await member.populate('employee', 'firstName lastName employeeId email phone');

    res.status(201).json({
      success: true,
      message: 'Recovery member added successfully',
      data: member
    });
  })
);

// @route   PUT /api/finance/recovery-members/:id
// @desc    Update recovery member (notes only)
// @access  Private (Finance and Admin)
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('notes').optional().trim(),
    body('isActive').optional().isBoolean()
  ],
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
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

    const member = await RecoveryMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Recovery member not found'
      });
    }

    if (req.body.notes !== undefined) member.notes = req.body.notes?.trim() || '';
    if (req.body.isActive !== undefined) member.isActive = req.body.isActive;
    member.updatedBy = req.user?.id;
    await member.save();
    await member.populate('employee', 'firstName lastName employeeId email phone');

    res.json({
      success: true,
      message: 'Recovery member updated successfully',
      data: member
    });
  })
);

// @route   DELETE /api/finance/recovery-members/:id
// @desc    Remove recovery member (soft delete)
// @access  Private (Finance and Admin)
router.delete(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format'
      });
    }

    const member = await RecoveryMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Recovery member not found'
      });
    }

    member.isActive = false;
    member.updatedBy = req.user?.id;
    await member.save();

    res.json({
      success: true,
      message: 'Recovery member removed successfully',
      data: member
    });
  })
);

module.exports = router;
