const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

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
        { employeeId: { $regex: search, $options: 'i' } },
        { idCard: { $regex: search, $options: 'i' } },
        { religion: { $regex: search, $options: 'i' } },
        { maritalStatus: { $regex: search, $options: 'i' } },
              { qualification: { $regex: search, $options: 'i' } },
      { bankName: { $regex: search, $options: 'i' } },
      { spouseName: { $regex: search, $options: 'i' } },
      { appointmentDate: { $regex: search, $options: 'i' } },
      { 'placementCompany.name': { $regex: search, $options: 'i' } },
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
  body('idCard').trim().notEmpty().withMessage('ID Card number is required'),
  body('nationality').trim().notEmpty().withMessage('Nationality is required'),
  body('religion').isIn(['Islam', 'Christianity', 'Hinduism', 'Sikhism', 'Buddhism', 'Judaism', 'Other', 'None']).withMessage('Valid religion is required'),
  body('maritalStatus').isIn(['Single', 'Married', 'Divorced', 'Widowed']).withMessage('Valid marital status is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('position').notEmpty().withMessage('Position is required'),
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

  // Handle empty oldDesignation field
  if (employeeData.oldDesignation === '') {
    delete employeeData.oldDesignation;
  }

  const employee = new Employee(employeeData);
  await employee.save();

  res.status(201).json({
    success: true,
    message: 'Employee created successfully',
    data: employee
  });
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
      const totalSalary = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
      const avgSalary = totalEmployees > 0 ? totalSalary / totalEmployees : 0;

      // Group by department
      const departmentStats = employees.reduce((acc, emp) => {
        const deptName = emp.department?.name || 'Unassigned';
        if (!acc[deptName]) {
          acc[deptName] = { count: 0, totalSalary: 0 };
        }
        acc[deptName].count++;
        acc[deptName].totalSalary += emp.salary || 0;
        return acc;
      }, {});

      // Prepare report data
      const reportData = {
        reportInfo: {
          generatedAt: new Date().toISOString(),
          startDate: startDate,
          endDate: endDate,
          totalEmployees,
          totalSalary: totalSalary.toFixed(2),
          averageSalary: avgSalary.toFixed(2)
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
      } else if (format === 'pdf') {
        // Generate PDF
        const doc = new PDFDocument({ margin: 30 });
        
        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="employee-report-${startDate}-to-${endDate}.pdf"`);
        
        // Pipe PDF to response
        doc.pipe(res);
        
        // Add title
        doc.fontSize(20).font('Helvetica-Bold').text('Employee Report', { align: 'center' });
        doc.moveDown(0.5);
        
        // Add subtitle with date range
        doc.fontSize(12).font('Helvetica').text(`Date Range: ${startDate} to ${endDate}`, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(1);
        
        // Add report summary
        doc.fontSize(14).font('Helvetica-Bold').text('Report Summary');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Employees: ${totalEmployees}`);
        doc.text(`Total Salary: PKR ${totalSalary.toFixed(2)}`);
        doc.text(`Average Salary: PKR ${avgSalary.toFixed(2)}`);
        doc.moveDown(1);
        
        // Add department statistics
        doc.fontSize(14).font('Helvetica-Bold').text('Department Statistics');
        doc.fontSize(10).font('Helvetica');
        Object.entries(departmentStats).forEach(([dept, stats]) => {
          doc.text(`${dept}: ${stats.count} employees, PKR ${stats.totalSalary.toFixed(2)}`);
        });
        doc.moveDown(1);
        
        // Add employee table
        doc.fontSize(14).font('Helvetica-Bold').text('Employee Details');
        doc.moveDown(0.5);
        
        // Process employees in pages
        const employeesPerPage = 15;
        const totalPages = Math.ceil(reportData.employees.length / employeesPerPage);
        
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            doc.addPage();
          }
          
          const startIndex = page * employeesPerPage;
          const endIndex = Math.min(startIndex + employeesPerPage, reportData.employees.length);
          const pageEmployees = reportData.employees.slice(startIndex, endIndex);
          
          // Add page header
          if (page > 0) {
            doc.fontSize(12).font('Helvetica-Bold').text(`Employee Details (Page ${page + 1} of ${totalPages})`, { align: 'center' });
            doc.moveDown(1);
          }
          
          // Table headers with proper column widths
          const tableTop = doc.y;
          const tableLeft = 30;
          const colWidths = [50, 80, 120, 80, 70, 80, 70, 60];
          const headers = ['ID', 'Name', 'Email', 'Phone', 'Dept', 'Position', 'Salary', 'Status'];
          
          // Draw headers
          doc.fontSize(9).font('Helvetica-Bold');
          headers.forEach((header, i) => {
            doc.text(header, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
          });
          
          // Draw header line
          doc.moveTo(tableLeft, tableTop + 12).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 12).stroke();
          
          // Add employee rows
          let currentY = tableTop + 18;
          doc.fontSize(8).font('Helvetica');
          
          pageEmployees.forEach((emp, index) => {
            // Check if we need a new page
            if (currentY > 750) {
              doc.addPage();
              currentY = 50;
              
              // Redraw headers on new page
              doc.fontSize(9).font('Helvetica-Bold');
              headers.forEach((header, i) => {
                doc.text(header, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY);
              });
              doc.moveTo(tableLeft, currentY + 12).lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), currentY + 12).stroke();
              currentY += 18;
              doc.fontSize(8).font('Helvetica');
            }
            
            const rowData = [
              emp.employeeId,
              `${emp.firstName} ${emp.lastName}`,
              emp.email,
              emp.phone,
              emp.department,
              emp.position,
              `PKR ${emp.salary}`,
              emp.status
            ];
            
            // Draw each cell with proper positioning
            rowData.forEach((cell, i) => {
              const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
              const width = colWidths[i];
              
              // Truncate text if too long
              let displayText = cell || '';
              if (displayText.length > width / 6) { // Approximate character width
                displayText = displayText.substring(0, Math.floor(width / 6) - 3) + '...';
              }
              
              doc.text(displayText, x, currentY, { width: width });
            });
            
            currentY += 12;
          });
        }
        
        // Finalize PDF
        doc.end();
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

    const employee = await Employee.findById(req.params.id)
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

// @route   GET /api/hr/positions/:departmentId
// @desc    Get positions by department
// @access  Private (HR and Admin)
router.get('/positions/:departmentId', 
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

module.exports = router; 