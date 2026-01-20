const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const AuditSchedule = require('../models/audit/AuditSchedule');
const Audit = require('../models/audit/Audit');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

// Helper function for population
const populateAuditSchedule = (query) => query
  .populate('audit', 'objective auditType priority')
  .populate('leadAuditor', 'firstName lastName email')
  .populate('teamAuditors', 'firstName lastName email')
  .populate('createdBy', 'firstName lastName email')
  .populate('updatedBy', 'firstName lastName email');

// @route   GET /api/audit/schedules
// @desc    Get all audit schedules with filters and pagination
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/', authorize('super_admin', 'audit_manager', 'auditor', 'audit_director'), asyncHandler(async (req, res) => {
  const { status, leadAuditor, scheduledDate, search, page = 1, limit = 10 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (leadAuditor) query.leadAuditor = leadAuditor;
  if (scheduledDate) {
    const date = new Date(scheduledDate);
    query.scheduledDate = {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    };
  }
  if (search) {
    query.$or = [
      { notes: { $regex: search, $options: 'i' } },
    ];
  }

  const options = {
    skip: (page - 1) * limit,
    limit: parseInt(limit),
    sort: { scheduledDate: 1 },
  };

  const schedules = await populateAuditSchedule(AuditSchedule.find(query, null, options));
  const total = await AuditSchedule.countDocuments(query);

  res.json({
    success: true,
    count: schedules.length,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    data: schedules,
  });
}));

// @route   GET /api/audit/schedules/:id
// @desc    Get single audit schedule by ID
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/:id', authorize('super_admin', 'audit_manager', 'auditor', 'audit_director'), asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid schedule ID' });
  }

  const schedule = await populateAuditSchedule(AuditSchedule.findById(req.params.id));

  if (!schedule) {
    return res.status(404).json({ success: false, message: 'Audit schedule not found' });
  }

  res.json({ success: true, data: schedule });
}));

// @route   POST /api/audit/schedules
// @desc    Create a new audit schedule
// @access  Private (Super Admin, Audit Manager)
router.post('/', authorize('super_admin', 'audit_manager', 'audit_director'), [
  body('audit').isMongoId().withMessage('Valid audit ID is required'),
  body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required'),
  body('leadAuditor').isMongoId().withMessage('Valid lead auditor ID is required'),
  body('teamAuditors').optional().isArray().withMessage('Team auditors must be an array'),
  body('teamAuditors.*').optional().isMongoId().withMessage('Invalid team auditor ID'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { audit, scheduledDate, leadAuditor, teamAuditors = [], notes } = req.body;

  // Validate audit exists
  const existingAudit = await Audit.findById(audit);
  if (!existingAudit) {
    return res.status(400).json({ success: false, message: 'Audit not found' });
  }

  // Validate lead auditor exists
  const existingLeadAuditor = await User.findById(leadAuditor);
  if (!existingLeadAuditor) {
    return res.status(400).json({ success: false, message: 'Lead auditor not found' });
  }

  // Validate team auditors exist
  if (teamAuditors.length > 0) {
    const existingTeamAuditors = await User.find({ _id: { $in: teamAuditors } });
    if (existingTeamAuditors.length !== teamAuditors.length) {
      return res.status(400).json({ success: false, message: 'One or more team auditors not found' });
    }
  }

  const schedule = await AuditSchedule.create({
    audit,
    scheduledDate,
    leadAuditor,
    teamAuditors,
    notes,
    createdBy: req.user.id,
  });

  res.status(201).json({ success: true, data: schedule });
}));

// @route   PUT /api/audit/schedules/:id
// @desc    Update an audit schedule
// @access  Private (Super Admin, Audit Manager)
router.put('/:id', authorize('super_admin', 'audit_manager', 'audit_director'), [
  body('scheduledDate').optional().isISO8601().withMessage('Valid scheduled date is required'),
  body('leadAuditor').optional().isMongoId().withMessage('Valid lead auditor ID is required'),
  body('teamAuditors').optional().isArray().withMessage('Team auditors must be an array'),
  body('teamAuditors.*').optional().isMongoId().withMessage('Invalid team auditor ID'),
  body('status').optional().isIn(['Scheduled', 'Rescheduled', 'Completed', 'Cancelled']).withMessage('Invalid status'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid schedule ID' });
  }

  const { leadAuditor, teamAuditors, ...updateData } = req.body;

  if (leadAuditor) {
    const existingLeadAuditor = await User.findById(leadAuditor);
    if (!existingLeadAuditor) {
      return res.status(400).json({ success: false, message: 'Lead auditor not found' });
    }
    updateData.leadAuditor = leadAuditor;
  }

  if (teamAuditors) {
    const existingTeamAuditors = await User.find({ _id: { $in: teamAuditors } });
    if (existingTeamAuditors.length !== teamAuditors.length) {
      return res.status(400).json({ success: false, message: 'One or more team auditors not found' });
    }
    updateData.teamAuditors = teamAuditors;
  }

  const schedule = await AuditSchedule.findByIdAndUpdate(
    req.params.id, { ...updateData, updatedBy: req.user.id }, { new: true, runValidators: true }
  );

  if (!schedule) {
    return res.status(404).json({ success: false, message: 'Audit schedule not found' });
  }

  res.json({ success: true, data: schedule });
}));

// @route   DELETE /api/audit/schedules/:id
// @desc    Delete an audit schedule
// @access  Private (Super Admin, Audit Manager)
router.delete('/:id', authorize('super_admin', 'audit_manager', 'audit_director'), asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid schedule ID' });
  }

  const schedule = await AuditSchedule.findByIdAndDelete(req.params.id);

  if (!schedule) {
    return res.status(404).json({ success: false, message: 'Audit schedule not found' });
  }

  res.json({ success: true, message: 'Audit schedule deleted successfully' });
}));

// @route   GET /api/audit/schedules/upcoming
// @desc    Get upcoming audit schedules
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/upcoming', authorize('super_admin', 'audit_manager', 'auditor', 'audit_director'), asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + parseInt(days));

  const schedules = await populateAuditSchedule(
    AuditSchedule.find({
      scheduledDate: { $gte: today, $lte: futureDate },
      status: { $in: ['Scheduled', 'Rescheduled'] }
    }).sort({ scheduledDate: 1 })
  );

  res.json({ success: true, data: schedules });
}));

// @route   GET /api/audit/schedules/overdue
// @desc    Get overdue audit schedules
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/overdue', authorize('super_admin', 'audit_manager', 'auditor', 'audit_director'), asyncHandler(async (req, res) => {
  const today = new Date();

  const schedules = await populateAuditSchedule(
    AuditSchedule.find({
      scheduledDate: { $lt: today },
      status: { $in: ['Scheduled', 'Rescheduled'] }
    }).sort({ scheduledDate: 1 })
  );

  res.json({ success: true, data: schedules });
}));

module.exports = router;
