const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryMember = require('../models/finance/RecoveryMember');

const router = express.Router();

// @route   GET /api/finance/recovery-members
// @desc    Get all recovery members
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
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { contactNumber: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const members = await RecoveryMember.find(query)
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: members
    });
  })
);

// @route   POST /api/finance/recovery-members
// @desc    Create new recovery member
// @access  Private (Finance and Admin)
router.post(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('name').trim().notEmpty().withMessage('Member name is required'),
    body('contactNumber').optional().trim(),
    body('email').optional().trim().isEmail().withMessage('Invalid email format'),
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

    const memberData = {
      name: req.body.name.trim(),
      contactNumber: req.body.contactNumber?.trim() || '',
      email: req.body.email?.trim() || '',
      notes: req.body.notes?.trim() || '',
      isActive: req.body.isActive !== false,
      createdBy: req.user?.id
    };

    const member = new RecoveryMember(memberData);
    await member.save();

    res.status(201).json({
      success: true,
      message: 'Recovery member added successfully',
      data: member
    });
  })
);

// @route   PUT /api/finance/recovery-members/:id
// @desc    Update recovery member
// @access  Private (Finance and Admin)
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  [
    body('name').optional().trim().notEmpty().withMessage('Member name cannot be empty'),
    body('contactNumber').optional().trim(),
    body('email').optional().trim().isEmail().withMessage('Invalid email format'),
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

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name.trim();
    if (req.body.contactNumber !== undefined) updateData.contactNumber = req.body.contactNumber?.trim() || '';
    if (req.body.email !== undefined) updateData.email = req.body.email?.trim() || '';
    if (req.body.notes !== undefined) updateData.notes = req.body.notes?.trim() || '';
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    updateData.updatedBy = req.user?.id;

    Object.assign(member, updateData);
    await member.save();

    res.json({
      success: true,
      message: 'Recovery member updated successfully',
      data: member
    });
  })
);

// @route   DELETE /api/finance/recovery-members/:id
// @desc    Delete (soft delete) recovery member
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
