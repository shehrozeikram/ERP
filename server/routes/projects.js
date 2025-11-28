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
    const query = { status: status || 'Active' };
    
    if (company) query.company = company;
    if (search) query.name = { $regex: search, $options: 'i' };

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
  body('name').trim().notEmpty().withMessage('Project name is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    // Check if project with same name already exists
    const existingProject = await Project.findOne({ name: req.body.name.trim() });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: 'A project with this name already exists'
      });
    }

    // Build project data with defaults
    const projectData = {
      name: req.body.name.trim(),
      status: 'Active',
      createdBy: req.user.id,
      projectManager: req.user.id,
      ...(req.body.description?.trim() && { description: req.body.description.trim() }),
      ...(req.body.client?.trim() && { client: req.body.client.trim() }),
      ...(req.body.startDate && { startDate: new Date(req.body.startDate) }),
      ...(req.body.budget && { budget: parseFloat(req.body.budget) })
    };

    const project = new Project(projectData);
  await project.save();

  const populatedProject = await Project.findById(project._id)
      .populate('projectManager', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');

    return res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: populatedProject
  });
  } catch (error) {
    console.error('Error creating project:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const fieldName = field === 'projectId' ? 'project ID' : field || 'field';
      return res.status(400).json({
        success: false,
        message: `A project with this ${fieldName} already exists`
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Error creating project'
    });
  }
}));

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private (HR and Admin)
router.put('/:id', [
  authorize('super_admin', 'admin', 'hr_manager'),
  body('name').optional().trim().notEmpty().withMessage('Project name is required'),
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
      { status: 'Cancelled' },
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