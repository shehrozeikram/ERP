const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryTask = require('../models/finance/RecoveryTask');
const RecoveryMember = require('../models/finance/RecoveryMember');
const RecoveryTaskAssignmentRule = require('../models/finance/RecoveryTaskAssignmentRule');

const router = express.Router();

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

    const out = task.toObject();
    res.status(201).json({ success: true, data: { ...out, progress: getProgress(out) } });
  })
);

// PUT /api/finance/recovery-tasks/:id
router.put(
  '/:id',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const task = await RecoveryTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const { status, completedCount, progressPercent, notes, title, action } = req.body;

    if (status !== undefined) task.status = status;
    if (action !== undefined && ['whatsapp', 'call', 'both'].includes(action)) task.action = action;
    if (completedCount !== undefined) task.completedCount = Math.max(0, Number(completedCount) || 0);
    if (progressPercent !== undefined) task.progressPercent = Math.min(100, Math.max(0, Number(progressPercent) || 0));
    if (notes !== undefined) task.notes = String(notes).trim();
    if (title !== undefined) task.title = String(title).trim();
    task.updatedBy = req.user._id;

    await task.save();
    await task.populate([{ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId' } }]);
    const out = task.toObject();
    res.json({ success: true, data: { ...out, progress: getProgress(out) } });
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
