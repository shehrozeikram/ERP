const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { authorize } = require('../middleware/auth');
const CandidateApproval = require('../models/hr/CandidateApproval');
const Candidate = require('../models/hr/Candidate');
const Application = require('../models/hr/Application');
const JobPosting = require('../models/hr/JobPosting');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const hiringService = require('../services/hiringService');

// @route   POST /api/candidate-approvals
// @desc    Create new approval workflow for a candidate
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { candidateId, jobPostingId, applicationId, approverEmails } = req.body;

    // Validate required fields
    if (!candidateId || !jobPostingId || !applicationId || !approverEmails) {
      return res.status(400).json({
        success: false,
        message: 'Candidate ID, Job Posting ID, Application ID, and approver emails are required'
      });
    }

    // Check if approval already exists for this candidate
    const existingApproval = await CandidateApproval.findOne({ candidate: candidateId });
    if (existingApproval) {
      return res.status(400).json({
        success: false,
        message: 'Approval workflow already exists for this candidate'
      });
    }

    // Validate approver emails (should be 5)
    if (!Array.isArray(approverEmails) || approverEmails.length !== 5) {
      return res.status(400).json({
        success: false,
        message: 'Exactly 5 approver emails are required'
      });
    }

    // Create approval workflow
    const approval = new CandidateApproval({
      candidate: candidateId,
      jobPosting: jobPostingId,
      application: applicationId,
      createdBy: req.body.createdBy || req.user._id,
      status: 'pending'
    });

    // Save first to trigger pre-save middleware and initialize approvalLevels
    await approval.save();

    // Now set approver emails for each level (all emails go to shehrozeikram2@gmail.com for testing)
    approval.approvalLevels[0].approverEmail = 'shehrozeikram2@gmail.com'; // Assistant Manager HR
    approval.approvalLevels[1].approverEmail = 'shehrozeikram2@gmail.com'; // Manager HR
    approval.approvalLevels[2].approverEmail = 'shehrozeikram2@gmail.com'; // HOD HR
    approval.approvalLevels[3].approverEmail = 'shehrozeikram2@gmail.com'; // Vice President
    approval.approvalLevels[4].approverEmail = 'shehrozeikram2@gmail.com'; // CEO

    // Save again to persist the approver emails
    await approval.save();

    // Update candidate status
    await Candidate.findByIdAndUpdate(candidateId, {
      status: 'approval_pending',
      updatedBy: req.body.createdBy || req.user._id
    });

    // Populate approval object before sending emails
    const populatedApproval = await CandidateApproval.findById(approval._id)
      .populate('candidate', 'firstName lastName email phone')
      .populate('jobPosting', 'title department')
      .populate('application', 'applicationId')
      .populate('createdBy', 'firstName lastName');

    // Send email only to Level 1 (Assistant Manager HR) initially
    try {
      await EmailService.sendApprovalRequest(populatedApproval, 1);
      console.log(`✅ Email sent to level 1 approver (Assistant Manager HR)`);
    } catch (error) {
      console.error(`❌ Failed to send email to level 1 approver:`, error.message);
    }

    res.status(201).json({
      success: true,
      message: 'Approval workflow created successfully',
      data: populatedApproval
    });
  })
);

// @route   GET /api/candidate-approvals
// @desc    Get all approval workflows
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { 'candidate.firstName': { $regex: search, $options: 'i' } },
        { 'candidate.lastName': { $regex: search, $options: 'i' } },
        { 'candidate.email': { $regex: search, $options: 'i' } },
        { 'jobPosting.title': { $regex: search, $options: 'i' } }
      ];
    }

    const approvals = await CandidateApproval.paginate(query, {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'candidate', select: 'firstName lastName email phone' },
        { path: 'jobPosting', select: 'title department' },
        { path: 'application', select: 'applicationId' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      sort: { createdAt: -1 }
    });

    res.json({
      success: true,
      data: approvals
    });
  })
);

// @route   GET /api/candidate-approvals/pending
// @desc    Get pending approvals for current user
// @access  Private
router.get('/pending', 
  authorize(), 
  asyncHandler(async (req, res) => {
    const pendingApprovals = await CandidateApproval.findPendingForUser(req.user.email);

    res.json({
      success: true,
      data: pendingApprovals
    });
  })
);

// @route   GET /api/candidate-approvals/:id
// @desc    Get approval workflow by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
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

// @route   GET /api/candidate-approvals/public/:id
// @desc    Get approval workflow by ID (public route for email links)
// @access  Public
router.get('/public/:id', 
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

// @route   POST /api/candidate-approvals/:id/approve
// @desc    Approve at current level
// @access  Private
router.post('/:id/approve', 
  authorize(), 
  asyncHandler(async (req, res) => {
    const { comments, signature } = req.body;

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

    // Find current level for this user
    const currentLevel = approval.approvalLevels.find(
      level => level.approverEmail === req.user.email && level.status === 'pending'
    );

    if (!currentLevel) {
      return res.status(403).json({
        success: false,
        message: 'No pending approval found for this user'
      });
    }

    // Update current level
    currentLevel.status = 'approved';
    currentLevel.approver = req.user._id;
    currentLevel.approvedAt = new Date();
    currentLevel.comments = comments;
    currentLevel.signature = signature;

    // Check if this was the final approval
    const approvedLevels = approval.approvalLevels.filter(level => level.status === 'approved').length;
    
    if (approvedLevels === 5) {
      // All levels approved - CEO final approval
      approval.status = 'approved';
      approval.finalDecision = 'approved';
      approval.finalDecisionBy = req.user._id;
      approval.finalDecisionAt = new Date();
      approval.completedAt = new Date();

      // Update candidate status to HIRED (final status)
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'hired',
        updatedBy: req.user._id
      });

      // Trigger hiring process
      try {
        await hiringService.hireEmployee(approval._id);
        console.log(`✅ Hiring process completed for candidate ${approval.candidate.firstName} ${approval.candidate.lastName}`);
      } catch (hiringError) {
        console.error(`❌ Failed to complete hiring process:`, hiringError.message);
        // Continue with the process even if hiring service fails
      }

      // Send hiring confirmation email to candidate
      await EmailService.sendHiringConfirmation(approval);
      
      // Create notification for HR team about new employee
      try {
        await NotificationService.createCandidateHiredNotification(
          approval.candidate,
          approval.jobPosting,
          req.user
        );
        console.log(`✅ HR notification created for newly hired candidate ${approval.candidate.firstName} ${approval.candidate.lastName}`);
      } catch (notificationError) {
        console.error(`❌ Failed to create HR notification for hired candidate:`, notificationError.message);
      }
      
      console.log(`🎉 All approval levels completed! Candidate ${approval.candidate.firstName} ${approval.candidate.lastName} is now HIRED!`);
    } else {
      // Move to next level
      const nextLevel = approvedLevels + 1;
      approval.currentLevel = nextLevel;
      approval.status = 'in_progress';

      // Update candidate status
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'approval_in_progress',
        updatedBy: req.user._id
      });

      console.log(`🔄 Moving to approval level ${nextLevel} (${approval.approvalLevels[nextLevel - 1].title})`);
      
      // Send email to next approver
      try {
        await EmailService.sendApprovalRequest(approval, nextLevel);
        console.log(`✅ Approval request email sent to Level ${nextLevel} (${approval.approvalLevels[nextLevel - 1].title})`);
      } catch (error) {
        console.error(`❌ Failed to send approval request email to Level ${nextLevel}:`, error.message);
      }
    }

    await approval.save();

    // Add email notification
    approval.emailNotifications.push({
      type: 'approval_request',
      level: currentLevel.level,
      sentTo: req.user.email,
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

// @route   POST /api/candidate-approvals/:id/approve-public
// @desc    Approve at current level (public route for email links)
// @access  Public
router.post('/:id/approve-public', 
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
      
      // Create notification for HR team about new employee
      try {
        await NotificationService.createCandidateHiredNotification(
          approval.candidate,
          approval.jobPosting,
          { _id: null } // No user ID for external approvals
        );
        console.log(`✅ HR notification created for newly hired candidate ${approval.candidate.firstName} ${approval.candidate.lastName}`);
      } catch (notificationError) {
        console.error(`❌ Failed to create HR notification for hired candidate:`, notificationError.message);
      }
      
      console.log(`🎉 All approval levels completed! Candidate ${approval.candidate.firstName} ${approval.candidate.lastName} is now HIRED!`);
    } else {
      // Move to next level
      const nextLevel = approvedLevels + 1;
      approval.currentLevel = nextLevel;
      approval.status = 'in_progress';

      // Update candidate status
      await Candidate.findByIdAndUpdate(approval.candidate._id, {
        status: 'approval_in_progress',
        updatedBy: null
      });

      console.log(`🔄 Moving to approval level ${nextLevel} (${approval.approvalLevels[nextLevel - 1].title})`);
      
      // Send email to next approver
      try {
        await EmailService.sendApprovalRequest(approval, nextLevel);
        console.log(`✅ Approval request email sent to Level ${nextLevel} (${approval.approvalLevels[nextLevel - 1].title})`);
      } catch (emailError) {
        console.error(`❌ Failed to send approval request email to Level ${nextLevel}:`, emailError.message);
      }
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

// @route   POST /api/candidate-approvals/:id/reject
// @desc    Reject at current level
// @access  Private
router.post('/:id/reject', 
  authorize(), 
  asyncHandler(async (req, res) => {
    const { comments, signature } = req.body;

    const approval = await CandidateApproval.findById(req.params.id)
      .populate('candidate', 'firstName lastName email phone')
      .populate('jobPosting', 'title department');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval workflow not found'
      });
    }

    // Find current level for this user
    const currentLevel = approval.approvalLevels.find(
      level => level.approverEmail === req.user.email && level.status === 'pending'
    );

    if (!currentLevel) {
      return res.status(403).json({
        success: false,
        message: 'No pending approval found for this user'
      });
    }

    // Update current level
    currentLevel.status = 'rejected';
    currentLevel.approver = req.user._id;
    currentLevel.rejectedAt = new Date();
    currentLevel.comments = comments;
    currentLevel.signature = signature;

    // Set final decision
    approval.status = 'rejected';
    approval.finalDecision = 'rejected';
    approval.finalDecisionBy = req.user._id;
    approval.finalDecisionAt = new Date();
    approval.completedAt = new Date();

    // Update candidate status
    await Candidate.findByIdAndUpdate(approval.candidate._id, {
      status: 'rejected',
      updatedBy: req.user._id
    });

    await approval.save();

    // Add email notification
    approval.emailNotifications.push({
      type: 'approval_completed',
      level: currentLevel.level,
      sentTo: req.user.email,
      sentAt: new Date(),
      deliveredAt: new Date(),
      status: 'delivered'
    });

    await approval.save();

    res.json({
      success: true,
      message: 'Approval rejected successfully',
      data: approval
    });
  })
);

// @route   POST /api/candidate-approvals/:id/remind
// @desc    Send reminder email to current approver
// @access  Private (HR and Admin)
router.post('/:id/remind', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const approval = await CandidateApproval.findById(req.params.id)
      .populate('candidate', 'firstName lastName email phone')
      .populate('jobPosting', 'title department');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval workflow not found'
      });
    }

    const currentLevel = approval.approvalLevels.find(level => level.status === 'pending');
    if (!currentLevel) {
      return res.status(400).json({
        success: false,
        message: 'No pending approval level found'
      });
    }

    // Send reminder email
    const emailService = new EmailService();
    await emailService.sendApprovalReminder(approval, currentLevel.level);

    res.json({
      success: true,
      message: 'Reminder email sent successfully'
    });
  })
);

// @route   DELETE /api/candidate-approvals/:id
// @desc    Cancel approval workflow
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const approval = await CandidateApproval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval workflow not found'
      });
    }

    if (approval.status === 'approved' || approval.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed approval workflow'
      });
    }

    approval.status = 'cancelled';
    approval.updatedBy = req.user._id;
    await approval.save();

    // Reset candidate status
    await Candidate.findByIdAndUpdate(approval.candidate, {
      status: 'passed',
      updatedBy: req.user._id
    });

    res.json({
      success: true,
      message: 'Approval workflow cancelled successfully'
    });
  })
);

module.exports = router; 