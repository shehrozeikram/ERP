const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryTaskAssignmentRule = require('../models/finance/RecoveryTaskAssignmentRule');
const RecoveryMember = require('../models/finance/RecoveryMember');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');

const router = express.Router();

// GET /api/finance/recovery-task-rules
router.get(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const rules = await RecoveryTaskAssignmentRule.find({ isActive: true })
      .populate('assignedTo', 'employee')
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .populate({ path: 'createdBy', select: 'firstName lastName employeeId' })
      .sort({ type: 1, sector: 1, minAmount: 1 })
      .lean();

    res.json({ success: true, data: rules });
  })
);

// POST /api/finance/recovery-task-rules
router.post(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { type, assignedTo, sector, minAmount, maxAmount, action } = req.body;

    if (!type || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Type and assignedTo (recovery member) are required'
      });
    }

    if (type === 'sector' && !(sector && String(sector).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Sector is required for sector-wide assignment'
      });
    }

    if (type === 'slab') {
      const min = Number(minAmount);
      const max = maxAmount !== undefined && maxAmount !== null && maxAmount !== '' ? Number(maxAmount) : null;
      if (isNaN(min) || min < 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid minAmount is required for slab assignment'
        });
      }
      if (max !== null && (isNaN(max) || max < min)) {
        return res.status(400).json({
          success: false,
          message: 'maxAmount must be null or >= minAmount'
        });
      }
    }

    const member = await RecoveryMember.findById(assignedTo);
    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'Recovery member not found'
      });
    }

    const rule = new RecoveryTaskAssignmentRule({
      type,
      assignedTo,
      sector: type === 'sector' ? String(sector).trim() : (sector ? String(sector).trim() : ''),
      minAmount: type === 'slab' ? Number(minAmount) : 0,
      maxAmount: type === 'slab' && maxAmount !== undefined && maxAmount !== null && maxAmount !== '' ? Number(maxAmount) : null,
      action: action && ['whatsapp', 'call', 'both'].includes(action) ? action : 'both',
      createdBy: req.user._id
    });

    await rule.save();
    await rule.populate([
      { path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } }
    ]);

    res.status(201).json({
      success: true,
      message: 'Assignment rule created',
      data: rule
    });
  })
);

// PUT /api/finance/recovery-task-rules/:id
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { type, assignedTo, sector, minAmount, maxAmount, isActive, action } = req.body;
    const rule = await RecoveryTaskAssignmentRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    if (type !== undefined) rule.type = type;
    if (assignedTo !== undefined) rule.assignedTo = assignedTo;
    if (sector !== undefined) rule.sector = type === 'sector' ? String(sector).trim() : (sector ? String(sector).trim() : '');
    if (type === 'slab') {
      if (minAmount !== undefined) rule.minAmount = Number(minAmount);
      if (maxAmount !== undefined) rule.maxAmount = maxAmount === '' || maxAmount === null ? null : Number(maxAmount);
    }
    if (isActive !== undefined) rule.isActive = isActive;
    if (action !== undefined && ['whatsapp', 'call', 'both'].includes(action)) rule.action = action;
    rule.updatedBy = req.user._id;

    await rule.save();
    await rule.populate([
      { path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } }
    ]);

    res.json({ success: true, data: rule });
  })
);

// DELETE /api/finance/recovery-task-rules/:id
router.delete(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const rule = await RecoveryTaskAssignmentRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    res.json({ success: true, message: 'Rule deleted' });
  })
);

// GET /api/finance/recovery-task-rules/slab-target-count
// Compute target count for a slab scope using RecoveryAssignment data
router.get(
  '/slab-target-count',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { sector, minAmount, maxAmount } = req.query;

    const min = Number(minAmount);
    const max = maxAmount !== undefined && maxAmount !== null && maxAmount !== '' ? Number(maxAmount) : null;
    if (isNaN(min) || min < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid minAmount is required'
      });
    }
    if (max !== null && (isNaN(max) || max < min)) {
      return res.status(400).json({
        success: false,
        message: 'maxAmount must be null or >= minAmount'
      });
    }

    const amountCond = max != null ? { $gte: min, $lt: max } : { $gte: min };
    const query = {
      currentlyDue: amountCond
    };
    if (sector && String(sector).trim()) {
      query.sector = String(sector).trim();
    }

    const count = await RecoveryAssignment.countDocuments(query);

    res.json({
      success: true,
      data: { count }
    });
  })
);

module.exports = router;
