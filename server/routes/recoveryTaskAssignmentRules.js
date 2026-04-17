const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryTaskAssignmentRule = require('../models/finance/RecoveryTaskAssignmentRule');
const RecoveryMember = require('../models/finance/RecoveryMember');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');

const router = express.Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectorExactRegex(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return new RegExp(`^${escapeRegex(trimmed)}$`, 'i');
}

function buildRuleScopeQuery({ type, sector, minAmount, maxAmount }) {
  const query = {};
  const sectorRegex = sectorExactRegex(sector);
  if (sectorRegex) query.sector = sectorRegex;

  if (type === 'slab') {
    const min = Number(minAmount) || 0;
    const max = maxAmount !== undefined && maxAmount !== null && maxAmount !== '' ? Number(maxAmount) : null;
    query.currentlyDue = max != null ? { $gte: min, $lt: max } : { $gte: min };
  }
  return query;
}

async function reopenCompletedAssignmentsByRuleScope({ type, sector, minAmount, maxAmount }) {
  const scopeQuery = buildRuleScopeQuery({ type, sector, minAmount, maxAmount });
  const query = { ...scopeQuery, taskStatus: 'completed' };
  const result = await RecoveryAssignment.updateMany(
    query,
    {
      $set: { taskStatus: 'pending' },
      $unset: { taskCompletedAt: '', taskCompletedBy: '' }
    }
  );
  return result?.modifiedCount || 0;
}

function getProgress(rule) {
  const r = rule?.toObject ? rule.toObject() : rule;
  if (r.targetCount != null && r.targetCount > 0) {
    return Math.min(100, Math.round(((r.completedCount || 0) / r.targetCount) * 100));
  }
  return Math.min(100, Math.max(0, Number(r.progressPercent) || 0));
}

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

    res.json({ success: true, data: rules.map((r) => ({ ...r, progress: getProgress(r) })) });
  })
);

// POST /api/finance/recovery-task-rules
router.post(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { type, assignedTo, sector, minAmount, maxAmount, action, targetCount } = req.body;

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
      targetCount: targetCount != null && targetCount !== '' ? Number(targetCount) : null,
      completedCount: 0,
      progressPercent: 0,
      status: 'pending',
      createdBy: req.user._id
    });

    await rule.save();
    await rule.populate([
      { path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } }
    ]);

    // Re-open previously completed records if this scope is assigned again.
    const reopenedCount = await reopenCompletedAssignmentsByRuleScope({
      type: rule.type,
      sector: rule.sector,
      minAmount: rule.minAmount,
      maxAmount: rule.maxAmount
    });

    res.status(201).json({
      success: true,
      message: reopenedCount > 0
        ? `Assignment rule created. Re-opened ${reopenedCount} completed record(s).`
        : 'Assignment rule created',
      data: { ...rule.toObject(), progress: getProgress(rule), reopenedCount }
    });
  })
);

// PUT /api/finance/recovery-task-rules/:id
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { type, assignedTo, sector, minAmount, maxAmount, isActive, action, status, completedCount, progressPercent, targetCount } = req.body;
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
    if (status !== undefined && ['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) rule.status = status;
    if (targetCount !== undefined) rule.targetCount = targetCount === '' || targetCount == null ? null : Number(targetCount);
    if (completedCount !== undefined) rule.completedCount = Math.max(0, Number(completedCount) || 0);
    if (progressPercent !== undefined) rule.progressPercent = Math.min(100, Math.max(0, Number(progressPercent) || 0));
    rule.updatedBy = req.user._id;

    await rule.save();
    await rule.populate([
      { path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } }
    ]);

    let reopenedCount = 0;
    if (rule.isActive && rule.status !== 'cancelled') {
      reopenedCount = await reopenCompletedAssignmentsByRuleScope({
        type: rule.type,
        sector: rule.sector,
        minAmount: rule.minAmount,
        maxAmount: rule.maxAmount
      });
    }

    res.json({
      success: true,
      message: reopenedCount > 0 ? `Rule updated. Re-opened ${reopenedCount} completed record(s).` : undefined,
      data: { ...rule.toObject(), progress: getProgress(rule), reopenedCount }
    });
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
