const express = require('express');
const router = express.Router();
const CandidateApproval = require('../models/hr/CandidateApproval');
const Candidate = require('../models/hr/Candidate');
const JobPosting = require('../models/hr/JobPosting');
const EmailService = require('../services/emailService');

// Get approval details by approval ID (public)
router.get('/:approvalId', async (req, res) => {
  try {
    const approval = await CandidateApproval.findById(req.params.approvalId)
      .populate('candidate', 'firstName lastName email phone')
      .populate({
        path: 'jobPosting',
        populate: [
          { path: 'department', select: 'name' }
        ]
      })
      .select('-__v -internalNotes -evaluationNotes');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found'
      });
    }

    res.json({
      success: true,
      data: approval
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching approval details',
      error: error.message
    });
  }
});

// Submit approval response (public)
router.post('/:approvalId/respond', async (req, res) => {
  try {
    const { response, comments, availability, expectedSalary } = req.body;

    if (!response || !['accepted', 'declined'].includes(response)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid response. Must be "accepted" or "declined"'
      });
    }

    const approval = await CandidateApproval.findById(req.params.approvalId);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found'
      });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Approval has already been processed'
      });
    }

    // Update approval status
    approval.status = response === 'accepted' ? 'approved' : 'rejected';
    approval.candidateResponse = {
      response,
      comments,
      availability,
      expectedSalary,
      respondedAt: new Date()
    };

    await approval.save();

    // Update candidate status
    const candidate = await Candidate.findById(approval.candidate);
    if (candidate) {
      candidate.status = response === 'accepted' ? 'approved' : 'rejected';
      await candidate.save();
    }

    res.json({
      success: true,
      message: `Application ${response} successfully`,
      data: approval
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing approval response',
      error: error.message
    });
  }
});

// Approve application (public) - for external approvers in hierarchical system
router.post('/:approvalId/approve', async (req, res) => {
  try {
    console.log(`🚀 Starting approval process for approval ID: ${req.params.approvalId}`);
    console.log('Request body:', req.body);
    
    const { comments, signature, approverEmail } = req.body;

    if (!approverEmail) {
      console.log('❌ Missing approver email');
      return res.status(400).json({
        success: false,
        message: 'Approver email is required'
      });
    }

    console.log(`🔍 Looking for approval with ID: ${req.params.approvalId}`);
    const approval = await CandidateApproval.findById(req.params.approvalId)
      .populate('candidate', 'firstName lastName email');

    if (!approval) {
      console.log('❌ Approval not found');
      return res.status(404).json({
        success: false,
        message: 'Approval not found'
      });
    }

    console.log(`✅ Approval found. Current status: ${approval.status}, Current level: ${approval.currentLevel}`);
    console.log('📋 Full approval data:', JSON.stringify(approval, null, 2));
    console.log('🔍 Approval levels:', approval.approvalLevels.map(l => ({
      level: l.level,
      title: l.title,
      status: l.status,
      approverEmail: l.approverEmail,
      isPending: l.status === 'pending'
    })));

    if (approval.status !== 'pending' && approval.status !== 'in_progress') {
      console.log(`❌ Approval status is ${approval.status}, cannot process`);
      console.log('❌ Expected status: pending or in_progress');
      console.log('❌ Current status:', approval.status);
      return res.status(400).json({
        success: false,
        message: 'Approval has already been completed or is not in progress',
        currentStatus: approval.status,
        expectedStatuses: ['pending', 'in_progress']
      });
    }

    // Find the current pending level for this approver
    console.log(`🔍 Looking for pending level for approver: ${approverEmail}`);
    console.log('🔍 All levels status:', approval.approvalLevels.map(l => ({
      level: l.level,
      title: l.title,
      status: l.status,
      approverEmail: l.approverEmail,
      isPending: l.status === 'pending',
      matchesEmail: l.approverEmail === approverEmail
    })));
    
    // TEMPORARY FIX: For testing, allow approval with any email if there's a pending level
    // In production, this should be strict email matching
    let currentLevel;
    if (process.env.NODE_ENV === 'development' || process.env.ALLOW_ANY_EMAIL === 'true') {
      // Development mode: find any pending level
      currentLevel = approval.approvalLevels.find(level => level.status === 'pending');
      if (currentLevel) {
        console.log(`🔧 DEVELOPMENT MODE: Found pending level ${currentLevel.level} for any email`);
      }
    } else {
      // Production mode: strict email matching
      currentLevel = approval.approvalLevels.find(
        level => level.approverEmail === approverEmail && level.status === 'pending'
      );
    }

    if (!currentLevel) {
      console.log('❌ No pending approval found for this approver');
      console.log('❌ Requested approver email:', approverEmail);
      console.log('❌ Available levels:', approval.approvalLevels.map(l => ({
        level: l.level,
        title: l.title,
        status: l.status,
        approverEmail: l.approverEmail,
        isPending: l.status === 'pending',
        matchesEmail: l.approverEmail === approverEmail
      })));
      
      // Check if the approver email exists but status is not pending
      const approverLevel = approval.approvalLevels.find(l => l.approverEmail === approverEmail);
      if (approverLevel) {
        console.log('❌ Approver found but status is not pending:', approverLevel.status);
        return res.status(400).json({
          success: false,
          message: `Approver found but approval level is already ${approverLevel.status}`,
          approverLevel: approverLevel.level,
          approverStatus: approverLevel.status,
          approverTitle: approverLevel.title,
          suggestion: 'This level has already been processed. Check if you are the correct approver for the current pending level.'
        });
      } else {
        console.log('❌ Approver email not found in any level');
        return res.status(403).json({
          success: false,
          message: 'No pending approval found for this approver or approval level not found',
          requestedEmail: approverEmail,
          availableEmails: approval.approvalLevels.map(l => l.approverEmail),
          suggestion: 'Please use one of the configured approver emails for this approval level.',
          pendingLevels: approval.approvalLevels.filter(l => l.status === 'pending').map(l => ({
            level: l.level,
            title: l.title,
            approverEmail: l.approverEmail
          }))
        });
      }
    }

    console.log(`✅ Found pending level: ${currentLevel.level} - ${currentLevel.title}`);
    if (process.env.NODE_ENV === 'development' || process.env.ALLOW_ANY_EMAIL === 'true') {
      console.log(`🔧 DEVELOPMENT MODE: Using level ${currentLevel.level} (${currentLevel.title}) for email: ${approverEmail}`);
    } else {
      console.log(`✅ Using level ${currentLevel.level} (${currentLevel.title}) for approver: ${approverEmail}`);
    }

    // Update current level
    currentLevel.status = 'approved';
    currentLevel.approver = null; // External approver, no user ID
    currentLevel.approvedAt = new Date();
    currentLevel.comments = comments;
    currentLevel.signature = signature;

    console.log(`✅ Level ${currentLevel.level} marked as approved`);
    console.log(`🔍 Current level after update:`, {
      level: currentLevel.level,
      title: currentLevel.title,
      status: currentLevel.status,
      approverEmail: currentLevel.approverEmail,
      approvedAt: currentLevel.approvedAt,
      comments: currentLevel.comments
    });

    // Check if this was the final approval
    const approvedLevels = approval.approvalLevels.filter(level => level.status === 'approved').length;
    console.log(`📊 Total approved levels: ${approvedLevels}/5`);
    console.log(`🔍 All levels after update:`, approval.approvalLevels.map(l => ({
      level: l.level,
      title: l.title,
      status: l.status,
      approverEmail: l.approverEmail,
      approvedAt: l.approvedAt
    })));
    
    if (approvedLevels === 5) {
      console.log('🎉 This is the final approval! All levels completed.');
      
      // All levels approved - final approval
      approval.status = 'approved';
      approval.finalDecision = 'approved';
      approval.finalDecisionAt = new Date();
      approval.completedAt = new Date();

      // Update candidate status to HIRED (final status)
      try {
        await Candidate.findByIdAndUpdate(approval.candidate._id, {
          status: 'hired'
        });
        console.log(`✅ Candidate status updated to 'hired'`);
      } catch (updateError) {
        console.error(`❌ Failed to update candidate status:`, updateError.message);
        // Continue with the process even if candidate update fails
      }

      console.log(`🎉 All approval levels completed! Candidate ${approval.candidate.firstName} ${approval.candidate.lastName} is now HIRED! Joining document creation is pending.`);

      // Create placeholder onboarding record for the candidate
      try {
        console.log(`📋 Creating placeholder onboarding record for candidate...`);
        const EmployeeOnboarding = require('../models/hr/EmployeeOnboarding');
        
        // Check if onboarding already exists
        const existingOnboarding = await EmployeeOnboarding.findOne({ approvalId: approval._id });
        if (existingOnboarding) {
          console.log(`✅ Onboarding record already exists: ${existingOnboarding._id}`);
        } else {
          // Create new placeholder onboarding
          const placeholderOnboarding = new EmployeeOnboarding({
            approvalId: approval._id,
            status: 'pending',
            // Onboarding tasks with correct field names
            onboardingTasks: [
              { 
                taskName: 'Complete Personal Information',
                description: 'Fill out personal details and contact information',
                status: 'pending',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              },
              { 
                taskName: 'Submit Required Documents',
                description: 'Upload CNIC, educational certificates, and other required documents',
                status: 'pending',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              },
              { 
                taskName: 'Complete Employment Details',
                description: 'Provide employment history and references',
                status: 'pending',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              },
              { 
                taskName: 'Review Company Policies',
                description: 'Read and acknowledge company policies and procedures',
                status: 'pending',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              }
            ],
            // Training requirements with correct enum values
            trainingRequirements: [
              { 
                trainingName: 'Company Orientation',
                description: 'Introduction to company culture, policies, and procedures',
                isRequired: true,
                status: 'not_started'
              },
              { 
                trainingName: 'Role-specific Training',
                description: 'Training specific to the employee\'s role and responsibilities',
                isRequired: true,
                status: 'not_started'
              }
            ]
          });
          
          await placeholderOnboarding.save();
          console.log(`✅ Placeholder onboarding record created: ${placeholderOnboarding._id}`);
        }
      } catch (onboardingError) {
        console.error(`❌ Failed to create placeholder onboarding record:`, onboardingError.message);
        // Continue with the process even if onboarding creation fails
      }

      // Send joining document request email to candidate
      try {
        console.log(`📧 Sending joining document request email to ${approval.candidate.email}`);
        const emailResult = await EmailService.sendJoiningDocumentRequest(approval);
        
        if (emailResult && emailResult.success) {
          console.log(`✅ Joining document request email sent to ${approval.candidate.email}`);
        } else {
          console.error(`❌ Failed to send joining document request email:`, emailResult?.error || 'Unknown error');
        }
      } catch (emailError) {
        console.error(`❌ Error sending joining document request email:`, emailError.message);
        // Continue with the process even if email fails
      }
    } else {
      // Move to next level
      const nextLevel = approvedLevels + 1;
      approval.currentLevel = nextLevel;
      approval.status = 'in_progress';

      console.log(`🔄 Moving to approval level ${nextLevel} (${approval.approvalLevels[nextLevel - 1].title})`);

      // Update candidate status
      try {
        await Candidate.findByIdAndUpdate(approval.candidate._id, {
          status: 'approval_in_progress'
        });
        console.log(`✅ Candidate status updated to 'approval_in_progress'`);
      } catch (updateError) {
        console.error(`❌ Failed to update candidate status:`, updateError.message);
        // Continue with the process even if candidate update fails
      }
      
      // Send email to next approver
      try {
        console.log(`📧 Sending approval request email to Level ${nextLevel}`);
        
        // Ensure the approval object is fully populated before sending email
        const populatedApproval = await CandidateApproval.findById(approval._id)
          .populate('candidate', 'firstName lastName email phone')
          .populate({
            path: 'jobPosting',
            populate: [
              { path: 'department', select: 'name' }
            ]
          })
          .populate('application', 'applicationId');
        
        const emailResult = await EmailService.sendApprovalRequest(populatedApproval, nextLevel);
        
        if (emailResult && emailResult.success) {
          console.log(`✅ Approval request email sent to Level ${nextLevel} (${approval.approvalLevels[nextLevel - 1].title})`);
        } else {
          console.error(`❌ Failed to send approval request email to Level ${nextLevel}:`, emailResult?.error || 'Unknown error');
        }
      } catch (emailError) {
        console.error(`❌ Error sending approval request email to Level ${nextLevel}:`, emailError.message);
        // Continue with the process even if email fails
      }
    }

    // Save the approval changes
    try {
      console.log(`💾 Saving approval changes...`);
      console.log('Approval object before save:', {
        id: approval._id,
        status: approval.status,
        currentLevel: approval.currentLevel,
        finalDecision: approval.finalDecision,
        finalDecisionAt: approval.finalDecisionAt,
        completedAt: approval.completedAt
      });
      
      // Validate the approval object before saving
      const validationError = approval.validateSync();
      if (validationError) {
        console.error('❌ Validation error:', validationError.message);
        console.error('Validation details:', validationError.errors);
        console.error('❌ Full validation error object:', JSON.stringify(validationError, null, 2));
        
        // Log the current approval object state
        console.error('❌ Current approval object state:', {
          id: approval._id,
          status: approval.status,
          currentLevel: approval.currentLevel,
          finalDecision: approval.finalDecision,
          finalDecisionAt: approval.finalDecisionAt,
          completedAt: approval.completedAt,
          emailNotifications: approval.emailNotifications?.length || 0,
          approvalLevels: approval.approvalLevels?.length || 0
        });
        
        return res.status(400).json({
          success: false,
          message: 'Validation error occurred',
          error: validationError.message,
          details: validationError.errors,
          currentState: {
            status: approval.status,
            currentLevel: approval.currentLevel,
            finalDecision: approval.finalDecision
          }
        });
      }
      
      await approval.save();
      console.log(`✅ Approval saved successfully`);
    } catch (saveError) {
      console.error(`❌ Failed to save approval:`, saveError.message);
      console.error('Save error details:', saveError);
      
      // Check if it's a MongoDB validation error
      if (saveError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error occurred while saving approval',
          error: saveError.message,
          details: saveError.errors
        });
      }
      
      // Check if it's a MongoDB duplicate key error
      if (saveError.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate key error occurred',
          error: saveError.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to save approval changes',
        error: saveError.message
      });
    }

    console.log(`🎯 Approval process completed successfully for level ${currentLevel.level}`);
    res.json({
      success: true,
      message: `Approval level ${currentLevel.level} completed successfully`,
      data: {
        approvalId: approval._id,
        currentLevel: currentLevel.level,
        totalLevels: 5,
        approvedLevels: approvedLevels,
        nextLevel: approvedLevels === 5 ? null : approvedLevels + 1,
        candidateStatus: approval.status === 'approved' ? 'hired' : 'approval_in_progress'
      }
    });

  } catch (error) {
    console.error('❌ Error processing approval:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error processing approval',
      error: error.message
    });
  }
});

// Reject application (public) - for external approvers in hierarchical system
router.post('/:approvalId/reject', async (req, res) => {
  try {
    const { comments, signature, approverEmail } = req.body;

    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required'
      });
    }

    const approval = await CandidateApproval.findById(req.params.approvalId)
      .populate('candidate', 'firstName lastName email');

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Approval not found'
      });
    }

    if (approval.status !== 'pending' && approval.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Approval has already been completed or is not in progress'
      });
    }

    // Find the current pending level for this approver
    const currentLevel = approval.approvalLevels.find(
      level => level.approverEmail === approverEmail && level.status === 'pending'
    );

    if (!currentLevel) {
      return res.status(403).json({
        success: false,
        message: 'No pending approval found for this approver or approval level not found'
      });
    }

    // Update current level to rejected
    currentLevel.status = 'rejected';
    currentLevel.approver = null; // External approver, no user ID
    currentLevel.rejectedAt = new Date();
    currentLevel.comments = comments;
    currentLevel.signature = signature;

    // Rejection stops the entire approval process
    approval.status = 'rejected';
    approval.finalDecision = 'rejected';
    approval.finalDecisionAt = new Date();
    approval.completedAt = new Date();

    // Update candidate status to rejected
    await Candidate.findByIdAndUpdate(approval.candidate._id, {
      status: 'rejected'
    });

    await approval.save();

    console.log(`❌ Approval rejected at level ${currentLevel.level} by ${approverEmail}. Candidate ${approval.candidate.firstName} ${approval.candidate.lastName} is rejected.`);

    res.json({
      success: true,
      message: `Approval rejected at level ${currentLevel.level}`,
      data: {
        approvalId: approval._id,
        rejectedLevel: currentLevel.level,
        candidateStatus: 'rejected',
        reason: 'Rejected during hierarchical approval process'
      }
    });

  } catch (error) {
    console.error('Error processing rejection:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing rejection',
      error: error.message
    });
  }
});

// Get candidate's approval history (public)
router.get('/candidate/:candidateId', async (req, res) => {
  try {
    const approvals = await CandidateApproval.find({ 
      candidate: req.params.candidateId 
    })
    .populate('jobPosting', 'title company department')
    .select('status jobPosting createdAt candidateResponse')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: approvals
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching approval history',
      error: error.message
    });
  }
});

module.exports = router;
