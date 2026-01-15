const PaymentSettlement = require('../models/hr/PaymentSettlement');
const AccountsPayable = require('../models/finance/AccountsPayable');
const FinanceHelper = require('../utils/financeHelper');
const { asyncHandler } = require('../middleware/errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { checkSubRoleAccess } = require('../config/permissions');
const {
  getWorkflowStatusForRole,
  getWorkflowStatusForUserAndRole,
  canUserAccessStatus,
  getAllWorkflowStatuses,
  isValidStatusTransition,
  getBaseWorkflowStatus,
  getSourceStatus
} = require('../utils/paymentSettlementWorkflow');

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
      workflowStatus,
      parentCompanyName,
      subsidiaryName,
      fromDepartment,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Check if user has access to payment_settlement submodule
    // If they have access, they can see all records regardless of workflow status
    const hasPaymentSettlementAccess = await checkSubRoleAccess(
      req.user.id,
      'admin',
      'payment_settlement',
      'read'
    );

    // User-based workflow status filtering (email takes priority over role)
    // Only apply workflow status filtering if user doesn't have full payment settlement access
    const userRole = req.user.role;
    const userEmail = req.user.email;
    const userWorkflowStatus = getWorkflowStatusForUserAndRole(userEmail, userRole);
    
    // If user has payment settlement access, they can see all records
    // Otherwise, filter by their assigned workflow status
    // Super admin, higher management, and admin can see all
    if (!hasPaymentSettlementAccess && userWorkflowStatus) {
      query.workflowStatus = userWorkflowStatus;
    } else if (workflowStatus) {
      // Allow explicit workflowStatus filter if provided
      query.workflowStatus = workflowStatus;
    }

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

    // Filter by status (legacy status field)
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
      .populate('workflowHistory.changedBy', 'firstName lastName email')
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
      .populate('updatedBy', 'firstName lastName email')
      .populate('workflowHistory.changedBy', 'firstName lastName email');

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

// @desc    Update settlement status (legacy)
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

// @desc    Update workflow status
// @route   PATCH /api/payment-settlements/:id/workflow-status
// @access  Private (Admin)
const updateWorkflowStatus = asyncHandler(async (req, res) => {
  try {
    const { workflowStatus, comments, digitalSignature, observations } = req.body;

    if (!workflowStatus) {
      return res.status(400).json({
        success: false,
        message: 'Workflow status is required'
      });
    }

    // Validate base workflow status (extract base if it's an approved/rejected with source)
    const baseStatus = getBaseWorkflowStatus(workflowStatus);
    const validStatuses = getAllWorkflowStatuses();
    if (!validStatuses.includes(baseStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid workflow status'
      });
    }

    const settlement = await PaymentSettlement.findById(req.params.id)
      .populate('workflowHistory.changedBy', 'firstName lastName email');
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    // Check if user has permission to change status from current status
    const userRole = req.user.role;
    const userEmail = req.user.email;
    const userWorkflowStatus = getWorkflowStatusForUserAndRole(userEmail, userRole);
    
    // Extract base status for comparison (handles "Approved (from ...)" format)
    const currentBaseStatus = getBaseWorkflowStatus(settlement.workflowStatus);
    const sourceStatus = getSourceStatus(settlement.workflowStatus);
    
    // If user is assigned to a specific status, check if they can modify this document
    if (userWorkflowStatus) {
      // Allow if:
      // 1. Document is currently in their assigned status, OR
      // 2. Document was approved/rejected from their assigned status (source status matches), OR
      // 3. User approved/rejected it from their assigned status (check workflow history)
      const isCurrentlyAssigned = currentBaseStatus === userWorkflowStatus;
      const wasApprovedFromAssigned = sourceStatus === userWorkflowStatus && 
                                      (currentBaseStatus === 'Approved' || currentBaseStatus === 'Rejected');
      
      // Check workflow history to see if user approved/rejected from their assigned status
      let userProcessedFromAssigned = false;
      if (settlement.workflowHistory && settlement.workflowHistory.length > 0) {
        const lastAction = settlement.workflowHistory[settlement.workflowHistory.length - 1];
        if (lastAction) {
          const changedByEmail = lastAction.changedBy?.email || 
                                (typeof lastAction.changedBy === 'string' ? lastAction.changedBy : null);
          if (changedByEmail?.toLowerCase() === userEmail?.toLowerCase() &&
              lastAction.fromStatus === userWorkflowStatus &&
              (lastAction.toStatus === 'Approved' || lastAction.toStatus === 'Rejected')) {
            userProcessedFromAssigned = true;
          }
        }
      }
      
      if (!isCurrentlyAssigned && !wasApprovedFromAssigned && !userProcessedFromAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You can only modify documents assigned to you'
        });
      }
    }

    // Validate status transition (use base status for validation)
    if (settlement.workflowStatus && !isValidStatusTransition(currentBaseStatus, baseStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${settlement.workflowStatus} to ${workflowStatus}`
      });
    }

    // Build final comments with observations and digital signature if provided
    let finalComments = comments || '';
    if (observations && Array.isArray(observations) && observations.length > 0) {
      const observationTexts = observations.map((obs, idx) => 
        `Observation ${idx + 1} (${obs.severity || 'medium'}): ${obs.observation}`
      ).join('; ');
      finalComments = finalComments ? `${finalComments}. Observations: ${observationTexts}` : `Observations: ${observationTexts}`;
    }
    if (digitalSignature) {
      finalComments = finalComments ? `${finalComments} [Digital Signature: ${digitalSignature}]` : `[Digital Signature: ${digitalSignature}]`;
    }
    
    // Add to workflow history
    const historyEntry = {
      fromStatus: settlement.workflowStatus || 'Draft',
      toStatus: workflowStatus,
      changedBy: req.user.id,
      changedAt: new Date(),
      comments: finalComments || '',
      digitalSignature: digitalSignature || undefined
    };

    // Update settlement
    settlement.workflowStatus = workflowStatus;
    settlement.workflowHistory = settlement.workflowHistory || [];
    settlement.workflowHistory.push(historyEntry);
    settlement.updatedBy = req.user.id;

    await settlement.save();

    const updatedSettlement = await PaymentSettlement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('workflowHistory.changedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Workflow status updated successfully',
      data: updatedSettlement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update workflow status',
      error: error.message
    });
  }
});

// @desc    Approve document
// @route   PATCH /api/payment-settlements/:id/approve
// @access  Private (Admin)
const approveDocument = asyncHandler(async (req, res) => {
  try {
    const { comments, digitalSignature } = req.body;

    const settlement = await PaymentSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    // Check if user has permission to approve
    const userRole = req.user.role;
    const userEmail = req.user.email;
    const userWorkflowStatus = getWorkflowStatusForUserAndRole(userEmail, userRole);
    
    // If user is assigned to a specific status, they can only approve documents assigned to them
    if (userWorkflowStatus && settlement.workflowStatus !== userWorkflowStatus) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve documents assigned to you'
      });
    }

    // Check if document can be approved (must be in a "Send to" status or "Forwarded to CEO")
    if (!settlement.workflowStatus || (!settlement.workflowStatus.includes('Send to') && settlement.workflowStatus !== 'Forwarded to CEO')) {
      return res.status(400).json({
        success: false,
        message: 'Document must be in a "Send to" status or "Forwarded to CEO" status to be approved'
      });
    }

    // Store the source status for display
    const sourceStatus = settlement.workflowStatus;
    
    // Add to workflow history
    const historyEntry = {
      fromStatus: sourceStatus,
      toStatus: 'Approved',
      changedBy: req.user.id,
      changedAt: new Date(),
      comments: comments || (digitalSignature ? `Document approved with digital signature: ${digitalSignature}` : 'Document approved'),
      digitalSignature: digitalSignature || undefined
    };

    // Update settlement - keep it in approved state but don't change workflowStatus yet
    // User will forward it after approval, so we'll update workflowStatus then
    // For now, mark as approved but keep the source status visible
    settlement.workflowStatus = `Approved (from ${sourceStatus})`;
    settlement.status = 'Approved'; // Also update legacy status
    settlement.workflowHistory = settlement.workflowHistory || [];
    settlement.workflowHistory.push(historyEntry);
    settlement.updatedBy = req.user.id;

    await settlement.save();

    // Track if Accounts Payable entry was created
    let accountsPayableCreated = false;
    let accountsPayableId = null;

    // If CEO approved (from "Forwarded to CEO"), create Accounts Payable entry
    if (sourceStatus === 'Forwarded to CEO') {
      try {
        // Check if Accounts Payable entry already exists for this settlement
        const existingAP = await AccountsPayable.findOne({ referenceId: settlement._id });
        if (!existingAP) {
          // Parse amount - handle string format like "PKR 50,000" or just "50000"
          const amountStr = settlement.grandTotal || settlement.amount || '0';
          const numericAmount = parseFloat(amountStr.toString().replace(/[^\d.-]/g, '')) || 0;
          
          if (numericAmount > 0) {
            // Generate bill number from settlement reference number or ID
            let billNumber = settlement.referenceNumber || `PS-${settlement._id.toString().slice(-8)}`;
            
            // Check if bill number already exists and make it unique if needed
            const existingBill = await AccountsPayable.findOne({ billNumber });
            if (existingBill) {
              billNumber = `${billNumber}-${Date.now().toString().slice(-6)}`;
            }
            
            // Always use today's date as billDate for Accounts Payable entries created from CEO approvals
            // This ensures they appear in the default date filter range (current month)
            const billDate = new Date();
            billDate.setHours(0, 0, 0, 0);
            
            // Calculate due date (30 days from bill date)
            const dueDate = new Date(billDate);
            dueDate.setDate(dueDate.getDate() + 30);

            // Map department to valid enum values
            const mapDepartment = (dept) => {
              if (!dept) return 'general';
              const deptLower = dept.toLowerCase().trim();
              const validDepartments = ['hr', 'admin', 'procurement', 'sales', 'finance', 'audit', 'general'];
              return validDepartments.find(valid => deptLower === valid || deptLower.includes(valid)) || 'general';
            };

            // Create Accounts Payable entry using FinanceHelper
            const apEntry = await FinanceHelper.createAPFromBill({
              vendorName: settlement.toWhomPaid || settlement.subsidiaryName || 'Unknown Vendor',
              vendorEmail: '', // Not available in settlement
              vendorId: null, // Not available in settlement
              billNumber: billNumber,
              billDate: billDate,
              dueDate: dueDate,
              amount: numericAmount,
              department: mapDepartment(settlement.fromDepartment),
              module: 'general',
              referenceId: settlement._id,
              createdBy: req.user.id
            });
            
            accountsPayableCreated = true;
            accountsPayableId = apEntry._id;
          }
        }
      } catch (apError) {
        // Log error but don't fail the approval
        console.error('Error creating Accounts Payable entry:', apError.message);
        // Continue with approval even if AP creation fails
      }
    }

    const updatedSettlement = await PaymentSettlement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('workflowHistory.changedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Document approved successfully',
      data: updatedSettlement,
      accountsPayableCreated,
      accountsPayableId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to approve document',
      error: error.message
    });
  }
});

// @desc    Reject document
// @route   PATCH /api/payment-settlements/:id/reject
// @access  Private (Admin)
const rejectDocument = asyncHandler(async (req, res) => {
  try {
    const { comments, digitalSignature, observations } = req.body;

    if (!comments || comments.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comments are required when rejecting a document'
      });
    }

    const settlement = await PaymentSettlement.findById(req.params.id);
    if (!settlement) {
      return res.status(404).json({
        success: false,
        message: 'Payment settlement not found'
      });
    }

    // Check if user has permission to reject
    const userRole = req.user.role;
    const userEmail = req.user.email;
    const userWorkflowStatus = getWorkflowStatusForUserAndRole(userEmail, userRole);
    
    // If user is assigned to a specific status, they can only reject documents assigned to them
    if (userWorkflowStatus && settlement.workflowStatus !== userWorkflowStatus) {
      return res.status(403).json({
        success: false,
        message: 'You can only reject documents assigned to you'
      });
    }

    // Check if document can be rejected (must be in a "Send to" status or "Forwarded to CEO")
    if (!settlement.workflowStatus || (!settlement.workflowStatus.includes('Send to') && settlement.workflowStatus !== 'Forwarded to CEO')) {
      return res.status(400).json({
        success: false,
        message: 'Document must be in a "Send to" status or "Forwarded to CEO" status to be rejected'
      });
    }

    // Store the source status for display
    const sourceStatus = settlement.workflowStatus;
    
    // Build comments with observations if provided
    let finalComments = comments || 'Document rejected';
    if (observations && Array.isArray(observations) && observations.length > 0) {
      const observationTexts = observations.map((obs, idx) => 
        `Observation ${idx + 1} (${obs.severity || 'medium'}): ${obs.observation}`
      ).join('; ');
      finalComments = `${finalComments}. Observations: ${observationTexts}`;
    }
    if (digitalSignature) {
      finalComments = `${finalComments} [Digital Signature: ${digitalSignature}]`;
    }
    
    // Add to workflow history
    const historyEntry = {
      fromStatus: sourceStatus,
      toStatus: 'Rejected',
      changedBy: req.user.id,
      changedAt: new Date(),
      comments: finalComments,
      digitalSignature: digitalSignature || undefined
    };

    // Update settlement with source status included
    settlement.workflowStatus = `Rejected (from ${sourceStatus})`;
    settlement.status = 'Rejected'; // Also update legacy status
    settlement.workflowHistory = settlement.workflowHistory || [];
    settlement.workflowHistory.push(historyEntry);
    settlement.updatedBy = req.user.id;

    await settlement.save();

    const updatedSettlement = await PaymentSettlement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('workflowHistory.changedBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Document rejected successfully',
      data: updatedSettlement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reject document',
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
  updateWorkflowStatus,
  approveDocument,
  rejectDocument,
  getSettlementStats,
  deleteAttachment,
  upload
};
