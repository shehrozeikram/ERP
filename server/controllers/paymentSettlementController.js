const PaymentSettlement = require('../models/hr/PaymentSettlement');
const { asyncHandler } = require('../middleware/errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/payment-settlements');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common document types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG, GIF, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @desc    Get all payment settlements with pagination and filters
// @route   GET /api/payment-settlements
// @access  Private (Admin)
const getPaymentSettlements = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      parentCompanyName,
      subsidiaryName,
      fromDepartment,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { parentCompanyName: { $regex: search, $options: 'i' } },
        { subsidiaryName: { $regex: search, $options: 'i' } },
        { voucherNumber: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { toWhomPaid: { $regex: search, $options: 'i' } },
        { forWhat: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by parent company name
    if (parentCompanyName) {
      query.parentCompanyName = { $regex: parentCompanyName, $options: 'i' };
    }

    // Filter by subsidiary name
    if (subsidiaryName) {
      query.subsidiaryName = { $regex: subsidiaryName, $options: 'i' };
    }

    // Filter by department
    if (fromDepartment) {
      query.fromDepartment = { $regex: fromDepartment, $options: 'i' };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const settlements = await PaymentSettlement.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await PaymentSettlement.countDocuments(query);

    res.json({
      success: true,
      data: {
        settlements,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment settlements',
      error: error.message
    });
  }
});

// @desc    Get single payment settlement by ID
// @route   GET /api/payment-settlements/:id
// @access  Private (Admin)
const getPaymentSettlement = asyncHandler(async (req, res) => {
  try {
    const settlement = await PaymentSettlement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    res.json({
      success: true,
      data: settlement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment settlement',
      error: error.message
    });
  }
});

// @desc    Create new payment settlement
// @route   POST /api/payment-settlements
// @access  Private (Admin)
const createPaymentSettlement = asyncHandler(async (req, res) => {
  try {
    const settlementData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Handle file attachments if any
    if (req.files && req.files.length > 0) {
      settlementData.attachments = req.files.map(file => ({
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date()
      }));
    }

    const settlement = new PaymentSettlement(settlementData);
    await settlement.save();

    // Populate the created settlement
    await settlement.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Payment settlement created successfully',
      data: settlement
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create payment settlement',
      error: error.message
    });
  }
});

// @desc    Update payment settlement
// @route   PUT /api/payment-settlements/:id
// @access  Private (Admin)
const updatePaymentSettlement = asyncHandler(async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    // Handle file attachments if any
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date()
      }));

      // Get existing settlement to merge attachments
      const existingSettlement = await PaymentSettlement.findById(req.params.id);
      if (existingSettlement) {
        updateData.attachments = [...(existingSettlement.attachments || []), ...newAttachments];
      } else {
        updateData.attachments = newAttachments;
      }
    }

    const settlement = await PaymentSettlement.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment settlement updated successfully',
      data: settlement
    });
  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update payment settlement',
      error: error.message
    });
  }
});

// @desc    Delete payment settlement
// @route   DELETE /api/payment-settlements/:id
// @access  Private (Admin)
const deletePaymentSettlement = asyncHandler(async (req, res) => {
  try {
    const settlement = await PaymentSettlement.findByIdAndDelete(req.params.id);

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment settlement deleted successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment settlement',
      error: error.message
    });
  }
});

// @desc    Update settlement status
// @route   PATCH /api/payment-settlements/:id/status
// @access  Private (Admin)
const updateSettlementStatus = asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const validStatuses = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const settlement = await PaymentSettlement.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment settlement status updated successfully',
      data: settlement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update settlement status',
      error: error.message
    });
  }
});

// @desc    Get settlement statistics
// @route   GET /api/payment-settlements/stats
// @access  Private (Admin)
const getSettlementStats = asyncHandler(async (req, res) => {
  try {
    const stats = await PaymentSettlement.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalSettlements = await PaymentSettlement.countDocuments();
    const recentSettlements = await PaymentSettlement.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const statusStats = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total: totalSettlements,
        recent: recentSettlements,
        byStatus: statusStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlement statistics',
      error: error.message
    });
  }
});

// @desc    Delete attachment from payment settlement
// @route   DELETE /api/payment-settlements/:id/attachments/:attachmentId
// @access  Private (Admin)
const deleteAttachment = asyncHandler(async (req, res) => {
  try {
    const { id, attachmentId } = req.params;

    const settlement = await PaymentSettlement.findById(id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    const attachment = settlement.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    // Delete file from filesystem
    try {
      if (fs.existsSync(attachment.filePath)) {
        fs.unlinkSync(attachment.filePath);
      }
    } catch (fileError) {
      // File deletion failed silently
    }

    // Remove attachment from array
    settlement.attachments.pull(attachmentId);
    await settlement.save();

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting attachment',
      error: error.message
    });
  }
});

module.exports = {
  getPaymentSettlements,
  getPaymentSettlement,
  createPaymentSettlement,
  updatePaymentSettlement,
  deletePaymentSettlement,
  updateSettlementStatus,
  getSettlementStats,
  deleteAttachment,
  upload
};
