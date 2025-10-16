const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const CorrectiveAction = require('../models/audit/CorrectiveAction');
const AuditFinding = require('../models/audit/AuditFinding');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

// Helper function for population
const populateCorrectiveAction = (query) => query
  .populate('auditFinding', 'title description severity')
  .populate('responsiblePerson', 'firstName lastName email')
  .populate('createdBy', 'firstName lastName email')
  .populate('updatedBy', 'firstName lastName email')
  .populate('comments.createdBy', 'firstName lastName email');

// @route   GET /api/audit/corrective-actions
// @desc    Get all corrective actions with filters and pagination
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/', authorize('super_admin', 'audit_manager', 'auditor'), asyncHandler(async (req, res) => {
  const { auditFinding, status, responsiblePerson, dueDate, search, page = 1, limit = 10 } = req.query;

  const query = {};
  if (auditFinding) query.auditFinding = auditFinding;
  if (status) query.status = status;
  if (responsiblePerson) query.responsiblePerson = responsiblePerson;
  if (dueDate) query.dueDate = { $lte: new Date(dueDate) }; // Overdue items
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const options = {
    skip: (page - 1) * limit,
    limit: parseInt(limit),
    sort: { createdAt: -1 },
  };

  const actions = await populateCorrectiveAction(CorrectiveAction.find(query, null, options));
  const total = await CorrectiveAction.countDocuments(query);

  res.json({
    success: true,
    count: actions.length,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    data: actions,
  });
}));

// @route   GET /api/audit/corrective-actions/:id
// @desc    Get single corrective action by ID
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/:id', authorize('super_admin', 'audit_manager', 'auditor'), asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid corrective action ID' });
  }

  const action = await populateCorrectiveAction(CorrectiveAction.findById(req.params.id));

  if (!action) {
    return res.status(404).json({ success: false, message: 'Corrective action not found' });
  }

  res.json({ success: true, data: action });
}));

// @route   POST /api/audit/corrective-actions
// @desc    Create a new corrective action
// @access  Private (Super Admin, Audit Manager)
router.post('/', authorize('super_admin', 'audit_manager'), [
  body('auditFinding').isMongoId().withMessage('Valid audit finding ID is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('responsiblePerson').isMongoId().withMessage('Valid responsible person ID is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { auditFinding, description, responsiblePerson, dueDate } = req.body;

  // Validate audit finding exists
  const existingFinding = await AuditFinding.findById(auditFinding);
  if (!existingFinding) {
    return res.status(400).json({ success: false, message: 'Audit finding not found' });
  }

  // Validate responsible person exists
  const existingPerson = await User.findById(responsiblePerson);
  if (!existingPerson) {
    return res.status(400).json({ success: false, message: 'Responsible person not found' });
  }

  const action = await CorrectiveAction.create({
    auditFinding,
    description,
    responsiblePerson,
    dueDate,
    createdBy: req.user.id,
  });

  res.status(201).json({ success: true, data: action });
}));

// @route   PUT /api/audit/corrective-actions/:id
// @desc    Update a corrective action
// @access  Private (Super Admin, Audit Manager, Auditor)
router.put('/:id', authorize('super_admin', 'audit_manager', 'auditor'), [
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('responsiblePerson').optional().isMongoId().withMessage('Valid responsible person ID is required'),
  body('dueDate').optional().isISO8601().withMessage('Valid due date is required'),
  body('status').optional().isIn(['Open', 'In Progress', 'Completed', 'Verified', 'Overdue']).withMessage('Invalid status'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid corrective action ID' });
  }

  const { responsiblePerson, ...updateData } = req.body;

  if (responsiblePerson) {
    const existingPerson = await User.findById(responsiblePerson);
    if (!existingPerson) {
      return res.status(400).json({ success: false, message: 'Responsible person not found' });
    }
    updateData.responsiblePerson = responsiblePerson;
  }

  const action = await CorrectiveAction.findByIdAndUpdate(
    req.params.id, { ...updateData, updatedBy: req.user.id }, { new: true, runValidators: true }
  );

  if (!action) {
    return res.status(404).json({ success: false, message: 'Corrective action not found' });
  }

  res.json({ success: true, data: action });
}));

// @route   DELETE /api/audit/corrective-actions/:id
// @desc    Delete a corrective action
// @access  Private (Super Admin, Audit Manager)
router.delete('/:id', authorize('super_admin', 'audit_manager'), asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid corrective action ID' });
  }

  const action = await CorrectiveAction.findByIdAndDelete(req.params.id);

  if (!action) {
    return res.status(404).json({ success: false, message: 'Corrective action not found' });
  }

  res.json({ success: true, message: 'Corrective action deleted successfully' });
}));

// @route   POST /api/audit/corrective-actions/:id/comments
// @desc    Add a comment to a corrective action
// @access  Private (Super Admin, Audit Manager, Auditor)
router.post('/:id/comments', authorize('super_admin', 'audit_manager', 'auditor'), [
  body('text').notEmpty().withMessage('Comment text is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid corrective action ID' });
  }

  const { text } = req.body;

  const action = await CorrectiveAction.findByIdAndUpdate(
    req.params.id,
    { $push: { comments: { text, createdBy: req.user.id } } },
    { new: true, runValidators: true }
  );

  if (!action) {
    return res.status(404).json({ success: false, message: 'Corrective action not found' });
  }

  res.json({ success: true, data: action });
}));

module.exports = router;
