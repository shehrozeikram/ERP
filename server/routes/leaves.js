const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize, authMiddleware } = require('../middleware/auth');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveType = require('../models/hr/LeaveType');
const LeavePolicy = require('../models/hr/LeavePolicy');
const Employee = require('../models/hr/Employee');
const LeaveManagementService = require('../services/leaveManagementService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'leave-documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'leave-doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// ==================== LEAVE TYPES ROUTES ====================

// @route   GET /api/leaves/types
// @desc    Get all leave types
// @access  Private
router.get('/types', 
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const leaveTypes = await LeaveType.find({ isActive: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      data: leaveTypes
    });
  })
);

// @route   POST /api/leaves/types
// @desc    Create new leave type
// @access  Private (Admin, HR Manager)
router.post('/types',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  [
    body('name').notEmpty().withMessage('Leave type name is required'),
    body('code').notEmpty().withMessage('Leave type code is required'),
    body('daysPerYear').isNumeric().withMessage('Days per year must be a number'),
    body('daysPerYear').isInt({ min: 0, max: 365 }).withMessage('Days per year must be between 0 and 365')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const leaveType = new LeaveType({
      ...req.body,
      createdBy: req.user.id
    });

    await leaveType.save();

    res.status(201).json({
      success: true,
      message: 'Leave type created successfully',
      data: leaveType
    });
  })
);

// ==================== EMPLOYEE LEAVE BALANCES ====================

// @route   GET /api/leaves/employees/balances
// @desc    Get all employees with their current leave balances
// @access  Private (Admin, HR Manager)
router.get('/employees/balances',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      const { year = new Date().getFullYear() } = req.query;
      
      // Get all active employees
      const employees = await Employee.find({ 
        isActive: true, 
        isDeleted: false 
      })
      .select('firstName lastName employeeId joiningDate leaveBalance')
      .lean();

      // If no employees found, return empty array
      if (employees.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Get leave balances for each employee
      const employeesWithBalances = await Promise.all(
        employees.map(async (employee) => {
          try {
            const balance = await LeaveManagementService.getEmployeeLeaveBalance(employee._id, year);
            return {
              ...employee,
              leaveBalance: balance
            };
          } catch (error) {
            console.error(`Error getting leave balance for employee ${employee._id}:`, error);
            // Return employee with default balance if calculation fails
            return {
              ...employee,
              leaveBalance: {
                annual: { allocated: 14, used: 0, remaining: 14, carriedForward: 0 },
                casual: { allocated: 10, used: 0, remaining: 10, carriedForward: 0 },
                medical: { allocated: 8, used: 0, remaining: 8, carriedForward: 0 }
              }
            };
          }
        })
      );

      res.json({
        success: true,
        data: employeesWithBalances
      });
    } catch (error) {
      console.error('Error getting employee leave balances:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting employee leave balances'
      });
    }
  })
);

// ==================== LEAVE REQUESTS ROUTES ====================

// @route   GET /api/leaves/requests
// @desc    Get leave requests with filters (HR only)
// @access  Private (Admin, HR Manager)
router.get('/requests',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const filters = {
      ...req.query,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    const result = await LeaveManagementService.getLeaveRequests(filters);

    res.json({
      success: true,
      data: result.leaveRequests,
      pagination: result.pagination
    });
  })
);

// @route   GET /api/leaves/requests/:id
// @desc    Get leave request by ID
// @access  Private
router.get('/requests/:id',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId email phone')
      .populate('leaveType', 'name code color description')
      .populate('approvedBy', 'firstName lastName')
      .populate('rejectedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    res.json({
      success: true,
      data: leaveRequest
    });
  })
);

// @route   POST /api/leaves/requests
// @desc    Add leave request (HR only)
// @access  Private (Admin, HR Manager)
router.post('/requests',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  upload.single('medicalCertificate'),
  [
    body('employee').isMongoId().withMessage('Valid employee ID is required'),
    body('leaveType').isMongoId().withMessage('Valid leave type ID is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('reason').notEmpty().withMessage('Reason is required'),
    body('reason').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const leaveData = {
      ...req.body,
      employee: req.body.employee,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate)
    };

    // Handle medical certificate upload
    if (req.file) {
      leaveData.medicalCertificate = {
        fileName: req.file.originalname,
        filePath: req.file.path,
        uploadedDate: new Date()
      };
    }

    const leaveRequest = await LeaveManagementService.applyForLeave(leaveData, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Leave request added successfully',
      data: leaveRequest
    });
  })
);

// @route   PUT /api/leaves/requests/:id/approve
// @desc    Approve leave request
// @access  Private (Admin, HR Manager)
router.put('/requests/:id/approve',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  [
    body('comments').optional().isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const leaveRequest = await LeaveManagementService.approveLeaveRequest(
      req.params.id,
      req.user.id,
      req.body.comments || ''
    );

    res.json({
      success: true,
      message: 'Leave request approved successfully',
      data: leaveRequest
    });
  })
);

// @route   PUT /api/leaves/requests/:id/reject
// @desc    Reject leave request
// @access  Private (Admin, HR Manager)
router.put('/requests/:id/reject',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  [
    body('reason').notEmpty().withMessage('Rejection reason is required'),
    body('reason').isLength({ max: 500 }).withMessage('Rejection reason cannot exceed 500 characters')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const leaveRequest = await LeaveManagementService.rejectLeaveRequest(
      req.params.id,
      req.user.id,
      req.body.reason
    );

    res.json({
      success: true,
      message: 'Leave request rejected',
      data: leaveRequest
    });
  })
);

// @route   PUT /api/leaves/requests/:id/cancel
// @desc    Cancel leave request
// @access  Private
router.put('/requests/:id/cancel',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  [
    body('reason').notEmpty().withMessage('Cancellation reason is required'),
    body('reason').isLength({ max: 500 }).withMessage('Cancellation reason cannot exceed 500 characters')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (!leaveRequest.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Leave request cannot be cancelled'
      });
    }

    leaveRequest.status = 'cancelled';
    leaveRequest.cancelledBy = req.user.id;
    leaveRequest.cancelledDate = new Date();
    leaveRequest.cancellationReason = req.body.reason;
    leaveRequest.updatedBy = req.user.id;

    await leaveRequest.save();

    res.json({
      success: true,
      message: 'Leave request cancelled successfully',
      data: leaveRequest
    });
  })
);

// ==================== LEAVE BALANCE ROUTES ====================

// @route   GET /api/leaves/balance/:employeeId
// @desc    Get employee leave balance (HR only)
// @access  Private (Admin, HR Manager)
router.get('/balance/:employeeId',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const balance = await LeaveManagementService.getEmployeeLeaveBalance(employeeId, year);

    res.json({
      success: true,
      data: balance
    });
  })
);

// ==================== LEAVE CALENDAR ROUTES ====================

// @route   GET /api/leaves/calendar
// @desc    Get leave calendar data (HR only)
// @access  Private (Admin, HR Manager)
router.get('/calendar',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;

    const calendarData = await LeaveManagementService.getLeaveCalendar(year, month);

    res.json({
      success: true,
      data: calendarData
    });
  })
);

// ==================== LEAVE POLICY ROUTES ====================

// @route   GET /api/leaves/policy
// @desc    Get active leave policy (HR only)
// @access  Private (Admin, HR Manager)
router.get('/policy',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const policy = await LeavePolicy.getActivePolicy();

    res.json({
      success: true,
      data: policy
    });
  })
);

// ==================== ADMIN ROUTES ====================

// @route   POST /api/leaves/initialize
// @desc    Initialize default leave types and policy
// @access  Private (Admin)
router.post('/initialize',
  authMiddleware,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    await LeaveManagementService.initializeDefaultLeaveTypes();
    await LeaveManagementService.initializeDefaultLeavePolicy();

    res.json({
      success: true,
      message: 'Leave management system initialized successfully'
    });
  })
);

// @route   POST /api/leaves/carry-forward
// @desc    Process leave carry forward for a year
// @access  Private (Admin)
router.post('/carry-forward',
  authMiddleware,
  authorize('admin'),
  [
    body('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    await LeaveManagementService.processLeaveCarryForward(req.body.year);

    res.json({
      success: true,
      message: `Leave carry forward processed for year ${req.body.year}`
    });
  })
);

// ==================== STATISTICS ROUTES ====================

// @route   GET /api/leaves/statistics
// @desc    Get leave statistics
// @access  Private (Admin, HR Manager)
router.get('/statistics',
  authMiddleware,
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const stats = await LeaveRequest.aggregate([
      {
        $match: {
          startDate: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1)
          },
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'leavetypes',
          localField: 'leaveType',
          foreignField: '_id',
          as: 'leaveTypeInfo'
        }
      },
      {
        $unwind: '$leaveTypeInfo'
      },
      {
        $group: {
          _id: {
            status: '$status',
            leaveType: '$leaveTypeInfo.name'
          },
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      },
      {
        $group: {
          _id: '$_id.status',
          leaveTypes: {
            $push: {
              name: '$_id.leaveType',
              count: '$count',
              totalDays: '$totalDays'
            }
          },
          totalRequests: { $sum: '$count' },
          totalDays: { $sum: '$totalDays' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;
