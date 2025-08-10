const express = require('express');
const asyncHandler = require('express-async-handler');
const CandidateApproval = require('../models/hr/CandidateApproval');
const Candidate = require('../models/hr/Candidate');
const EmailService = require('../services/emailService');

const router = express.Router();

// @route   GET /api/public-approvals/:id
// @desc    Get approval workflow by ID (public route for email links)
// @access  Public
router.get('/:id', 
  asyncHandler(async (req, res) => {
    const approval = await CandidateApproval.findById(req.params.id)
      .populate('candidate', 'firstName lastName email phone dateOfBirth address')
      .populate('jobPosting', 'title department description requirements')
      .populate('application', 'applicationId coverLetter expectedSalary')
      .populate('approvalLevels.approver', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval workflow not found'
      });
    }

    res.json({
      success: true,
      data: approval
    });
  })
);

// @route   POST /api/public-approvals/:id/approve
// @desc    Approve at current level (public route for email links)
// @access  Public
router.post('/:id/approve', 
  asyncHandler(async (req, res) => {
    const { comments, signature, approverEmail } = req.body;

    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required'
      });
    }

    const approval = await CandidateApproval.findById(req.params.id)
      .populate('candidate', 'firstName lastName email phone')
      .populate('jobPosting', 'title department')
      .populate('application', 'applicationId');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval workflow not found'
      });
    }

    // Find current level for this approver email
    const currentLevel = approval.approvalLevels.find(
      level => level.approverEmail === approverEmail && level.status === 'pending'
    );

    if (!currentLevel) {
      return res.status(403).json({
        success: false,
        message: 'No pending approval found for this email address'
      });
    }

    // Update current level
    currentLevel.status = 'approved';
    currentLevel.approver = null; // No user ID for external approvals
    currentLevel.approvedAt = new Date();
    currentLevel.comments = comments;
    currentLevel.signature = signature;

    // Check if this was the final approval
    const approvedLevels = approval.approvalLevels.filter(level => level.status === 'approved').length;
    
    if (approvedLevels === 5) {
      // All levels approved - CEO final approval
      approval.status = 'approved';
      approval.finalDecision = 'approved';
      approval.finalDecisionBy = null; // No user ID for external approvals
      approval.finalDecisionAt = new Date();
      approval.completedAt = new Date();

      // Update candidate status to HIRED (final status)
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'hired',
        updatedBy: null
      });

      // Send hiring confirmation email to candidate
      await EmailService.sendHiringConfirmation(approval);
    } else {
      // Move to next level
      approval.currentLevel = approvedLevels + 1;
      approval.status = 'in_progress';

      // Update candidate status
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'approval_in_progress',
        updatedBy: null
      });

      // Send email to next approver
      await EmailService.sendApprovalRequest(approval, approval.currentLevel);
    }

    await approval.save();

    // Add email notification
    approval.emailNotifications.push({
      type: 'approval_request',
      level: currentLevel.level,
      sentTo: approverEmail,
      sentAt: new Date(),
      deliveredAt: new Date(),
      status: 'delivered'
    });

    await approval.save();

    res.json({
      success: true,
      message: 'Approval submitted successfully',
      data: approval
    });
  })
);

// @route   POST /api/public-approvals/:id/reject
// @desc    Reject at current level (public route for email links)
// @access  Public
router.post('/:id/reject', 
  asyncHandler(async (req, res) => {
    const { comments, signature, approverEmail } = req.body;

    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required'
      });
    }

    const approval = await CandidateApproval.findById(req.params.id)
      .populate('candidate', 'firstName lastName email phone')
      .populate('jobPosting', 'title department')
      .populate('application', 'applicationId');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval workflow not found'
      });
    }

    // Find current level for this approver email
    const currentLevel = approval.approvalLevels.find(
      level => level.approverEmail === approverEmail && level.status === 'pending'
    );

    if (!currentLevel) {
      return res.status(403).json({
        success: false,
        message: 'No pending approval found for this email address'
      });
    }

    // Update current level
    currentLevel.status = 'rejected';
    currentLevel.approver = null; // No user ID for external approvals
    currentLevel.rejectedAt = new Date();
    currentLevel.comments = comments;
    currentLevel.signature = signature;

    // Update approval status
    approval.status = 'rejected';
    approval.finalDecision = 'rejected';
    approval.finalDecisionBy = null; // No user ID for external approvals
    approval.finalDecisionAt = new Date();
    approval.completedAt = new Date();

    // Update candidate status
    await Candidate.findByIdAndUpdate(approval.candidate._id, {
      status: 'rejected',
      updatedBy: null
    });

    await approval.save();

    // Add email notification
    approval.emailNotifications.push({
      type: 'approval_rejection',
      level: currentLevel.level,
      sentTo: approverEmail,
      sentAt: new Date(),
      deliveredAt: new Date(),
      status: 'delivered'
    });

    await approval.save();

    res.json({
      success: true,
      message: 'Rejection submitted successfully',
      data: approval
    });
  })
);

module.exports = router; 