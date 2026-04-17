const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryTask = require('../models/finance/RecoveryTask');
const RecoveryMember = require('../models/finance/RecoveryMember');
const RecoveryTaskAssignmentRule = require('../models/finance/RecoveryTaskAssignmentRule');
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

function buildTaskScopeQuery({ scopeType, sector, minAmount, maxAmount }) {
  const query = {};
  const sectorRegex = sectorExactRegex(sector);
  if (sectorRegex) query.sector = sectorRegex;
  if (scopeType === 'slab') {
    const min = Number(minAmount) || 0;
    const max = maxAmount !== undefined && maxAmount !== null && maxAmount !== '' ? Number(maxAmount) : null;
    query.currentlyDue = max != null ? { $gte: min, $lt: max } : { $gte: min };
  }
  return query;
}

async function reopenCompletedAssignmentsByTaskScope({ scopeType, sector, minAmount, maxAmount }) {
  const scopeQuery = buildTaskScopeQuery({ scopeType, sector, minAmount, maxAmount });
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

function getProgress(task) {
  const t = task.toObject ? task.toObject() : task;
  if (t.targetCount != null && t.targetCount > 0) {
    return Math.min(100, Math.round(((t.completedCount || 0) / t.targetCount) * 100));
  }
  return Math.min(100, Math.max(0, Number(t.progressPercent) || 0));
}

// GET /api/finance/recovery-tasks
router.get(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { status, memberId } = req.query;
    const query = {};
    if (status && status.trim()) query.status = status.trim();
    if (memberId && memberId.trim()) query.assignedTo = memberId.trim();

    const tasks = await RecoveryTask.find(query)
      .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } })
      .populate({ path: 'createdBy', select: 'firstName lastName employeeId' })
      .sort({ startDate: -1 })
      .lean();

    const data = tasks.map((t) => ({ ...t, progress: getProgress(t) }));
    res.json({ success: true, data });
  })
);

// POST /api/finance/recovery-tasks
router.post(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { title, assignedTo, scopeType, sector, minAmount, maxAmount, startDate, endDate, targetCount, notes, action } = req.body;

    if (!assignedTo || !startDate || !endDate || !scopeType) {
      return res.status(400).json({
        success: false,
        message: 'assignedTo, scopeType, startDate and endDate are required'
      });
    }

    const member = await RecoveryMember.findById(assignedTo);
    if (!member) {
      return res.status(400).json({ success: false, message: 'Recovery member not found' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ success: false, message: 'Valid start and end dates required' });
    }

    const task = new RecoveryTask({
      title: title ? String(title).trim() : '',
      assignedTo,
      scopeType,
      sector: scopeType === 'sector' && sector ? String(sector).trim() : (sector ? String(sector).trim() : ''),
      minAmount: scopeType === 'slab' ? Number(minAmount) || 0 : 0,
      maxAmount: scopeType === 'slab' && maxAmount != null && maxAmount !== '' ? Number(maxAmount) : null,
      startDate: start,
      endDate: end,
      targetCount: targetCount != null && targetCount !== '' ? Number(targetCount) : null,
      completedCount: 0,
      progressPercent: 0,
      status: 'pending',
      notes: notes ? String(notes).trim() : '',
      action: action && ['whatsapp', 'call', 'both'].includes(action) ? action : 'both',
      createdBy: req.user._id
    });

    await task.save();
    await task.populate([{ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } }]);

    // Ensure there is a matching assignment rule so the assignee actually gets tasks in My Tasks
    try {
      const ruleType = scopeType === 'sector' ? 'sector' : 'slab';
      const ruleQuery = {
        type: ruleType,
        assignedTo
      };
      if (ruleType === 'sector') {
        ruleQuery.sector = task.sector || '';
      } else {
        ruleQuery.sector = task.sector || '';
        ruleQuery.minAmount = task.minAmount || 0;
        ruleQuery.maxAmount = task.maxAmount != null ? task.maxAmount : null;
      }

      const existingRule = await RecoveryTaskAssignmentRule.findOne(ruleQuery).lean();
      if (!existingRule) {
        await RecoveryTaskAssignmentRule.create({
          ...ruleQuery,
          isActive: true,
          action: task.action || 'both',
          createdBy: req.user._id
        });
      }
    } catch (e) {
      console.warn('Failed to ensure matching RecoveryTaskAssignmentRule for task', e.message);
    }

    // If this scope is assigned again, move matching completed records back to pending.
    const reopenedCount = await reopenCompletedAssignmentsByTaskScope({
      scopeType: task.scopeType,
      sector: task.sector,
      minAmount: task.minAmount,
      maxAmount: task.maxAmount
    });

    const out = task.toObject();
    res.status(201).json({
      success: true,
      message: reopenedCount > 0 ? `Task created. Re-opened ${reopenedCount} completed record(s).` : undefined,
      data: { ...out, progress: getProgress(out), reopenedCount }
    });
  })
);

// PUT /api/finance/recovery-tasks/:id
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const task = await RecoveryTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const {
      status,
      completedCount,
      progressPercent,
      notes,
      title,
      action,
      assignedTo,
      scopeType,
      sector,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      targetCount
    } = req.body;

    if (assignedTo !== undefined && assignedTo) {
      const member = await RecoveryMember.findById(assignedTo);
      if (!member) {
        return res.status(400).json({ success: false, message: 'Recovery member not found' });
      }
      task.assignedTo = assignedTo;
    }

    if (scopeType !== undefined && ['sector', 'slab'].includes(scopeType)) {
      task.scopeType = scopeType;
    }

    if (sector !== undefined) task.sector = sector ? String(sector).trim() : '';

    if (task.scopeType === 'sector' && !String(task.sector || '').trim()) {
      return res.status(400).json({ success: false, message: 'Sector is required for sector scope' });
    }

    if (task.scopeType === 'slab') {
      if (minAmount !== undefined) task.minAmount = Number(minAmount) || 0;
      if (maxAmount !== undefined) {
        task.maxAmount = maxAmount === '' || maxAmount == null ? null : Number(maxAmount);
      }
      if (task.maxAmount != null && Number(task.maxAmount) < Number(task.minAmount || 0)) {
        return res.status(400).json({ success: false, message: 'maxAmount must be null or >= minAmount' });
      }
    } else {
      task.minAmount = 0;
      task.maxAmount = null;
    }

    if (startDate !== undefined && startDate) task.startDate = new Date(startDate);
    if (endDate !== undefined && endDate) task.endDate = new Date(endDate);
    if (task.startDate && task.endDate && new Date(task.endDate) < new Date(task.startDate)) {
      return res.status(400).json({ success: false, message: 'End date must be on or after start date' });
    }

    if (targetCount !== undefined) task.targetCount = targetCount === '' || targetCount == null ? null : Number(targetCount);

    if (status !== undefined) task.status = status;
    if (action !== undefined && ['whatsapp', 'call', 'both'].includes(action)) task.action = action;
    if (completedCount !== undefined) task.completedCount = Math.max(0, Number(completedCount) || 0);
    if (progressPercent !== undefined) task.progressPercent = Math.min(100, Math.max(0, Number(progressPercent) || 0));
    if (notes !== undefined) task.notes = String(notes).trim();
    if (title !== undefined) task.title = String(title).trim();
    task.updatedBy = req.user._id;

    await task.save();
    await task.populate([{ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } }]);

    let reopenedCount = 0;
    if (task.status !== 'cancelled') {
      reopenedCount = await reopenCompletedAssignmentsByTaskScope({
        scopeType: task.scopeType,
        sector: task.sector,
        minAmount: task.minAmount,
        maxAmount: task.maxAmount
      });
    }

    const out = task.toObject();
    res.json({
      success: true,
      message: reopenedCount > 0 ? `Task updated. Re-opened ${reopenedCount} completed record(s).` : undefined,
      data: { ...out, progress: getProgress(out), reopenedCount }
    });
  })
);

// DELETE /api/finance/recovery-tasks/:id
router.delete(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const task = await RecoveryTask.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  })
);

module.exports = router;
