const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const EvaluationLevel0Authority = require('../models/hr/EvaluationLevel0Authority');
const User = require('../models/User');
const Employee = require('../models/hr/Employee');
const Project = require('../models/hr/Project');
const Department = require('../models/hr/Department');

// Get all Level 0 authorities
router.get('/', async (req, res) => {
  try {
    const authorities = await EvaluationLevel0Authority.find()
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('authorities.project', 'name')
      .populate('authorities.departments', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: authorities
    });
  } catch (error) {
    console.error('Error fetching Level 0 authorities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Level 0 authorities'
    });
  }
});

// Get Level 0 authority by ID
router.get('/:id', async (req, res) => {
  try {
    const authority = await EvaluationLevel0Authority.findById(req.params.id)
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('authorities.project', 'name')
      .populate('authorities.departments', 'name');
    
    if (!authority) {
      return res.status(404).json({
        success: false,
        error: 'Level 0 authority not found'
      });
    }
    
    res.json({
      success: true,
      data: authority
    });
  } catch (error) {
    console.error('Error fetching Level 0 authority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Level 0 authority'
    });
  }
});

// Create new Level 0 authority
router.post('/', [
  body('assignedUser').isMongoId().withMessage('Valid user ID is required'),
  body('authorities').isArray().withMessage('Authorities array is required'),
  body('authorities.*.project').isMongoId().withMessage('Valid project ID is required for each authority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { assignedUser, authorities, isActive = true } = req.body;
    
    // Check if user exists
    const user = await User.findById(assignedUser);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Find employee record for this user
    const employee = await Employee.findOne({ user: assignedUser });
    
    // Validate projects and departments
    for (const auth of authorities) {
      const project = await Project.findById(auth.project);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: `Project not found: ${auth.project}`
        });
      }
      
      if (auth.departments && auth.departments.length > 0) {
        for (const deptId of auth.departments) {
          const department = await Department.findById(deptId);
          if (!department) {
            return res.status(404).json({
              success: false,
              error: `Department not found: ${deptId}`
            });
          }
        }
      }
    }
    
    // Create authority
    const authority = new EvaluationLevel0Authority({
      assignedUser,
      assignedEmployee: employee ? employee._id : null,
      authorities,
      isActive,
      createdBy: req.user ? req.user._id : null
    });
    
    await authority.save();
    
    const populated = await EvaluationLevel0Authority.findById(authority._id)
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('authorities.project', 'name')
      .populate('authorities.departments', 'name');
    
    res.status(201).json({
      success: true,
      message: 'Level 0 authority created successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error creating Level 0 authority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Level 0 authority',
      message: error.message
    });
  }
});

// Update Level 0 authority
router.put('/:id', [
  body('authorities').isArray().withMessage('Authorities array is required'),
  body('authorities.*.project').isMongoId().withMessage('Valid project ID is required for each authority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const authority = await EvaluationLevel0Authority.findById(req.params.id);
    if (!authority) {
      return res.status(404).json({
        success: false,
        error: 'Level 0 authority not found'
      });
    }
    
    const { authorities, isActive } = req.body;
    
    // Validate projects and departments
    if (authorities) {
      for (const auth of authorities) {
        const project = await Project.findById(auth.project);
        if (!project) {
          return res.status(404).json({
            success: false,
            error: `Project not found: ${auth.project}`
          });
        }
        
        if (auth.departments && auth.departments.length > 0) {
          for (const deptId of auth.departments) {
            const department = await Department.findById(deptId);
            if (!department) {
              return res.status(404).json({
                success: false,
                error: `Department not found: ${deptId}`
              });
            }
          }
        }
      }
      
      authority.authorities = authorities;
    }
    
    if (isActive !== undefined) {
      authority.isActive = isActive;
    }
    
    authority.updatedBy = req.user ? req.user._id : null;
    
    await authority.save();
    
    const populated = await EvaluationLevel0Authority.findById(authority._id)
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('authorities.project', 'name')
      .populate('authorities.departments', 'name');
    
    res.json({
      success: true,
      message: 'Level 0 authority updated successfully',
      data: populated
    });
  } catch (error) {
    console.error('Error updating Level 0 authority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update Level 0 authority',
      message: error.message
    });
  }
});

// Delete Level 0 authority
router.delete('/:id', async (req, res) => {
  try {
    const authority = await EvaluationLevel0Authority.findByIdAndDelete(req.params.id);
    
    if (!authority) {
      return res.status(404).json({
        success: false,
        error: 'Level 0 authority not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Level 0 authority deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Level 0 authority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete Level 0 authority'
    });
  }
});

// Get user's Level 0 authorities
router.get('/user/:userId', async (req, res) => {
  try {
    const authorities = await EvaluationLevel0Authority.find({
      assignedUser: req.params.userId,
      isActive: true
    })
      .populate('assignedUser', 'firstName lastName email role')
      .populate('assignedEmployee', 'firstName lastName employeeId')
      .populate('authorities.project', 'name')
      .populate('authorities.departments', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: authorities
    });
  } catch (error) {
    console.error('Error fetching user Level 0 authorities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user Level 0 authorities'
    });
  }
});

module.exports = router;

