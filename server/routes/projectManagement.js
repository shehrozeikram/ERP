const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');

const ConstructionProject = require('../models/projectManagement/ConstructionProject');
const BOQItem = require('../models/projectManagement/BOQItem');
const ProjectTask = require('../models/projectManagement/ProjectTask');
const ProjectExpense = require('../models/projectManagement/ProjectExpense');
const DailyProgressReport = require('../models/projectManagement/DailyProgressReport');
const ProjectInvoice = require('../models/projectManagement/ProjectInvoice');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');
const Supplier = require('../models/hr/Supplier');

const router = express.Router();

// ─── File upload setup ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/project-management');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const notFound = (res, entity = 'Record') =>
  res.status(404).json({ success: false, message: `${entity} not found` });

const badRequest = (res, message) =>
  res.status(400).json({ success: false, message });

// Recalculate project.totalActualSpent from expense records
const syncProjectActuals = async (projectId) => {
  const [{ total } = { total: 0 }] = await ProjectExpense.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(projectId), paymentStatus: { $ne: 'Cancelled' } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  await ConstructionProject.findByIdAndUpdate(projectId, { totalActualSpent: total });
};

// Recalculate project.overallProgress from task average
const syncProjectProgress = async (projectId) => {
  const tasks = await ProjectTask.find({ project: projectId, level: { $gt: 0 } }).select('progressPercent');
  if (!tasks.length) return;
  const avg = Math.round(tasks.reduce((s, t) => s + (t.progressPercent || 0), 0) / tasks.length);
  await ConstructionProject.findByIdAndUpdate(projectId, { overallProgress: avg });
};

// ─── PROJECTS ────────────────────────────────────────────────────────────────

// GET /api/project-management/projects — list with filters + pagination
router.get('/projects', asyncHandler(async (req, res) => {
  const { search, status, projectType, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (projectType) filter.projectType = projectType;
  if (search) {
    const re = { $regex: search, $options: 'i' };
    filter.$or = [{ name: re }, { projectNumber: re }, { clientName: re }, { society: re }, { sector: re }];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [projects, total] = await Promise.all([
    ConstructionProject.find(filter)
      .populate('projectManager', 'firstName lastName email')
      .populate('budgetApprovedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ConstructionProject.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: { projects, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } }
  });
}));

// GET /api/project-management/projects/statistics — dashboard stats
router.get('/projects/statistics', asyncHandler(async (req, res) => {
  const [statusCounts, financials] = await Promise.all([
    ConstructionProject.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ConstructionProject.aggregate([{
      $group: {
        _id: null,
        totalBudget: { $sum: '$totalApprovedBudget' },
        totalSpent: { $sum: '$totalActualSpent' },
        totalProjects: { $sum: 1 }
      }
    }])
  ]);

  const byStatus = statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
  const fin = financials[0] || { totalBudget: 0, totalSpent: 0, totalProjects: 0 };

  res.json({
    success: true,
    data: {
      totalProjects: fin.totalProjects,
      active: byStatus['Active'] || 0,
      onHold: byStatus['On Hold'] || 0,
      completed: byStatus['Completed'] || 0,
      draft: byStatus['Draft'] || 0,
      planning: byStatus['Planning'] || 0,
      cancelled: byStatus['Cancelled'] || 0,
      totalBudget: fin.totalBudget,
      totalSpent: fin.totalSpent
    }
  });
}));

// GET /api/project-management/projects/:id — single project
router.get('/projects/:id', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const project = await ConstructionProject.findById(req.params.id)
    .populate('projectManager', 'firstName lastName email')
    .populate('budgetApprovedBy', 'firstName lastName')
    .populate('createdBy', 'firstName lastName')
    .lean();

  if (!project) return notFound(res, 'Project');
  res.json({ success: true, data: project });
}));

// POST /api/project-management/projects — create
router.post('/projects', asyncHandler(async (req, res) => {
  const { name, projectType, description, society, sector, plotNumber, address,
    clientName, clientContact, projectManager, startDate, expectedEndDate,
    budgetCategories, notes, tags } = req.body;

  if (!name || !name.trim()) return badRequest(res, 'Project name is required');

  const project = new ConstructionProject({
    name: name.trim(),
    projectType, description, society, sector, plotNumber, address,
    clientName, clientContact, notes, tags,
    projectManager: projectManager || null,
    startDate: startDate ? new Date(startDate) : undefined,
    expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : undefined,
    budgetCategories: budgetCategories?.length ? budgetCategories : undefined,
    createdBy: req.user?._id,
    updatedBy: req.user?._id
  });

  await project.save();

  const populated = await ConstructionProject.findById(project._id)
    .populate('projectManager', 'firstName lastName email').lean();

  res.status(201).json({ success: true, message: 'Project created successfully', data: populated });
}));

// PUT /api/project-management/projects/:id — update
router.put('/projects/:id', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const allowed = [
    'name', 'projectType', 'description', 'status', 'society', 'sector',
    'plotNumber', 'address', 'clientName', 'clientContact', 'projectManager',
    'startDate', 'expectedEndDate', 'actualEndDate', 'budgetCategories',
    'notes', 'tags', 'overallProgress', 'linkedProperty'
  ];

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  updates.updatedBy = req.user?._id;

  const project = await ConstructionProject.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('projectManager', 'firstName lastName email').lean();

  if (!project) return notFound(res, 'Project');
  res.json({ success: true, message: 'Project updated successfully', data: project });
}));

// PUT /api/project-management/projects/:id/budget-status — submit or approve budget
router.put('/projects/:id/budget-status', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');
  const { action, notes } = req.body; // action: 'submit' | 'approve' | 'reset'

  const update = { updatedBy: req.user?._id };
  if (action === 'submit') {
    update.budgetStatus = 'Submitted';
    update.budgetSubmittedAt = new Date();
  } else if (action === 'approve') {
    update.budgetStatus = 'Approved';
    update.budgetApprovedBy = req.user?._id;
    update.budgetApprovedAt = new Date();
    update.budgetNotes = notes || '';
  } else if (action === 'reset') {
    update.budgetStatus = 'Draft';
    update.budgetApprovedBy = null;
    update.budgetApprovedAt = null;
  } else {
    return badRequest(res, 'Invalid action. Use submit, approve or reset');
  }

  const project = await ConstructionProject.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    .populate('projectManager', 'firstName lastName email').lean();

  if (!project) return notFound(res, 'Project');
  res.json({ success: true, message: `Budget ${action}d successfully`, data: project });
}));

// PUT /api/project-management/projects/:id/milestones/:milestoneId — update milestone
router.put('/projects/:id/milestones/:milestoneId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const project = await ConstructionProject.findById(req.params.id);
  if (!project) return notFound(res, 'Project');

  const ms = project.milestones.id(req.params.milestoneId);
  if (!ms) return notFound(res, 'Milestone');

  const allowed = ['title', 'description', 'plannedDate', 'actualDate', 'status', 'completionPercentage', 'billingTrigger', 'billingPercentage', 'notes'];
  allowed.forEach(k => { if (req.body[k] !== undefined) ms[k] = req.body[k]; });
  project.updatedBy = req.user?._id;
  await project.save();

  res.json({ success: true, message: 'Milestone updated', data: project });
}));

// POST /api/project-management/projects/:id/milestones — add milestone
router.post('/projects/:id/milestones', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const project = await ConstructionProject.findById(req.params.id);
  if (!project) return notFound(res, 'Project');

  const { title, description, plannedDate, billingTrigger, billingPercentage, notes } = req.body;
  if (!title) return badRequest(res, 'Milestone title is required');

  project.milestones.push({ title, description, plannedDate, billingTrigger, billingPercentage, notes });
  project.updatedBy = req.user?._id;
  await project.save();

  res.status(201).json({ success: true, message: 'Milestone added', data: project });
}));

// DELETE /api/project-management/projects/:id/milestones/:milestoneId
router.delete('/projects/:id/milestones/:milestoneId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const project = await ConstructionProject.findById(req.params.id);
  if (!project) return notFound(res, 'Project');

  project.milestones = project.milestones.filter(m => m._id.toString() !== req.params.milestoneId);
  await project.save();

  res.json({ success: true, message: 'Milestone removed' });
}));

// DELETE /api/project-management/projects/:id — soft-delete (cancel)
router.delete('/projects/:id', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const project = await ConstructionProject.findByIdAndUpdate(
    req.params.id,
    { $set: { status: 'Cancelled', updatedBy: req.user?._id } },
    { new: true }
  );
  if (!project) return notFound(res, 'Project');

  res.json({ success: true, message: 'Project cancelled successfully' });
}));

// ─── BOQ ─────────────────────────────────────────────────────────────────────

// GET /api/project-management/projects/:id/boq
router.get('/projects/:id/boq', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const items = await BOQItem.find({ project: req.params.id })
    .sort({ phase: 1, orderIndex: 1, createdAt: 1 })
    .lean();

  // Group by phase
  const grouped = items.reduce((acc, item) => {
    const ph = item.phase || 'General';
    if (!acc[ph]) acc[ph] = [];
    acc[ph].push(item);
    return acc;
  }, {});

  const totalEstimated = items.reduce((s, i) => s + (i.estimatedTotalCost || 0), 0);
  const totalActual = items.reduce((s, i) => s + (i.actualTotalCost || 0), 0);

  res.json({ success: true, data: { items, grouped, totalEstimated, totalActual } });
}));

// POST /api/project-management/projects/:id/boq — add single item
router.post('/projects/:id/boq', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const { description, unit, estimatedQuantity, estimatedUnitPrice, phase, category, specification, itemCode, notes, orderIndex } = req.body;
  if (!description) return badRequest(res, 'Description is required');
  if (!unit) return badRequest(res, 'Unit is required');
  if (estimatedQuantity == null) return badRequest(res, 'Estimated quantity is required');
  if (estimatedUnitPrice == null) return badRequest(res, 'Estimated unit price is required');

  const item = await BOQItem.create({
    project: req.params.id,
    description, unit, estimatedQuantity, estimatedUnitPrice,
    phase: phase || 'General', category, specification, itemCode, notes,
    orderIndex: orderIndex || 0,
    createdBy: req.user?._id
  });

  res.status(201).json({ success: true, message: 'BOQ item added', data: item });
}));

// POST /api/project-management/projects/:id/boq/bulk — bulk import
router.post('/projects/:id/boq/bulk', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return badRequest(res, 'Items array is required');

  const docs = items.map((item, idx) => ({
    project: req.params.id,
    description: item.description,
    unit: item.unit,
    estimatedQuantity: Number(item.estimatedQuantity) || 0,
    estimatedUnitPrice: Number(item.estimatedUnitPrice) || 0,
    phase: item.phase || 'General',
    category: item.category || '',
    specification: item.specification || '',
    itemCode: item.itemCode || '',
    notes: item.notes || '',
    orderIndex: item.orderIndex ?? idx,
    createdBy: req.user?._id
  }));

  const inserted = await BOQItem.insertMany(docs);
  res.status(201).json({ success: true, message: `${inserted.length} BOQ items added`, data: inserted });
}));

// PUT /api/project-management/projects/:id/boq/:itemId
router.put('/projects/:id/boq/:itemId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.itemId)) return badRequest(res, 'Invalid ID');

  const allowed = ['description', 'unit', 'phase', 'category', 'specification', 'itemCode',
    'estimatedQuantity', 'estimatedUnitPrice', 'orderedQuantity', 'receivedQuantity',
    'usedQuantity', 'actualUnitPrice', 'notes', 'orderIndex'];

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const item = await BOQItem.findOneAndUpdate(
    { _id: req.params.itemId, project: req.params.id },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!item) return notFound(res, 'BOQ item');

  res.json({ success: true, message: 'BOQ item updated', data: item });
}));

// DELETE /api/project-management/projects/:id/boq/:itemId
router.delete('/projects/:id/boq/:itemId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.itemId)) return badRequest(res, 'Invalid ID');

  const item = await BOQItem.findOneAndDelete({ _id: req.params.itemId, project: req.params.id });
  if (!item) return notFound(res, 'BOQ item');

  res.json({ success: true, message: 'BOQ item deleted' });
}));

// ─── TASKS ───────────────────────────────────────────────────────────────────

// GET /api/project-management/projects/:id/tasks
router.get('/projects/:id/tasks', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const tasks = await ProjectTask.find({ project: req.params.id })
    .populate('createdBy', 'firstName lastName')
    .sort({ level: 1, orderIndex: 1, createdAt: 1 })
    .lean();

  // Build tree: phases (level 0) → tasks (level 1) → subtasks (level 2)
  const phases = tasks.filter(t => t.level === 0);
  const byParent = tasks.filter(t => t.level > 0).reduce((acc, t) => {
    const pid = t.parentTask?.toString() || 'root';
    (acc[pid] = acc[pid] || []).push(t);
    return acc;
  }, {});

  const tree = phases.map(phase => ({
    ...phase,
    children: (byParent[phase._id.toString()] || []).map(task => ({
      ...task,
      children: byParent[task._id.toString()] || []
    }))
  }));

  // Include orphan tasks (no parent phase)
  const orphans = tasks.filter(t => t.level === 1 && !t.parentTask);
  if (orphans.length) {
    orphans.forEach(t => tree.push({ ...t, children: byParent[t._id.toString()] || [] }));
  }

  res.json({ success: true, data: { tasks, tree } });
}));

// POST /api/project-management/projects/:id/tasks — create phase or task
router.post('/projects/:id/tasks', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const { title, description, level, parentTask, plannedStartDate, plannedEndDate,
    assignedTo, estimatedLaborCost, notes, orderIndex } = req.body;

  if (!title) return badRequest(res, 'Task title is required');

  const task = await ProjectTask.create({
    project: req.params.id,
    title, description,
    level: level ?? 0,
    parentTask: parentTask || null,
    plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : undefined,
    plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : undefined,
    assignedTo, estimatedLaborCost,
    notes,
    orderIndex: orderIndex ?? 0,
    createdBy: req.user?._id
  });

  res.status(201).json({ success: true, message: 'Task created', data: task });
}));

// PUT /api/project-management/projects/:id/tasks/:taskId
router.put('/projects/:id/tasks/:taskId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.taskId)) return badRequest(res, 'Invalid ID');

  const allowed = ['title', 'description', 'status', 'progressPercent', 'plannedStartDate',
    'plannedEndDate', 'actualStartDate', 'actualEndDate', 'assignedTo',
    'estimatedLaborCost', 'actualLaborCost', 'notes', 'orderIndex', 'dependencies'];

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const task = await ProjectTask.findOneAndUpdate(
    { _id: req.params.taskId, project: req.params.id },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!task) return notFound(res, 'Task');

  // Sync project progress when a task's progress changes
  if (updates.progressPercent !== undefined) {
    await syncProjectProgress(req.params.id);
  }

  res.json({ success: true, message: 'Task updated', data: task });
}));

// DELETE /api/project-management/projects/:id/tasks/:taskId
router.delete('/projects/:id/tasks/:taskId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.taskId)) return badRequest(res, 'Invalid ID');

  // Also delete child tasks
  await ProjectTask.deleteMany({ parentTask: req.params.taskId });
  const task = await ProjectTask.findOneAndDelete({ _id: req.params.taskId, project: req.params.id });
  if (!task) return notFound(res, 'Task');

  res.json({ success: true, message: 'Task deleted' });
}));

// ─── EXPENSES ────────────────────────────────────────────────────────────────

// GET /api/project-management/projects/:id/expenses
router.get('/projects/:id/expenses', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const { category, paymentStatus, page = 1, limit = 50 } = req.query;
  const filter = { project: req.params.id };
  if (category) filter.category = category;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const skip = (Number(page) - 1) * Number(limit);
  const [expenses, total] = await Promise.all([
    ProjectExpense.find(filter)
      .populate('approvedBy', 'firstName lastName')
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ProjectExpense.countDocuments(filter)
  ]);

  // Category-wise summary
  const summary = await ProjectExpense.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(req.params.id), paymentStatus: { $ne: 'Cancelled' } } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      expenses,
      summary,
      pagination: { total, page: Number(page), limit: Number(limit) }
    }
  });
}));

// POST /api/project-management/projects/:id/expenses — add expense
router.post('/projects/:id/expenses', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const { category, description, amount, expenseDate, vendor, invoiceNumber,
    paymentStatus, paymentMethod, paymentDate, task, notes } = req.body;

  if (!description) return badRequest(res, 'Description is required');
  if (!category) return badRequest(res, 'Category is required');
  if (!amount || Number(amount) <= 0) return badRequest(res, 'Valid amount is required');

  const expense = await ProjectExpense.create({
    project: req.params.id,
    category, description,
    amount: Number(amount),
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    vendor, invoiceNumber,
    paymentStatus: paymentStatus || 'Pending',
    paymentMethod: paymentMethod || 'Bank Transfer',
    paymentDate: paymentDate ? new Date(paymentDate) : undefined,
    task: task || null,
    notes,
    createdBy: req.user?._id
  });

  await syncProjectActuals(req.params.id);
  res.status(201).json({ success: true, message: 'Expense recorded', data: expense });
}));

// PUT /api/project-management/projects/:id/expenses/:expenseId
router.put('/projects/:id/expenses/:expenseId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.expenseId)) return badRequest(res, 'Invalid ID');

  const allowed = ['category', 'description', 'amount', 'expenseDate', 'vendor',
    'invoiceNumber', 'paymentStatus', 'paymentMethod', 'paymentDate', 'notes'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const expense = await ProjectExpense.findOneAndUpdate(
    { _id: req.params.expenseId, project: req.params.id },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!expense) return notFound(res, 'Expense');

  await syncProjectActuals(req.params.id);
  res.json({ success: true, message: 'Expense updated', data: expense });
}));

// DELETE /api/project-management/projects/:id/expenses/:expenseId
router.delete('/projects/:id/expenses/:expenseId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.expenseId)) return badRequest(res, 'Invalid ID');

  const expense = await ProjectExpense.findOneAndDelete({ _id: req.params.expenseId, project: req.params.id });
  if (!expense) return notFound(res, 'Expense');

  await syncProjectActuals(req.params.id);
  res.json({ success: true, message: 'Expense deleted' });
}));

// ─── DAILY PROGRESS REPORTS ──────────────────────────────────────────────────

// GET /api/project-management/projects/:id/dpr
router.get('/projects/:id/dpr', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [reports, total] = await Promise.all([
    DailyProgressReport.find({ project: req.params.id })
      .populate('submittedBy', 'firstName lastName')
      .sort({ reportDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    DailyProgressReport.countDocuments({ project: req.params.id })
  ]);

  res.json({
    success: true,
    data: { reports, pagination: { total, page: Number(page), limit: Number(limit) } }
  });
}));

// GET /api/project-management/projects/:id/dpr/:dprId — single DPR
router.get('/projects/:id/dpr/:dprId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.dprId)) return badRequest(res, 'Invalid ID');

  const report = await DailyProgressReport.findOne({ _id: req.params.dprId, project: req.params.id })
    .populate('submittedBy', 'firstName lastName')
    .populate('workDone.task', 'title level')
    .lean();

  if (!report) return notFound(res, 'DPR');
  res.json({ success: true, data: report });
}));

// POST /api/project-management/projects/:id/dpr — submit DPR with optional photo uploads
router.post('/projects/:id/dpr', upload.array('photos', 20), asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const {
    reportDate, weather, temperature,
    workforceCivil, workforceElectrical, workforcePlumbing, workforceSupervisors,
    summary, nextDayPlan
  } = req.body;

  if (!reportDate) return badRequest(res, 'Report date is required');

  // Parse JSON arrays from multipart form
  const parseField = (field) => {
    try { return typeof field === 'string' ? JSON.parse(field) : field || []; }
    catch { return []; }
  };

  const workDone = parseField(req.body.workDone);
  const materialsUsed = parseField(req.body.materialsUsed);
  const issues = parseField(req.body.issues);

  // Build photos array from uploaded files
  const photos = (req.files || []).map((f, idx) => ({
    url: `/uploads/project-management/${f.filename}`,
    caption: (parseField(req.body.photoCaptions))[idx] || '',
    uploadedAt: new Date()
  }));

  const report = await DailyProgressReport.create({
    project: req.params.id,
    reportDate: new Date(reportDate),
    weather, temperature,
    workforceCivil: Number(workforceCivil) || 0,
    workforceElectrical: Number(workforceElectrical) || 0,
    workforcePlumbing: Number(workforcePlumbing) || 0,
    workforceSupervisors: Number(workforceSupervisors) || 0,
    workDone, materialsUsed, issues, photos,
    summary, nextDayPlan,
    submittedBy: req.user?._id,
    createdBy: req.user?._id
  });

  res.status(201).json({ success: true, message: 'DPR submitted successfully', data: report });
}));

// DELETE /api/project-management/projects/:id/dpr/:dprId
router.delete('/projects/:id/dpr/:dprId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.dprId)) return badRequest(res, 'Invalid ID');

  const report = await DailyProgressReport.findOneAndDelete({ _id: req.params.dprId, project: req.params.id });
  if (!report) return notFound(res, 'DPR');

  // Clean up uploaded photos
  report.photos?.forEach(p => {
    const filePath = path.join(__dirname, '..', p.url);
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  });

  res.json({ success: true, message: 'DPR deleted' });
}));

// ─── BOQ → PURCHASE ORDER ─────────────────────────────────────────────────────

// POST /api/project-management/projects/:id/boq/create-po
// Creates a PurchaseOrder from selected BOQ items, updates BOQ item tracked quantities
router.post('/projects/:id/boq/create-po', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const { vendorId, expectedDeliveryDate, deliveryAddress, notes, items } = req.body;

  if (!vendorId) return badRequest(res, 'Vendor is required');
  if (!expectedDeliveryDate) return badRequest(res, 'Expected delivery date is required');
  if (!Array.isArray(items) || !items.length) return badRequest(res, 'At least one item is required');

  // Validate vendor exists
  const vendor = await Supplier.findById(vendorId).lean();
  if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

  // Load project for reference
  const project = await ConstructionProject.findById(req.params.id).lean();
  if (!project) return notFound(res, 'Project');

  // Build PO items (calculate amounts)
  const poItems = items.map(item => ({
    description: item.description,
    specification: item.specification || '',
    quantity: Number(item.quantity),
    unit: item.unit,
    unitPrice: Number(item.unitPrice),
    taxRate: Number(item.taxRate) || 0,
    discount: Number(item.discount) || 0,
    amount: Number(item.quantity) * Number(item.unitPrice)
  }));

  const subtotal = poItems.reduce((s, i) => s + i.amount, 0);
  const taxAmount = poItems.reduce((s, i) => s + (i.amount * (i.taxRate / 100)), 0);

  // Create PO in existing procurement system
  const po = new PurchaseOrder({
    vendor: vendorId,
    orderDate: new Date(),
    expectedDeliveryDate: new Date(expectedDeliveryDate),
    deliveryAddress: deliveryAddress || project.address || '',
    items: poItems,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    notes: notes || '',
    internalNotes: `Created from Construction Project: ${project.name} (${project.projectNumber})`,
    status: 'Draft',
    createdBy: req.user?._id
  });

  await po.save();

  // Update each BOQ item's orderedQuantity and link PO
  const boqUpdates = items.filter(i => i.boqItemId && isValidId(i.boqItemId));
  await Promise.all(boqUpdates.map(item =>
    BOQItem.findByIdAndUpdate(item.boqItemId, {
      $inc: { orderedQuantity: Number(item.quantity) },
      $addToSet: { linkedPurchaseOrders: po._id }
    })
  ));

  // Update project totalCommitted
  await ConstructionProject.findByIdAndUpdate(req.params.id, {
    $inc: { totalCommitted: po.totalAmount }
  });

  const populated = await PurchaseOrder.findById(po._id)
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName')
    .lean();

  res.status(201).json({
    success: true,
    message: `Purchase Order ${po.orderNumber} created successfully`,
    data: populated
  });
}));

// GET /api/project-management/projects/:id/purchase-orders
// Returns all POs linked to any BOQ item in this project
router.get('/projects/:id/purchase-orders', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  // Collect all PO IDs from BOQ items
  const boqItems = await BOQItem.find({ project: req.params.id }, 'linkedPurchaseOrders').lean();
  const poIds = [...new Set(boqItems.flatMap(b => (b.linkedPurchaseOrders || []).map(id => id.toString())))];

  if (!poIds.length) return res.json({ success: true, data: [] });

  const pos = await PurchaseOrder.find({ _id: { $in: poIds } })
    .populate('vendor', 'name email phone')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: pos });
}));

// ─── PROJECT INVOICES (MILESTONE BILLING) ────────────────────────────────────

// Helper: sync totalInvoiced on project
const syncProjectInvoiceTotals = async (projectId) => {
  const [{ total } = { total: 0 }] = await ProjectInvoice.aggregate([
    { $match: { project: new mongoose.Types.ObjectId(projectId), status: { $nin: ['Cancelled'] } } },
    { $group: { _id: null, total: { $sum: '$invoiceAmount' } } }
  ]);
  await ConstructionProject.findByIdAndUpdate(projectId, { totalInvoiced: total });
};

// GET /api/project-management/projects/:id/invoices
router.get('/projects/:id/invoices', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const invoices = await ProjectInvoice.find({ project: req.params.id })
    .populate('createdBy', 'firstName lastName')
    .sort({ issueDate: -1 })
    .lean();

  // Summary stats
  const totalInvoiced = invoices.filter(i => i.status !== 'Cancelled').reduce((s, i) => s + i.invoiceAmount, 0);
  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.paidAmount || i.invoiceAmount), 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  res.json({ success: true, data: { invoices, totalInvoiced, totalPaid, totalOutstanding } });
}));

// POST /api/project-management/projects/:id/invoices — manual invoice creation
router.post('/projects/:id/invoices', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const project = await ConstructionProject.findById(req.params.id).lean();
  if (!project) return notFound(res, 'Project');

  const { invoiceAmount, description, issueDate, dueDate, billingPercentage,
    milestoneId, milestoneName, notes, clientName, clientContact, clientAddress } = req.body;

  if (!invoiceAmount || Number(invoiceAmount) <= 0)
    return badRequest(res, 'Invoice amount is required');

  const invoice = await ProjectInvoice.create({
    project: req.params.id,
    milestoneId: milestoneId || null,
    milestoneName: milestoneName || '',
    clientName: clientName || project.clientName || '',
    clientContact: clientContact || project.clientContact || '',
    clientAddress: clientAddress || project.address || '',
    contractValue: project.contractValue || 0,
    billingPercentage: Number(billingPercentage) || 0,
    invoiceAmount: Number(invoiceAmount),
    description: description || '',
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    dueDate: dueDate ? new Date(dueDate) : undefined,
    notes,
    createdBy: req.user?._id
  });

  await syncProjectInvoiceTotals(req.params.id);
  res.status(201).json({ success: true, message: 'Invoice created', data: invoice });
}));

// POST /api/project-management/projects/:id/milestones/:msId/generate-invoice
// Auto-generate invoice from a milestone with billingTrigger
router.post('/projects/:id/milestones/:msId/generate-invoice', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return badRequest(res, 'Invalid project ID');

  const project = await ConstructionProject.findById(req.params.id);
  if (!project) return notFound(res, 'Project');

  const ms = project.milestones.id(req.params.msId);
  if (!ms) return notFound(res, 'Milestone');

  if (!ms.billingTrigger) return badRequest(res, 'This milestone does not have billing trigger enabled');
  if (!project.contractValue) return badRequest(res, 'Project contract value is not set. Please set it before generating invoices.');

  const invoiceAmount = (ms.billingPercentage / 100) * project.contractValue;
  if (invoiceAmount <= 0) return badRequest(res, 'Calculated invoice amount is zero. Check billing percentage and contract value.');

  // Check if invoice already generated for this milestone
  const existing = await ProjectInvoice.findOne({ project: req.params.id, milestoneId: ms._id });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Invoice ${existing.invoiceNumber} already generated for this milestone`
    });
  }

  const dueDate = req.body.dueDate
    ? new Date(req.body.dueDate)
    : ms.plannedDate ? new Date(ms.plannedDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const invoice = await ProjectInvoice.create({
    project: req.params.id,
    milestoneId: ms._id,
    milestoneName: ms.title,
    clientName: project.clientName || '',
    clientContact: project.clientContact || '',
    clientAddress: project.address || '',
    contractValue: project.contractValue,
    billingPercentage: ms.billingPercentage,
    invoiceAmount,
    description: `Milestone payment: ${ms.title} (${ms.billingPercentage}% of contract value)`,
    issueDate: new Date(),
    dueDate,
    notes: req.body.notes || '',
    createdBy: req.user?._id
  });

  await syncProjectInvoiceTotals(req.params.id);
  res.status(201).json({ success: true, message: `Invoice ${invoice.invoiceNumber} generated for milestone "${ms.title}"`, data: invoice });
}));

// PUT /api/project-management/projects/:id/invoices/:invoiceId
router.put('/projects/:id/invoices/:invoiceId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.invoiceId)) return badRequest(res, 'Invalid ID');

  const allowed = ['status', 'invoiceAmount', 'description', 'issueDate', 'dueDate',
    'paidAmount', 'paidDate', 'paymentMethod', 'paymentReference', 'notes',
    'clientName', 'clientContact', 'clientAddress', 'billingPercentage'];

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  const invoice = await ProjectInvoice.findOneAndUpdate(
    { _id: req.params.invoiceId, project: req.params.id },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!invoice) return notFound(res, 'Invoice');

  await syncProjectInvoiceTotals(req.params.id);
  res.json({ success: true, message: 'Invoice updated', data: invoice });
}));

// DELETE /api/project-management/projects/:id/invoices/:invoiceId
router.delete('/projects/:id/invoices/:invoiceId', asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id) || !isValidId(req.params.invoiceId)) return badRequest(res, 'Invalid ID');

  const invoice = await ProjectInvoice.findOneAndDelete({
    _id: req.params.invoiceId, project: req.params.id
  });
  if (!invoice) return notFound(res, 'Invoice');

  await syncProjectInvoiceTotals(req.params.id);
  res.json({ success: true, message: 'Invoice deleted' });
}));

module.exports = router;
