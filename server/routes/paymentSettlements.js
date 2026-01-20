const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const PaymentSettlement = require('../models/hr/PaymentSettlement');
const {
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
} = require('../controllers/paymentSettlementController');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// @desc    Get settlement statistics
// @route   GET /api/payment-settlements/stats
// @access  Private (Admin)
router.get('/stats', permissions.checkSubRolePermission('admin', 'payment_settlement', 'read'), getSettlementStats);

// @desc    Get all payment settlements with pagination and filters
// @route   GET /api/payment-settlements
// @access  Private (Admin)
router.get('/', permissions.checkSubRolePermission('admin', 'payment_settlement', 'read'), getPaymentSettlements);

// @desc    Get single payment settlement by ID
// @route   GET /api/payment-settlements/:id
// @access  Private (Admin)
router.get('/:id', permissions.checkSubRolePermission('admin', 'payment_settlement', 'read'), getPaymentSettlement);

// @desc    Create new payment settlement
// @route   POST /api/payment-settlements
// @access  Private (Admin)
router.post('/', permissions.checkSubRolePermission('admin', 'payment_settlement', 'create'), upload.array('attachments', 10), createPaymentSettlement);

// @desc    Update payment settlement
// @route   PUT /api/payment-settlements/:id
// @access  Private (Admin)
router.put('/:id', permissions.checkSubRolePermission('admin', 'payment_settlement', 'update'), upload.array('attachments', 10), updatePaymentSettlement);

// @desc    Update settlement status
// @route   PATCH /api/payment-settlements/:id/status
// @access  Private (Admin)
router.patch('/:id/status', permissions.checkSubRolePermission('admin', 'payment_settlement', 'approve'), updateSettlementStatus);

// @desc    Update workflow status
// @route   PATCH /api/payment-settlements/:id/workflow-status
// @access  Private (Admin)
router.patch('/:id/workflow-status', permissions.checkSubRolePermission('admin', 'payment_settlement', 'update'), updateWorkflowStatus);

// @desc    Approve document
// @route   PATCH /api/payment-settlements/:id/approve
// @access  Private (Admin, Audit Director for forwarded documents)
router.patch('/:id/approve', 
  authMiddleware,
  async (req, res, next) => {
    // Check if document is forwarded to Audit Director - allow Audit Director to bypass sub-role check
    try {
      const PaymentSettlement = require('../models/hr/PaymentSettlement');
      const settlement = await PaymentSettlement.findById(req.params.id);
      if (settlement && settlement.workflowStatus === 'Forwarded to Audit Director') {
        const userRole = req.user.role;
        const normalizedRole = String(userRole).toLowerCase().replace(/\s+/g, '_');
        // Allow Audit Director or super_admin to approve forwarded documents
        if (userRole === 'super_admin' || normalizedRole === 'audit_director' || userRole === 'Audit Director') {
          return next(); // Skip sub-role check
        }
      }
      // For other cases, use sub-role permission check
      return permissions.checkSubRolePermission('admin', 'payment_settlement', 'approve')(req, res, next);
    } catch (error) {
      // If error checking document, fall back to sub-role check
      return permissions.checkSubRolePermission('admin', 'payment_settlement', 'approve')(req, res, next);
    }
  },
  approveDocument
);

// @desc    Reject document
// @route   PATCH /api/payment-settlements/:id/reject
// @access  Private (Admin)
router.patch('/:id/reject', permissions.checkSubRolePermission('admin', 'payment_settlement', 'approve'), rejectDocument);

// @desc    Delete payment settlement
// @route   DELETE /api/payment-settlements/:id
// @access  Private (Admin)
router.delete('/:id', permissions.checkSubRolePermission('admin', 'payment_settlement', 'delete'), deletePaymentSettlement);

// @desc    Delete attachment from payment settlement
// @route   DELETE /api/payment-settlements/:id/attachments/:attachmentId
// @access  Private (Admin)
router.delete('/:id/attachments/:attachmentId', permissions.checkSubRolePermission('admin', 'payment_settlement', 'update'), deleteAttachment);

// @desc    Get attachment file
// @route   GET /api/payment-settlements/:id/attachments/:attachmentId/download
// @access  Private (Admin)
router.get('/:id/attachments/:attachmentId/download', async (req, res) => {
  try {
    // Check authentication via token query parameter
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // Verify token (you might want to use your existing auth middleware logic here)
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

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

    const fs = require('fs');
    const path = require('path');
    
    // Check if file exists
    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.originalName}"`);
    
    // Send the file
    res.sendFile(path.resolve(attachment.filePath));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error serving attachment',
      error: error.message
    });
  }
});

module.exports = router;
