const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');

const router = express.Router();

// @route   GET /api/hr/employees
// @desc    Get all employees
// @access  Private (HR and Admin)
router.get('/employees', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      department, 
      position, 
      status,
      search 
    } = req.query;

    const query = { isActive: true };

    // Add filters
    if (department) query.department = department;
    if (position) query.position = position;
    if (status) query.employmentStatus = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(query)
      .populate('department', 'name code')
      .populate('position', 'title')
      .populate('manager', 'firstName lastName employeeId')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Employee.countDocuments(query);

    res.json({
      success: true,
      data: employees
    });
  })
);

// @route   POST /api/hr/employees
// @desc    Create new employee
// @access  Private (HR and Admin)
router.post('/employees', [
  authorize('admin', 'hr_manager'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('dateOfBirth').notEmpty().withMessage('Date of birth is required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('position').notEmpty().withMessage('Position is required'),
  body('hireDate').notEmpty().withMessage('Hire date is required'),
  body('salary').isNumeric().withMessage('Valid salary is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Clean up the request body
  const employeeData = {
    ...req.body,
    salary: parseFloat(req.body.salary),
    dateOfBirth: new Date(req.body.dateOfBirth),
    hireDate: new Date(req.body.hireDate)
  };

  const employee = new Employee(employeeData);
  await employee.save();

  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: employee
  });
}));

// @route   GET /api/hr/employees/:id
// @desc    Get employee by ID
// @access  Private (HR and Admin)
router.get('/employees/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    // Check if the ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID format'
      });
    }

    const employee = await Employee.findById(req.params.id)
      .populate('department', 'name code')
      .populate('position', 'title')
      .populate('manager', 'firstName lastName employeeId');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: employee
    });
  })
);

// @route   PUT /api/hr/employees/:id
// @desc    Update employee
// @access  Private (HR and Admin)
router.put('/employees/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    // Check if the ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID format'
      });
    }

    // Clean up the request body
    const employeeData = {
      ...req.body,
      salary: req.body.salary ? parseFloat(req.body.salary) : undefined,
      dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
      hireDate: req.body.hireDate ? new Date(req.body.hireDate) : undefined
    };

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      employeeData,
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });
  })
);

// @route   DELETE /api/hr/employees/:id
// @desc    Delete employee (soft delete)
// @access  Private (HR and Admin)
router.delete('/employees/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    // Check if the ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID format'
      });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, employmentStatus: 'Terminated' },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee terminated successfully'
    });
  })
);

// @route   GET /api/hr/departments
// @desc    Get all departments
// @access  Private
router.get('/departments', asyncHandler(async (req, res) => {
  const departments = await Department.find({ isActive: true })
    .populate('manager', 'firstName lastName employeeId')
    .populate('parentDepartment', 'name code');

      res.json({
      success: true,
      data: departments
    });
}));

// @route   POST /api/hr/departments
// @desc    Create new department
// @access  Private (HR and Admin)
router.post('/departments', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('code').trim().notEmpty().withMessage('Department code is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Clean up the request body
  const departmentData = {
    ...req.body,
    manager: req.body.manager || null,
    parentDepartment: req.body.parentDepartment || null,
    budget: req.body.budget ? parseFloat(req.body.budget) : null
  };

  const department = new Department(departmentData);
  await department.save();

  // Populate the manager field if it exists
  const populatedDepartment = await Department.findById(department._id)
    .populate('manager', 'firstName lastName employeeId');

  res.status(201).json({
    success: true,
    message: 'Department created successfully',
    data: populatedDepartment
  });
}));

// @route   PUT /api/hr/departments/:id
// @desc    Update department
// @access  Private (HR and Admin)
router.put('/departments/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    // Clean up the request body
    const departmentData = {
      ...req.body,
      manager: req.body.manager || null,
      parentDepartment: req.body.parentDepartment || null,
      budget: req.body.budget ? parseFloat(req.body.budget) : null
    };

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      departmentData,
      { new: true, runValidators: true }
    ).populate('manager', 'firstName lastName employeeId');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: department
    });
  })
);

// @route   DELETE /api/hr/departments/:id
// @desc    Delete department (soft delete)
// @access  Private (HR and Admin)
router.delete('/departments/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  })
);

// @route   GET /api/hr/statistics
// @desc    Get HR statistics
// @access  Private (HR and Admin)
router.get('/statistics', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const stats = await Employee.getStatistics();
    
    // Get department-wise employee count
    const departmentStats = await Employee.aggregate([
      { $match: { isActive: true, employmentStatus: 'Active' } },
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'department'
        }
      },
      { $unwind: '$department' },
      {
        $group: {
          _id: '$department.name',
          count: { $sum: 1 },
          avgSalary: { $avg: '$salary.base' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overall: stats,
        byDepartment: departmentStats
      }
    });
  })
);

module.exports = router; 