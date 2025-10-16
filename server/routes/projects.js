const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Project = require('../models/hr/Project');

const router = express.Router();

// @route   GET /api/projects
// @desc    Get all projects
// @access  Private (HR and Admin)
router.get('/', 
  authorize('super_admin', 'admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { company, status, search } = req.query;
    
    const query = { isActive: true };
    
    if (company) {
      query.company = company;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const projects = await Project.find(query)
      .populate('projectManager', 'firstName lastName employeeId')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: projects
    });
  })
);

// @route   GET /api/projects/:id
// @desc    Get project by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('super_admin', 'admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(req.params.id)
      .populate('projectManager', 'firstName lastName employeeId');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      data: project
    });
  })
);

// @route   POST /api/projects
// @desc    Create new project
// @access  Private (HR and Admin)
router.post('/', [
  authorize('super_admin', 'admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('code').trim().notEmpty().withMessage('Project code is required'),
  body('startDate').notEmpty().withMessage('Start date is required'),
  body('status').optional().isIn(['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']).withMessage('Valid status is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const project = new Project(req.body);
  await project.save();

  const populatedProject = await Project.findById(project._id)
    .populate('projectManager', 'firstName lastName employeeId');

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: populatedProject
  });
}));

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('super_admin', 'admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Project name is required'),
  body('code').optional().trim().notEmpty().withMessage('Project code is required'),
  body('client').optional().trim().notEmpty().withMessage('Client is required'),
  body('status').optional().isIn(['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']).withMessage('Valid status is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid project ID format'
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

  const project = await Project.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('projectManager', 'firstName lastName employeeId');

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  res.json({
    success: true,
    message: 'Project updated successfully',
    data: project
  });
}));

// @route   DELETE /api/projects/:id
// @desc    Delete project (soft delete)
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('super_admin', 'admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format'
      });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  })
);

module.exports = router; 