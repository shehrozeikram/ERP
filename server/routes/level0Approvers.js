const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Level0ApproverAssignment = require('../models/hr/Level0ApproverAssignment');
const User = require('../models/User');
const Employee = require('../models/hr/Employee');
const Project = require('../models/hr/Project');
const Department = require('../models/hr/Department');

// @route   GET /api/level0-approvers
// @desc    Get all Level 0 approver assignments
// @access  Private
router.get('/', async (req, res) => {
  try {
    const assignments = await Level0ApproverAssignment.getAllActive();
    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching Level 0 approver assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Level 0 approver assignments'
    });
  }
});

// @route   GET /api/level0-approvers/:id
// @desc    Get a specific Level 0 approver assignment
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const assignment = await Level0ApproverAssignment.findById(req.params.id)
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('assignedProjects', 'name projectId code status')
      .populate('assignedDepartments', 'name code')
      .populate('departmentProjectAssignments.project', 'name projectId code status')
      .populate('departmentProjectAssignments.department', 'name code');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Level 0 approver assignment not found'
      });
    }

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Error fetching Level 0 approver assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Level 0 approver assignment'
    });
  }
});

// @route   POST /api/level0-approvers
// @desc    Create a new Level 0 approver assignment
// @access  Private
router.post('/', [
  body('assignedUser').isMongoId().withMessage('Valid user ID is required'),
  body('assignmentType').isIn(['project', 'department', 'department_project']).withMessage('Valid assignment type is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { assignedUser, assignmentType, assignedProjects, assignedDepartments, departmentProjectAssignments } = req.body;

    // Validate user exists
    const user = await User.findById(assignedUser);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found'
      });
    }

    // Find employee record if exists
    const employee = await Employee.findOne({ user: assignedUser });

    // Validate based on assignment type
    if (assignmentType === 'project') {
      if (!assignedProjects || assignedProjects.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one project must be assigned for project-level assignment'
        });
      }
      // Validate projects exist
      const projects = await Project.find({ _id: { $in: assignedProjects } });
      if (projects.length !== assignedProjects.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more projects not found'
        });
      }
    } else if (assignmentType === 'department') {
      if (!assignedDepartments || assignedDepartments.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one department must be assigned for department-level assignment'
        });
      }
      // Validate departments exist
      const departments = await Department.find({ _id: { $in: assignedDepartments } });
      if (departments.length !== assignedDepartments.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more departments not found'
        });
      }
    } else if (assignmentType === 'department_project') {
      if (!departmentProjectAssignments || departmentProjectAssignments.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one department-project combination must be assigned'
        });
      }
      // Validate all department-project combinations
      for (const dp of departmentProjectAssignments) {
        if (!dp.project || !dp.department) {
          return res.status(400).json({
            success: false,
            error: 'Each department-project assignment must have both project and department'
          });
        }
        const project = await Project.findById(dp.project);
        const department = await Department.findById(dp.department);
        if (!project || !department) {
          return res.status(400).json({
            success: false,
            error: `Invalid project or department in assignment: ${dp.project} / ${dp.department}`
          });
        }
      }
    }

    const assignment = new Level0ApproverAssignment({
      assignedUser,
      assignedEmployee: employee ? employee._id : null,
      assignmentType,
      assignedProjects: assignmentType === 'project' ? assignedProjects : [],
      assignedDepartments: assignmentType === 'department' ? assignedDepartments : [],
      departmentProjectAssignments: assignmentType === 'department_project' ? departmentProjectAssignments : [],
      isActive: true,
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    });

    await assignment.save();

    const populated = await Level0ApproverAssignment.findById(assignment._id)
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('assignedProjects', 'name projectId code status')
      .populate('assignedDepartments', 'name code')
      .populate('departmentProjectAssignments.project', 'name projectId code status')
      .populate('departmentProjectAssignments.department', 'name code');

    res.status(201).json({
      success: true,
      message: 'Level 0 approver assignment created successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error creating Level 0 approver assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Level 0 approver assignment',
      message: error.message
    });
  }
});

// @route   PUT /api/level0-approvers/:id
// @desc    Update a Level 0 approver assignment
// @access  Private
router.put('/:id', [
  body('assignmentType').optional().isIn(['project', 'department', 'department_project']).withMessage('Valid assignment type is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const assignment = await Level0ApproverAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Level 0 approver assignment not found'
      });
    }

    const { assignmentType, assignedProjects, assignedDepartments, departmentProjectAssignments, isActive } = req.body;

    // Update assignment type if provided
    if (assignmentType) {
      assignment.assignmentType = assignmentType;
    }

    // Update assignments based on type
    if (assignmentType === 'project' && assignedProjects) {
      // Validate projects exist
      const projects = await Project.find({ _id: { $in: assignedProjects } });
      if (projects.length !== assignedProjects.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more projects not found'
        });
      }
      assignment.assignedProjects = assignedProjects;
      assignment.assignedDepartments = [];
      assignment.departmentProjectAssignments = [];
    } else if (assignmentType === 'department' && assignedDepartments) {
      // Validate departments exist
      const departments = await Department.find({ _id: { $in: assignedDepartments } });
      if (departments.length !== assignedDepartments.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more departments not found'
        });
      }
      assignment.assignedDepartments = assignedDepartments;
      assignment.assignedProjects = [];
      assignment.departmentProjectAssignments = [];
    } else if (assignmentType === 'department_project' && departmentProjectAssignments) {
      // Validate all department-project combinations
      for (const dp of departmentProjectAssignments) {
        if (!dp.project || !dp.department) {
          return res.status(400).json({
            success: false,
            error: 'Each department-project assignment must have both project and department'
          });
        }
        const project = await Project.findById(dp.project);
        const department = await Department.findById(dp.department);
        if (!project || !department) {
          return res.status(400).json({
            success: false,
            error: `Invalid project or department in assignment: ${dp.project} / ${dp.department}`
          });
        }
      }
      assignment.departmentProjectAssignments = departmentProjectAssignments;
      assignment.assignedProjects = [];
      assignment.assignedDepartments = [];
    }

    if (isActive !== undefined) {
      assignment.isActive = isActive;
    }

    assignment.updatedBy = req.user?._id;
    await assignment.save();

    const populated = await Level0ApproverAssignment.findById(assignment._id)
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('assignedProjects', 'name projectId code status')
      .populate('assignedDepartments', 'name code')
      .populate('departmentProjectAssignments.project', 'name projectId code status')
      .populate('departmentProjectAssignments.department', 'name code');

    res.json({
      success: true,
      message: 'Level 0 approver assignment updated successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error updating Level 0 approver assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update Level 0 approver assignment',
      message: error.message
    });
  }
});

// @route   DELETE /api/level0-approvers/:id
// @desc    Delete a Level 0 approver assignment (soft delete by setting isActive to false)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const assignment = await Level0ApproverAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Level 0 approver assignment not found'
      });
    }

    assignment.isActive = false;
    assignment.updatedBy = req.user?._id;
    await assignment.save();

    res.json({
      success: true,
      message: 'Level 0 approver assignment deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating Level 0 approver assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate Level 0 approver assignment'
    });
  }
});

// @route   GET /api/level0-approvers/project/:projectId
// @desc    Get all Level 0 approvers for a specific project
// @access  Private
router.get('/project/:projectId', async (req, res) => {
  try {
    const approvers = await Level0ApproverAssignment.getApproversForProject(req.params.projectId);
    res.json({
      success: true,
      data: approvers
    });
  } catch (error) {
    console.error('Error fetching Level 0 approvers for project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Level 0 approvers for project'
    });
  }
});

// @route   GET /api/level0-approvers/department-project/:departmentId/:projectId
// @desc    Get Level 0 approvers for a specific department-project combination
// @access  Private
router.get('/department-project/:departmentId/:projectId', async (req, res) => {
  try {
    const approvers = await Level0ApproverAssignment.getApproversForDepartmentProject(
      req.params.departmentId,
      req.params.projectId
    );
    res.json({
      success: true,
      data: approvers
    });
  } catch (error) {
    console.error('Error fetching Level 0 approvers for department-project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Level 0 approvers for department-project'
    });
  }
});

// @route   GET /api/level0-approvers/user/:userId
// @desc    Get all Level 0 approver assignments for a specific user
// @access  Private
router.get('/user/:userId', async (req, res) => {
  try {
    const assignments = await Level0ApproverAssignment.getActiveForUser(req.params.userId);
    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching Level 0 approver assignments for user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Level 0 approver assignments for user'
    });
  }
});

module.exports = router;

