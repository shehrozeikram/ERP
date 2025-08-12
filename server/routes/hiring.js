const express = require('express');
const router = express.Router();
const hiringService = require('../services/hiringService');
const { authMiddleware } = require('../middleware/auth');

// Public routes (no authentication required)
router.get('/public/joining-document/:approvalId', async (req, res) => {
  try {
    const { approvalId } = req.params;
    
    console.log(`📄 Public GET request for joining document: ${approvalId}`);
    
    const result = await hiringService.getPublicJoiningDocument(approvalId);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in public GET joining document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load joining document'
    });
  }
});

router.post('/public/joining-document/:approvalId', async (req, res) => {
  try {
    const { approvalId } = req.params;
    const formData = req.body;
    
    console.log(`📝 Public POST request for joining document: ${approvalId}`);
    console.log('Form data:', formData);
    
    const result = await hiringService.createJoiningDocument(approvalId, formData);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in public POST joining document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit joining document'
    });
  }
});

// Protected routes (require authentication)
router.post('/hire-employee/:approvalId', authMiddleware, async (req, res) => {
  try {
    const { approvalId } = req.params;
    
    console.log(`🚀 Hiring employee for approval: ${approvalId}`);
    
    const result = await hiringService.hireEmployee(approvalId);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error hiring employee:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to hire employee'
    });
  }
});

// Get all joining documents (admin only)
router.get('/joining-documents', authMiddleware, async (req, res) => {
  try {
    const JoiningDocument = require('../models/hr/JoiningDocument');
    
    const documents = await JoiningDocument.find()
      .populate('approvalId')
      .populate('candidateId')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('❌ Error getting joining documents:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get joining documents'
    });
  }
});

// Get specific joining document (admin only)
router.get('/joining-documents/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const JoiningDocument = require('../models/hr/JoiningDocument');
    
    const document = await JoiningDocument.findById(id)
      .populate('approvalId')
      .populate('candidateId');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Joining document not found'
      });
    }
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('❌ Error getting joining document:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get joining document'
    });
  }
});

// Update joining document status (admin only)
router.put('/joining-documents/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, hrRemarks } = req.body;
    const JoiningDocument = require('../models/hr/JoiningDocument');
    
    const updateData = { status };
    if (hrRemarks) updateData.hrRemarks = hrRemarks;
    if (status === 'approved') {
      updateData.hrApprovedAt = new Date();
      updateData.hrApprovedBy = req.user._id;
    }
    
    const document = await JoiningDocument.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('approvalId').populate('candidateId');
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Joining document not found'
      });
    }
    
    res.json({
      success: true,
      data: document,
      message: `Joining document ${status} successfully`
    });
  } catch (error) {
    console.error('❌ Error updating joining document status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update joining document status'
    });
  }
});

module.exports = router;
