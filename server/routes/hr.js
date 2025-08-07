const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const Company = require('../models/hr/Company');
const Project = require('../models/hr/Project');
const Section = require('../models/hr/Section');
const Designation = require('../models/hr/Designation');
const Location = require('../models/hr/Location');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { calculateMonthlyTax, calculateTaxableIncome, getTaxSlabInfo } = require('../utils/taxCalculator');
const FBRTaxSlab = require('../models/hr/FBRTaxSlab');
const Sector = require('../models/hr/Sector');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-images');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// @route   POST /api/hr/upload-image
// @desc    Upload profile image
// @access  Private (HR and Admin)
router.post('/upload-image', 
  authorize('admin', 'hr_manager'),
  upload.single('profileImage'),
  asyncHandler(async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided'
        });
      }

      // Return the file path
      const imagePath = `/uploads/profile-images/${req.file.filename}`;
      
      res.json({
        success: true,
        data: {
          imagePath: imagePath,
          filename: req.file.filename
        }
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading image'
      });
    }
  })
);

// @route   GET /api/hr/employees/next-id
// @desc    Get next available employee ID
// @access  Private (HR and Admin)
router.get('/employees/next-id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    try {
      // Find the last employee to get the highest ID
      const lastEmployee = await Employee.findOne({}, { employeeId: 1 })
        .sort({ employeeId: -1 });

      let nextId = '1';
      
      if (lastEmployee && lastEmployee.employeeId) {
        // Extract the number from the last ID (e.g., "123" -> 123)
        const lastNumber = parseInt(lastEmployee.employeeId);
        const nextNumber = lastNumber + 1;
        nextId = nextNumber.toString();
      }

      res.json({
        success: true,
        data: { nextEmployeeId: nextId }
      });
    } catch (error) {
      console.error('Error getting next employee ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting next employee ID'
      });
    }
  })
);

// @route   GET /api/hr/employees
// @desc    Get all employees
// @access  Private (HR and Admin)
router.get('/employees', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 1000, 
      department, 
      position, 
      status,
      search,
      active 
    } = req.query;

    const query = { isDeleted: false }; // Return all non-deleted employees (both active and inactive)
    
    // Add active status filter if provided
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    // Add filters
    if (department) query.department = department;
    if (position) query.position = position;
    if (status) query.employmentStatus = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { idCard: { $regex: search, $options: 'i' } },
        { religion: { $regex: search, $options: 'i' } },
        { maritalStatus: { $regex: search, $options: 'i' } },
              { qualification: { $regex: search, $options: 'i' } },
      { bankName: { $regex: search, $options: 'i' } },
      { spouseName: { $regex: search, $options: 'i' } },
      { appointmentDate: { $regex: search, $options: 'i' } },
      { 'placementCompany.name': { $regex: search, $options: 'i' } },
      { 'placementSector.name': { $regex: search, $options: 'i' } },
      { 'placementProject.name': { $regex: search, $options: 'i' } },
      { 'placementDepartment.name': { $regex: search, $options: 'i' } },
      { 'placementSection.name': { $regex: search, $options: 'i' } },
      { 'placementDesignation.title': { $regex: search, $options: 'i' } },
      { 'oldDesignation.title': { $regex: search, $options: 'i' } },
      { 'placementLocation.name': { $regex: search, $options: 'i' } },
                { 'address.city.name': { $regex: search, $options: 'i' } },
                { 'address.state.name': { $regex: search, $options: 'i' } },
                { 'address.country.name': { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(query)
      .populate('bankName', 'name type')
      .populate('placementCompany', 'name code type')
      .populate('placementSector', 'name code')
      .populate('placementProject', 'name company')
      .populate('placementDepartment', 'name code')
      .populate('placementSection', 'name department')
      .populate('placementDesignation', 'title level')
      .populate('oldDesignation', 'title level')
      .populate('placementLocation', 'name type')
      .populate('manager', 'firstName lastName employeeId')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain objects to include virtual fields

    // Add virtual fields manually since lean() doesn't include them
    const employeesWithVirtuals = employees.map(employee => ({
      ...employee,
      fullName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
    }));

    const total = await Employee.countDocuments(query);

    res.json({
      success: true,
      data: employeesWithVirtuals
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
  body('idCard').trim().notEmpty().withMessage('ID Card number is required'),
  body('nationality').trim().notEmpty().withMessage('Nationality is required'),
  body('religion').isIn(['Islam', 'Christianity', 'Hinduism', 'Sikhism', 'Buddhism', 'Judaism', 'Other', 'None']).withMessage('Valid religion is required'),
  body('maritalStatus').isIn(['Single', 'Married', 'Divorced', 'Widowed']).withMessage('Valid marital status is required'),
  body('qualification').notEmpty().withMessage('Qualification is required'),
  body('bankName').notEmpty().withMessage('Bank name is required'),
  body('spouseName').custom((value, { req }) => {
    if (req.body.maritalStatus === 'Married' && !value) {
      throw new Error('Spouse name is required when marital status is Married');
    }
    return true;
  }),
  body('appointmentDate').notEmpty().withMessage('Appointment date is required'),
  body('probationPeriodMonths').isNumeric().withMessage('Probation period must be a number'),
  body('hireDate').notEmpty().withMessage('Hire date is required'),
  body('salary.gross').isNumeric().withMessage('Valid gross salary is required')
], asyncHandler(async (req, res) => {
  console.log('📥 POST /hr/employees - Request received');
  console.log('📋 Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  console.log('✅ Request validation passed');

  try {
    // Clean up the request body
    const employeeData = {
      ...req.body,
      salary: {
        gross: parseFloat(req.body.salary?.gross || 0)
      },
      dateOfBirth: new Date(req.body.dateOfBirth),
      hireDate: new Date(req.body.hireDate),
      appointmentDate: new Date(req.body.appointmentDate)
    };

    // Handle empty or "add_new" placement fields
    const placementFields = [
      'placementCompany', 'placementSector', 'placementProject', 
      'placementDepartment', 'placementSection', 'placementDesignation', 
      'placementLocation', 'oldDesignation'
    ];

    placementFields.forEach(field => {
      if (employeeData[field] === '' || employeeData[field] === 'add_new' || employeeData[field] === null || employeeData[field] === undefined) {
        delete employeeData[field];
      }
    });

    const employee = new Employee(employeeData);
    await employee.save();

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employee
    });
  } catch (error) {
  console.error('❌ Error creating employee:', error);
  
  // Handle duplicate key errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    const value = error.keyValue[field];
    
    if (field === 'email') {
      return res.status(400).json({
        success: false,
        message: `An employee with email "${value}" already exists. Please use a different email address.`
      });
    } else if (field === 'idCard') {
      return res.status(400).json({
        success: false,
        message: `An employee with ID Card "${value}" already exists. Please use a different ID Card number.`
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `A record with this ${field} already exists.`
      });
    }
  }
  
  // Handle validation errors
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }
  
  // Generic error
  res.status(500).json({
    success: false,
    message: 'Error creating employee',
    error: error.message
  });
  }
}));

// @route   GET /api/hr/employees/report
// @desc    Get employee report by date range
// @access  Private (HR and Admin)
router.get('/employees/report', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { startDate, endDate, format = 'json' } = req.query;
    
    // Validate date parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Validate date format
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD format'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date'
      });
    }

    try {
      // Build query for date range
      const query = {
        hireDate: {
          $gte: start,
          $lte: end
        }
      };

      // Get employees with populated fields
      const employees = await Employee.find(query)
        .populate('department', 'name code')
        .populate('position', 'title')
        .populate('bankName', 'name type')
        .populate('placementCompany', 'name type')
        .populate('placementProject', 'name company')
        .populate('placementDepartment', 'name code')
        .populate('placementSection', 'name department')
        .populate('placementDesignation', 'title level')
        .populate('oldDesignation', 'title level')
        .populate('placementLocation', 'name type')
        .populate('address.city', 'name code')
        .populate('address.state', 'name code')
        .populate('address.country', 'name code')
        .populate('manager', 'firstName lastName employeeId')
        .sort({ hireDate: 1, firstName: 1, lastName: 1 });

      // Get summary statistics
      const totalEmployees = employees.length;
          const totalBasicSalary = employees.reduce((sum, emp) => {
      const basic = emp.salary?.basic || Math.round((emp.salary?.gross || 0) * 0.6);
      return sum + basic;
    }, 0);
    const totalGrossSalary = employees.reduce((sum, emp) => sum + (emp.salary?.gross || 0), 0);
    const avgBasicSalary = totalEmployees > 0 ? totalBasicSalary / totalEmployees : 0;
    const avgGrossSalary = totalEmployees > 0 ? totalGrossSalary / totalEmployees : 0;

      // Group by department
      const departmentStats = employees.reduce((acc, emp) => {
        const deptName = emp.department?.name || 'Unassigned';
        if (!acc[deptName]) {
          acc[deptName] = { count: 0, totalBasicSalary: 0, totalGrossSalary: 0 };
        }
        acc[deptName].count++;
                const basic = emp.salary?.basic || Math.round((emp.salary?.gross || 0) * 0.6);
        acc[deptName].totalBasicSalary += basic;
        acc[deptName].totalGrossSalary += emp.salary?.gross || 0;
        return acc;
      }, {});

      // Prepare report data
      const reportData = {
        reportInfo: {
          generatedAt: new Date().toISOString(),
          startDate: startDate,
          endDate: endDate,
          totalEmployees,
          totalBasicSalary: totalBasicSalary.toFixed(2),
          totalGrossSalary: totalGrossSalary.toFixed(2),
          averageBasicSalary: avgBasicSalary.toFixed(2),
          averageGrossSalary: avgGrossSalary.toFixed(2)
        },
        departmentStats,
        employees: employees.map(emp => ({
          employeeId: emp.employeeId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          hireDate: emp.hireDate,
          department: emp.department?.name || 'Not Assigned',
          position: emp.position?.title || 'Not Assigned',
          salary: emp.salary,
          status: emp.status,
          address: {
            street: emp.address?.street,
            city: emp.address?.city?.name,
            state: emp.address?.state?.name,
            country: emp.address?.country?.name
          },
          placement: {
            company: emp.placementCompany?.name,
            project: emp.placementProject?.name,
            department: emp.placementDepartment?.name,
            section: emp.placementSection?.name,
            designation: emp.placementDesignation?.title,
            location: emp.placementLocation?.name
          }
        }))
      };

      // Return based on format
      if (format === 'csv') {
        // Generate CSV
        const csvHeaders = [
          'Employee ID',
          'First Name',
          'Last Name',
          'Email',
          'Phone',
          'Hire Date',
          'Department',
          'Position',
          'Salary',
          'Status',
          'Address',
          'City',
          'State',
          'Country',
          'Placement Company',
          'Placement Project',
          'Placement Department',
          'Placement Section',
          'Placement Designation',
          'Placement Location'
        ];

        const csvRows = reportData.employees.map(emp => [
          emp.employeeId,
          emp.firstName,
          emp.lastName,
          emp.email,
          emp.phone,
          emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : '',
          emp.department,
          emp.position,
          emp.salary,
          emp.status,
          emp.address.street,
          emp.address.city,
          emp.address.state,
          emp.address.country,
          emp.placement.company,
          emp.placement.project,
          emp.placement.department,
          emp.placement.section,
          emp.placement.designation,
          emp.placement.location
        ]);

        const csvContent = [csvHeaders, ...csvRows]
          .map(row => row.map(field => `"${field || ''}"`).join(','))
          .join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="employee-report-${startDate}-to-${endDate}.csv"`);
        res.send(csvContent);
      } else {
        // Return JSON
        res.json({
          success: true,
          message: `Employee report generated successfully. Found ${totalEmployees} employees.`,
          data: reportData
        });
      }

    } catch (error) {
      console.error('Error generating employee report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating employee report'
      });
    }
  })
);

// @route   GET /api/hr/employees/:id
// @desc    Get employee by ID
// @access  Private (HR and Admin)
router.get('/employees/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    // Check if the ID is a valid ObjectId
    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log(`❌ Invalid employee ID format: "${req.params.id}" (type: ${typeof req.params.id})`);
      return res.status(400).json({
        success: false,
        message: `Invalid employee ID format: "${req.params.id}". ID must be a valid MongoDB ObjectId.`
      });
    }

    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false })
      .populate('bankName', 'name type')
      .populate('placementCompany', 'name code type')
      .populate('placementSector', 'name code')
      .populate('placementProject', 'name company')
      .populate('placementDepartment', 'name code')
      .populate('placementSection', 'name department')
      .populate('placementDesignation', 'title level')
      .populate('oldDesignation', 'title level')
      .populate('placementLocation', 'name type')
      .populate('address.city', 'name code')
      .populate('address.state', 'name code')
      .populate('address.country', 'name code')
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
router.put('/employees/:id', [
  authorize('admin', 'hr_manager'),
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
  body('dateOfBirth').optional().notEmpty().withMessage('Date of birth is required'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('idCard').optional().trim().notEmpty().withMessage('ID Card number is required'),
  body('nationality').optional().trim().notEmpty().withMessage('Nationality is required'),
  body('religion').optional().isIn(['Islam', 'Christianity', 'Hinduism', 'Sikhism', 'Buddhism', 'Judaism', 'Other', 'None']).withMessage('Valid religion is required'),
  body('maritalStatus').optional().isIn(['Single', 'Married', 'Divorced', 'Widowed']).withMessage('Valid marital status is required'),
  body('qualification').optional().notEmpty().withMessage('Qualification is required'),
  body('bankName').optional().notEmpty().withMessage('Bank name is required'),
  body('spouseName').optional().custom((value, { req }) => {
    if (req.body.maritalStatus === 'Married' && !value) {
      throw new Error('Spouse name is required when marital status is Married');
    }
    return true;
  }),
  body('appointmentDate').optional().notEmpty().withMessage('Appointment date is required'),
  body('probationPeriodMonths').optional().isNumeric().withMessage('Probation period must be a number'),
  body('hireDate').optional().notEmpty().withMessage('Hire date is required'),
  // body('salary.gross').optional().custom((value) => {
  //   // Allow empty, null, undefined values
  //   if (value === undefined || value === null || value === '') {
  //     return true;
  //   }
  //   // If value exists, validate it's a positive number
  //   const numValue = parseFloat(value);
  //   if (isNaN(numValue) || numValue < 0) {
  //     throw new Error('Gross salary must be a valid positive number');
  //   }
  //   return true;
  // })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if the ID is a valid ObjectId
    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log(`❌ Invalid employee ID format: "${req.params.id}" (type: ${typeof req.params.id})`);
      return res.status(400).json({
        success: false,
        message: `Invalid employee ID format: "${req.params.id}". ID must be a valid MongoDB ObjectId.`
      });
    }

    // Clean up the request body
    const employeeData = { ...req.body };
    
    // Handle salary field
    if (req.body.salary && req.body.salary.gross !== undefined && req.body.salary.gross !== null && req.body.salary.gross !== '') {
      employeeData.salary = {
        gross: parseFloat(req.body.salary.gross)
      };
    } else {
      // Don't include salary in update if it's empty
      delete employeeData.salary;
    }
    
    // Clean up empty placement fields (convert empty strings to undefined)
    const placementFields = [
      'placementCompany', 'placementProject', 'placementDepartment', 
      'placementSection', 'placementDesignation', 'placementLocation'
    ];
    
    placementFields.forEach(field => {
      if (employeeData[field] === '' || employeeData[field] === null) {
        delete employeeData[field];
      }
    });
    
    // Handle date fields
    if (req.body.dateOfBirth) {
      employeeData.dateOfBirth = new Date(req.body.dateOfBirth);
    }
    if (req.body.hireDate) {
      employeeData.hireDate = new Date(req.body.hireDate);
    }
    if (req.body.appointmentDate) {
      employeeData.appointmentDate = new Date(req.body.appointmentDate);
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
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
    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log(`❌ Invalid employee ID format: "${req.params.id}" (type: ${typeof req.params.id})`);
      return res.status(400).json({
        success: false,
        message: `Invalid employee ID format: "${req.params.id}". ID must be a valid MongoDB ObjectId.`
      });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, employmentStatus: 'Terminated', isDeleted: true },
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

// @route   POST /api/hr/employees/:id/update-payrolls
// @desc    Update all payrolls for an employee with current salary structure
// @access  Private (HR and Admin)
router.post('/employees/:id/update-payrolls', [
  authorize('admin', 'hr_manager')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid employee ID format'
    });
  }

  try {
    const result = await Employee.updateEmployeePayrolls(req.params.id);
    
    res.json({
      success: true,
      message: `Successfully updated ${result.updatedPayrolls} payrolls for ${result.employeeName}`,
      data: result
    });
  } catch (error) {
    console.error('Error updating employee payrolls:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update employee payrolls'
    });
  }
}));

// @route   GET /api/hr/departments
// @desc    Get all departments
// @access  Private
router.get('/departments', 
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
  const departments = await Department.find({ isActive: true })
    .populate('manager', 'firstName lastName employeeId')
    .populate('parentDepartment', 'name code');

      res.json({
      success: true,
      data: departments
    });
}));

// @route   GET /api/hr/departments/:id
// @desc    Get department by ID
// @access  Private
router.get('/departments/:id', 
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid department ID format'
    });
  }

  const department = await Department.findById(req.params.id)
    .populate('manager', 'firstName lastName employeeId')
    .populate('parentDepartment', 'name code');

  if (!department) {
    return res.status(404).json({
      success: false,
      message: 'Department not found'
    });
  }

  res.json({
    success: true,
    data: department
  });
}));

// @route   GET /api/hr/positions
// @desc    Get all positions
// @access  Private (HR and Admin)
router.get('/positions', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const positions = await Position.findActive();
    res.json({
      success: true,
      data: positions
    });
  })
);

// @route   GET /api/hr/positions/:id
// @desc    Get position by ID
// @access  Private (HR and Admin)
router.get('/positions/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID format'
      });
    }

    const position = await Position.findById(req.params.id)
      .populate('department', 'name code');

    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }

    res.json({
      success: true,
      data: position
    });
  })
);

// @route   GET /api/hr/positions/department/:departmentId
// @desc    Get positions by department
// @access  Private (HR and Admin)
router.get('/positions/department/:departmentId', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.departmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid department ID format'
      });
    }

    const positions = await Position.findByDepartment(req.params.departmentId);
    res.json({
      success: true,
      data: positions
    });
  })
);

// @route   GET /api/hr/banks
// @desc    Get all banks
// @access  Private (HR and Admin)
router.get('/banks', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const banks = await Bank.findActive();
    res.json({
      success: true,
      data: banks
    });
  })
);

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

// Get tax calculation information
router.get('/tax-calculation', asyncHandler(async (req, res) => {
  const { basicSalary, allowances } = req.query;
  
  if (!basicSalary) {
    return res.status(400).json({
      success: false,
      message: 'Basic salary is required'
    });
  }

  const taxableIncome = calculateTaxableIncome({
    basic: parseFloat(basicSalary),
    allowances: allowances ? JSON.parse(allowances) : {}
  });

  const monthlyTax = calculateMonthlyTax(taxableIncome);
  const annualTaxableIncome = taxableIncome * 12;
  const taxInfo = getTaxSlabInfo(annualTaxableIncome);

  res.json({
    success: true,
    data: {
      taxableIncome: Math.round(taxableIncome),
      annualTaxableIncome: Math.round(annualTaxableIncome),
      monthlyTax: Math.round(monthlyTax),
      annualTax: Math.round(monthlyTax * 12),
      taxSlab: taxInfo.slab,
      taxRate: taxInfo.rate,
      description: taxInfo.description
    }
  });
}));

// FBR Tax Management Routes

// Get all FBR tax slabs
router.get('/fbr-tax-slabs', asyncHandler(async (req, res) => {
  const taxSlabs = await FBRTaxSlab.find()
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .sort({ fiscalYear: -1 });

  res.json({
    success: true,
    data: taxSlabs
  });
}));

// Get active FBR tax slabs
router.get('/fbr-tax-slabs/active', asyncHandler(async (req, res) => {
  const activeSlabs = await FBRTaxSlab.getActiveSlabs();
  
  if (!activeSlabs) {
    return res.status(404).json({
      success: false,
      message: 'No active tax slabs found'
    });
  }

  res.json({
    success: true,
    data: activeSlabs
  });
}));

// Create new FBR tax slabs
router.post('/fbr-tax-slabs', [
  body('fiscalYear').notEmpty().withMessage('Fiscal year is required'),
  body('slabs').isArray({ min: 1 }).withMessage('At least one tax slab is required'),
  body('slabs.*.minAmount').isNumeric().withMessage('Minimum amount must be numeric'),
  body('slabs.*.maxAmount').isNumeric().withMessage('Maximum amount must be numeric'),
  body('slabs.*.rate').isNumeric().withMessage('Tax rate must be numeric'),
  body('slabs.*.fixedTax').optional().isNumeric().withMessage('Fixed tax must be numeric')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Check if fiscal year already exists
  const existingSlabs = await FBRTaxSlab.findOne({ fiscalYear: req.body.fiscalYear });
  if (existingSlabs) {
    return res.status(400).json({
      success: false,
      message: 'Tax slabs for this fiscal year already exist'
    });
  }

  // If this is set as active, deactivate others
  if (req.body.isActive) {
    await FBRTaxSlab.updateMany({}, { isActive: false });
  }

  const taxSlabs = new FBRTaxSlab({
    ...req.body,
    createdBy: req.user.id
  });

  await taxSlabs.save();

  const populatedSlabs = await FBRTaxSlab.findById(taxSlabs._id)
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'FBR tax slabs created successfully',
    data: populatedSlabs
  });
}));

// Update FBR tax slabs
router.put('/fbr-tax-slabs/:id', [
  body('fiscalYear').optional().notEmpty().withMessage('Fiscal year is required'),
  body('slabs').optional().isArray({ min: 1 }).withMessage('At least one tax slab is required'),
  body('slabs.*.minAmount').optional().isNumeric().withMessage('Minimum amount must be numeric'),
  body('slabs.*.maxAmount').optional().isNumeric().withMessage('Maximum amount must be numeric'),
  body('slabs.*.rate').optional().isNumeric().withMessage('Tax rate must be numeric'),
  body('slabs.*.fixedTax').optional().isNumeric().withMessage('Fixed tax must be numeric')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid tax slab ID format'
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

  const taxSlabs = await FBRTaxSlab.findById(req.params.id);
  if (!taxSlabs) {
    return res.status(404).json({
      success: false,
      message: 'Tax slabs not found'
    });
  }

  // If this is set as active, deactivate others
  if (req.body.isActive) {
    await FBRTaxSlab.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
  }

  const updatedSlabs = await FBRTaxSlab.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      updatedBy: req.user.id
    },
    { new: true, runValidators: true }
  ).populate('createdBy', 'firstName lastName')
   .populate('updatedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'FBR tax slabs updated successfully',
    data: updatedSlabs
  });
}));

// Delete FBR tax slabs
router.delete('/fbr-tax-slabs/:id', asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid tax slab ID format'
    });
  }

  const taxSlabs = await FBRTaxSlab.findById(req.params.id);
  if (!taxSlabs) {
    return res.status(404).json({
      success: false,
      message: 'Tax slabs not found'
    });
  }

  // Don't allow deletion of active slabs
  if (taxSlabs.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete active tax slabs'
    });
  }

  await FBRTaxSlab.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'FBR tax slabs deleted successfully'
  });
}));

// Calculate tax using active slabs
router.post('/fbr-tax-slabs/calculate', [
  body('annualIncome').isNumeric().withMessage('Annual income must be numeric')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const annualIncome = parseFloat(req.body.annualIncome);
  const taxAmount = await FBRTaxSlab.calculateTax(annualIncome);
  const taxInfo = await FBRTaxSlab.getTaxSlabInfo(annualIncome);

  res.json({
    success: true,
    data: {
      annualIncome,
      taxAmount: Math.round(taxAmount),
      monthlyTax: Math.round(taxAmount / 12),
      taxInfo
    }
  });
}));

// ==================== SECTOR ROUTES ====================

// @route   GET /api/hr/sectors
// @desc    Get all sectors
// @access  Private (HR and Admin)
router.get('/sectors', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { company, search } = req.query;
    
    const query = { isActive: true };
    
    if (company) {
      query.company = company;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const sectors = await Sector.find(query)
      .populate('company', 'name code')
      .populate('manager', 'firstName lastName employeeId')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: sectors
    });
  })
);

// @route   POST /api/hr/sectors
// @desc    Create new sector
// @access  Private (HR and Admin)
router.post('/sectors', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Sector name is required'),
  body('code').trim().notEmpty().withMessage('Sector code is required'),
  body('company').notEmpty().withMessage('Company is required')
],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const sector = new Sector(req.body);
    await sector.save();

    res.status(201).json({
      success: true,
      message: 'Sector created successfully',
      data: sector
    });
  })
);

// @route   GET /api/hr/sectors/:id
// @desc    Get sector by ID
// @access  Private (HR and Admin)
router.get('/sectors/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const sector = await Sector.findById(req.params.id)
      .populate('company', 'name code')
      .populate('manager', 'firstName lastName employeeId');

    if (!sector) {
      return res.status(404).json({
        success: false,
        message: 'Sector not found'
      });
    }

    res.json({
      success: true,
      data: sector
    });
  })
);

// @route   PUT /api/hr/sectors/:id
// @desc    Update sector
// @access  Private (HR and Admin)
router.put('/sectors/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const sector = await Sector.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('company', 'name code')
     .populate('manager', 'firstName lastName employeeId');

    if (!sector) {
      return res.status(404).json({
        success: false,
        message: 'Sector not found'
      });
    }

    res.json({
      success: true,
      message: 'Sector updated successfully',
      data: sector
    });
  })
);

// @route   DELETE /api/hr/sectors/:id
// @desc    Delete sector
// @access  Private (HR and Admin)
router.delete('/sectors/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const sector = await Sector.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!sector) {
      return res.status(404).json({
        success: false,
        message: 'Sector not found'
      });
    }

    res.json({
      success: true,
      message: 'Sector deleted successfully'
    });
  })
);

// ==================== COMPANY ROUTES ====================

// @route   GET /api/hr/companies
// @desc    Get all companies
// @access  Private (HR and Admin)
router.get('/companies', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { type, search } = req.query;
    
    const query = { isActive: true };
    
    if (type) {
      query.type = type;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const companies = await Company.find(query)
      .sort({ name: 1 });

    res.json({
      success: true,
      data: companies
    });
  })
);

// @route   POST /api/hr/companies
// @desc    Create new company
// @access  Private (HR and Admin)
router.post('/companies', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Company name is required'),
  body('code').trim().notEmpty().withMessage('Company code is required'),
  body('type').optional().isIn(['Private Limited', 'Public Limited', 'Partnership', 'Sole Proprietorship', 'Government', 'NGO', 'Other']).withMessage('Valid type is required')
],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const company = new Company(req.body);
    await company.save();

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  })
);

// @route   GET /api/hr/companies/:id
// @desc    Get company by ID
// @access  Private (HR and Admin)
router.get('/companies/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: company
    });
  })
);

// @route   PUT /api/hr/companies/:id
// @desc    Update company
// @access  Private (HR and Admin)
router.put('/companies/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  })
);

// @route   DELETE /api/hr/companies/:id
// @desc    Delete company
// @access  Private (HR and Admin)
router.delete('/companies/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  })
);

// ==================== PROJECT ROUTES ====================

// @route   GET /api/hr/projects
// @desc    Get all projects
// @access  Private (HR and Admin)
router.get('/projects', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { company, search } = req.query;
    
    const query = { isActive: true };
    
    if (company) {
      query.company = company;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const projects = await Project.find(query)
      .populate('company', 'name code')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: projects
    });
  })
);

// @route   POST /api/hr/projects
// @desc    Create new project
// @access  Private (HR and Admin)
router.post('/projects', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('code').trim().notEmpty().withMessage('Project code is required'),
  body('company').notEmpty().withMessage('Company is required')
],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Add default startDate if not provided
    const projectData = {
      ...req.body,
      startDate: req.body.startDate || new Date()
    };

    const project = new Project(projectData);
    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate('company', 'name code');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: populatedProject
    });
  })
);

// ==================== SECTION ROUTES ====================

// @route   GET /api/hr/sections
// @desc    Get all sections
// @access  Private (HR and Admin)
router.get('/sections', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { department, search } = req.query;
    
    const query = { isActive: true };
    
    if (department) {
      query.department = department;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const sections = await Section.find(query)
      .populate('department', 'name code')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: sections
    });
  })
);

// @route   POST /api/hr/sections
// @desc    Create new section
// @access  Private (HR and Admin)
router.post('/sections', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Section name is required'),
  body('code').trim().notEmpty().withMessage('Section code is required'),
  body('department').notEmpty().withMessage('Department is required')
],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const section = new Section(req.body);
    await section.save();

    const populatedSection = await Section.findById(section._id)
      .populate('department', 'name code');

    res.status(201).json({
      success: true,
      message: 'Section created successfully',
      data: populatedSection
    });
  })
);

// ==================== DESIGNATION ROUTES ====================

// @route   GET /api/hr/designations
// @desc    Get all designations
// @access  Private (HR and Admin)
router.get('/designations', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { section, search } = req.query;
    
    const query = { isActive: true };
    
    if (section) {
      query.section = section;
    }
    
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const designations = await Designation.find(query)
      .populate('section', 'name department')
      .sort({ title: 1 });

    res.json({
      success: true,
      data: designations
    });
  })
);

// @route   POST /api/hr/designations
// @desc    Create new designation
// @access  Private (HR and Admin)
router.post('/designations', [
  authorize('admin', 'hr_manager'),
  body('title').trim().notEmpty().withMessage('Designation title is required'),
  body('level').optional().isIn(['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive']).withMessage('Valid level is required'),
  body('section').notEmpty().withMessage('Section is required')
],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Get the section to find the department
    const section = await Section.findById(req.body.section);
    if (!section) {
      return res.status(400).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Generate a unique code
    const timestamp = Date.now();
    const code = `${req.body.title.substring(0, 3).toUpperCase()}${timestamp.toString().slice(-3)}`;

    const designationData = {
      ...req.body,
      code: code,
      department: section.department
    };

    const designation = new Designation(designationData);
    await designation.save();

    const populatedDesignation = await Designation.findById(designation._id)
      .populate('section', 'name department')
      .populate('department', 'name code');

    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: populatedDesignation
    });
  })
);

// ==================== LOCATION ROUTES ====================

// @route   GET /api/hr/locations
// @desc    Get all locations
// @access  Private (HR and Admin)
router.get('/locations', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { type, search } = req.query;
    
    const query = { isActive: true };
    
    if (type) {
      query.type = type;
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const locations = await Location.find(query)
      .sort({ name: 1 });

    res.json({
      success: true,
      data: locations
    });
  })
);

// @route   POST /api/hr/locations
// @desc    Create new location
// @access  Private (HR and Admin)
router.post('/locations', [
  authorize('admin', 'hr_manager'),
  body('name').trim().notEmpty().withMessage('Location name is required'),
  body('type').optional().isIn(['Office', 'Branch', 'Site', 'Warehouse', 'Factory', 'Other']).withMessage('Valid type is required')
],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const location = new Location(req.body);
    await location.save();

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: location
    });
  })
);

module.exports = router; 