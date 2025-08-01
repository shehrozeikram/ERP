const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Application = require('../models/hr/Application');
const JobPosting = require('../models/hr/JobPosting');
const Candidate = require('../models/hr/Candidate');
const ApplicationEvaluationService = require('../services/applicationEvaluationService');
const EmailService = require('../services/emailService');

const router = express.Router();

// @route   GET /api/applications
// @desc    Get all applications with pagination and filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      jobPosting,
      candidate,
      search
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (jobPosting) filter.jobPosting = jobPosting;
    if (candidate) filter.candidate = candidate;
    if (search) {
      filter.$or = [
        { applicationId: { $regex: search, $options: 'i' } },
        { coverLetter: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'jobPosting', select: 'title jobCode department position' },
        { path: 'candidate', select: 'firstName lastName email phone' },
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'updatedBy', select: 'firstName lastName' }
      ]
    };

    const applications = await Application.paginate(filter, options);

    // Transform the data to include candidate info from personalInfo for public applications
    const transformedDocs = applications.docs.map(application => {
      const transformed = application.toObject();
      
          // If no candidate record exists, use personalInfo data
    if (!transformed.candidate && transformed.personalInfo) {
      transformed.candidate = {
        firstName: transformed.personalInfo.firstName,
        lastName: transformed.personalInfo.lastName,
        email: transformed.personalInfo.email,
        phone: transformed.personalInfo.phone,
        fullName: `${transformed.personalInfo.firstName} ${transformed.personalInfo.lastName}`
      };
    }
    
    // Handle expected salary from professionalInfo for public applications
    if (!transformed.expectedSalary && transformed.professionalInfo?.expectedSalary) {
      transformed.expectedSalary = transformed.professionalInfo.expectedSalary;
    }
    
          // Handle availability from professionalInfo for public applications
      if (transformed.professionalInfo?.availability) {
        transformed.availability = transformed.professionalInfo.availability;
      }
      
      // Add status labels
      const statusLabels = {
        applied: 'Applied',
        screening: 'Screening',
        shortlisted: 'Shortlisted',
        interview_scheduled: 'Interview Scheduled',
        interviewed: 'Interviewed',
        technical_test: 'Technical Test',
        reference_check: 'Reference Check',
        offer_sent: 'Offer Sent',
        offer_accepted: 'Offer Accepted',
        offer_declined: 'Offer Declined',
        hired: 'Hired',
        rejected: 'Rejected',
        withdrawn: 'Withdrawn'
      };
      
      transformed.statusLabel = statusLabels[transformed.status] || transformed.status;
      
      // Add availability labels
      const availabilityLabels = {
        immediate: 'Immediate',
        '2_weeks': '2 Weeks',
        '1_month': '1 Month',
        '2_months': '2 Months',
        '3_months': '3 Months',
        negotiable: 'Negotiable'
      };
      
      transformed.availabilityLabel = availabilityLabels[transformed.availability] || transformed.availability;
      
      // Add evaluation summary
      if (transformed.evaluation) {
        transformed.evaluationSummary = {
          isShortlisted: transformed.evaluation.isShortlisted,
          overallScore: transformed.evaluation.overallScore,
          requirementsMatch: transformed.evaluation.requirementsMatch,
          experienceMatch: transformed.evaluation.experienceMatch,
          skillsMatch: transformed.evaluation.skillsMatch,
          shortlistReason: transformed.evaluation.shortlistReason,
          evaluatedAt: transformed.evaluation.evaluatedAt
        };
      }
      
      return transformed;
    });

    res.json({
      success: true,
      data: {
        ...applications,
        docs: transformedDocs
      }
    });
  })
);

// @route   GET /api/applications/:id
// @desc    Get application by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const application = await Application.findById(req.params.id)
      .populate('jobPosting')
      .populate('candidate')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('interviews.interviewers', 'firstName lastName')
      .populate('interviews.createdBy', 'firstName lastName')
      .populate('technicalTests.assignedBy', 'firstName lastName')
      .populate('referenceChecks.assignedTo', 'firstName lastName');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Transform the data to include candidate info from personalInfo for public applications
    const transformed = application.toObject();
    
    // If no candidate record exists, use personalInfo data
    if (!transformed.candidate && transformed.personalInfo) {
      transformed.candidate = {
        firstName: transformed.personalInfo.firstName,
        lastName: transformed.personalInfo.lastName,
        email: transformed.personalInfo.email,
        phone: transformed.personalInfo.phone,
        fullName: `${transformed.personalInfo.firstName} ${transformed.personalInfo.lastName}`
      };
    }
    
    // Handle expected salary from professionalInfo for public applications
    if (!transformed.expectedSalary && transformed.professionalInfo?.expectedSalary) {
      transformed.expectedSalary = transformed.professionalInfo.expectedSalary;
    }
    
    // Handle availability from professionalInfo for public applications
    if (transformed.professionalInfo?.availability) {
      transformed.availability = transformed.professionalInfo.availability;
    }
    
    // Add status labels
    const statusLabels = {
      applied: 'Applied',
      screening: 'Screening',
      shortlisted: 'Shortlisted',
      interview_scheduled: 'Interview Scheduled',
      interviewed: 'Interviewed',
      technical_test: 'Technical Test',
      reference_check: 'Reference Check',
      offer_sent: 'Offer Sent',
      offer_accepted: 'Offer Accepted',
      offer_declined: 'Offer Declined',
      hired: 'Hired',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn'
    };
    
    transformed.statusLabel = statusLabels[transformed.status] || transformed.status;
    
    // Add availability labels
    const availabilityLabels = {
      immediate: 'Immediate',
      '2_weeks': '2 Weeks',
      '1_month': '1 Month',
      '2_months': '2 Months',
      '3_months': '3 Months',
      negotiable: 'Negotiable'
    };
    
    transformed.availabilityLabel = availabilityLabels[transformed.availability] || transformed.availability;
    
    // Add evaluation summary
    if (transformed.evaluation) {
      transformed.evaluationSummary = {
        isShortlisted: transformed.evaluation.isShortlisted,
        overallScore: transformed.evaluation.overallScore,
        requirementsMatch: transformed.evaluation.requirementsMatch,
        experienceMatch: transformed.evaluation.experienceMatch,
        skillsMatch: transformed.evaluation.skillsMatch,
        shortlistReason: transformed.evaluation.shortlistReason,
        evaluatedAt: transformed.evaluation.evaluatedAt
      };
    }

    res.json({
      success: true,
      data: transformed
    });
  })
);

// @route   POST /api/applications/bulk-evaluate
// @desc    Bulk evaluate all pending applications
// @access  Private (HR and Admin)
router.post('/bulk-evaluate', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    try {
      // Find all applications that haven't been evaluated yet
      const pendingApplications = await Application.find({
        $or: [
          { 'evaluation.evaluatedAt': { $exists: false } },
          { 'evaluation.evaluatedAt': null }
        ]
      }).populate('jobPosting');

      if (pendingApplications.length === 0) {
        return res.json({
          success: true,
          message: 'No pending applications to evaluate',
          data: {
            total: 0,
            evaluated: 0,
            shortlisted: 0
          }
        });
      }

      let evaluatedCount = 0;
      let shortlistedCount = 0;

      // Evaluate each pending application
      for (const application of pendingApplications) {
        try {
          const result = await ApplicationEvaluationService.evaluateApplication(application._id);
          if (result.success) {
            evaluatedCount++;
            if (result.evaluation.isShortlisted) {
              shortlistedCount++;
            }
          }
        } catch (error) {
          console.error(`Error evaluating application ${application._id}:`, error.message);
        }
      }

      res.json({
        success: true,
        message: `Bulk evaluation completed. ${evaluatedCount} applications evaluated, ${shortlistedCount} shortlisted.`,
        data: {
          total: pendingApplications.length,
          evaluated: evaluatedCount,
          shortlisted: shortlistedCount
        }
      });

    } catch (error) {
      console.error('Bulk evaluation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during bulk evaluation',
        error: error.message
      });
    }
  })
);

// @route   POST /api/applications/send-shortlist-emails
// @desc    Send emails to all shortlisted candidates
// @access  Private (HR and Admin)
router.post('/send-shortlist-emails', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    try {
      // Find all shortlisted applications
      const shortlistedApplications = await Application.find({
        'evaluation.isShortlisted': true
      })
        .populate('jobPosting')
        .populate('candidate');

      if (shortlistedApplications.length === 0) {
        return res.json({
          success: true,
          message: 'No shortlisted applications found',
          data: {
            total: 0,
            sent: 0,
            failed: 0
          }
        });
      }

      console.log(`📧 Sending emails to ${shortlistedApplications.length} shortlisted candidates...`);

      const emailResults = await EmailService.sendBulkShortlistNotifications(shortlistedApplications);
      
      const successful = emailResults.filter(result => result.success);
      const failed = emailResults.filter(result => !result.success);

      res.json({
        success: true,
        message: `Email notifications sent. ${successful.length} successful, ${failed.length} failed.`,
        data: {
          total: shortlistedApplications.length,
          sent: successful.length,
          failed: failed.length,
          results: emailResults
        }
      });

    } catch (error) {
      console.error('Bulk email error:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending bulk emails',
        error: error.message
      });
    }
  })
);

// @route   POST /api/applications
// @desc    Create new application
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      jobPosting,
      candidate,
      coverLetter,
      expectedSalary,
      availability
    } = req.body;

    // Validate required fields
    if (!jobPosting || !candidate) {
      return res.status(400).json({
        success: false,
        message: 'Job posting and candidate are required'
      });
    }

    // Check if job posting exists and is published
    const jobPostingDoc = await JobPosting.findById(jobPosting);
    if (!jobPostingDoc) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    if (jobPostingDoc.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply to unpublished job posting'
      });
    }

    // Check if candidate exists
    const candidateDoc = await Candidate.findById(candidate);
    if (!candidateDoc) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Check if application already exists
    const existingApplication = await Application.findOne({
      jobPosting,
      candidate
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'Application already exists for this candidate and job posting'
      });
    }

    const application = new Application({
      jobPosting,
      candidate,
      coverLetter,
      expectedSalary,
      availability: availability || 'negotiable',
      createdBy: req.user._id
    });

    await application.save();

    // Update job posting application count
    jobPostingDoc.applications += 1;
    await jobPostingDoc.save();

    res.status(201).json({
      success: true,
      message: 'Application created successfully',
      data: application
    });
  })
);

// @route   PUT /api/applications/:id/status
// @desc    Update application status
// @access  Private (HR and Admin)
router.put('/:id/status', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    application.status = status;
    application.updatedBy = req.user._id;
    await application.save();

    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: application
    });
  })
);

// @route   PUT /api/applications/:id
// @desc    Update application
// @access  Private (HR and Admin)
router.put('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      jobPosting,
      candidate,
      coverLetter,
      expectedSalary,
      availability,
      status
    } = req.body;

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Update fields if provided
    if (jobPosting) application.jobPosting = jobPosting;
    if (candidate) application.candidate = candidate;
    if (coverLetter !== undefined) application.coverLetter = coverLetter;
    if (expectedSalary !== undefined) application.expectedSalary = expectedSalary;
    if (availability) application.availability = availability;
    if (status) application.status = status;
    
    application.updatedBy = req.user._id;
    await application.save();

    res.json({
      success: true,
      message: 'Application updated successfully',
      data: application
    });
  })
);

// @route   POST /api/applications/:id/interviews
// @desc    Schedule interview for application
// @access  Private (HR and Admin)
router.post('/:id/interviews', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      type,
      scheduledDate,
      duration,
      interviewers,
      location,
      meetingLink,
      notes
    } = req.body;

    // Validate required fields
    if (!type || !scheduledDate || !interviewers || interviewers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Interview type, scheduled date, and interviewers are required'
      });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const interview = {
      type,
      scheduledDate,
      duration: duration || 60,
      interviewers,
      location,
      meetingLink,
      notes,
      createdBy: req.user._id
    };

    application.interviews.push(interview);
    application.status = 'interview_scheduled';
    application.updatedBy = req.user._id;
    await application.save();

    res.json({
      success: true,
      message: 'Interview scheduled successfully',
      data: application
    });
  })
);

// @route   PUT /api/applications/:id/interviews/:interviewId
// @desc    Update interview
// @access  Private (HR and Admin)
router.put('/:id/interviews/:interviewId', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { status, feedback } = req.body;

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const interview = application.interviews.id(req.params.interviewId);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (status) {
      interview.status = status;
      if (status === 'completed') {
        interview.completedAt = new Date();
      }
    }

    if (feedback) {
      interview.feedback = feedback;
    }

    application.updatedBy = req.user._id;
    await application.save();

    res.json({
      success: true,
      message: 'Interview updated successfully',
      data: application
    });
  })
);

// @route   POST /api/applications/:id/technical-tests
// @desc    Assign technical test to application
// @access  Private (HR and Admin)
router.post('/:id/technical-tests', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      dueDate
    } = req.body;

    // Validate required fields
    if (!name || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Test name and due date are required'
      });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const technicalTest = {
      name,
      description,
      assignedDate: new Date(),
      dueDate,
      assignedBy: req.user._id
    };

    application.technicalTests.push(technicalTest);
    application.status = 'technical_test';
    application.updatedBy = req.user._id;
    await application.save();

    res.json({
      success: true,
      message: 'Technical test assigned successfully',
      data: application
    });
  })
);

// @route   PUT /api/applications/:id/technical-tests/:testId
// @desc    Update technical test
// @access  Private (HR and Admin)
router.put('/:id/technical-tests/:testId', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { status, score, feedback } = req.body;

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    const technicalTest = application.technicalTests.id(req.params.testId);

    if (!technicalTest) {
      return res.status(404).json({
        success: false,
        message: 'Technical test not found'
      });
    }

    if (status) {
      technicalTest.status = status;
      if (status === 'completed') {
        technicalTest.completedAt = new Date();
      }
    }

    if (score !== undefined) {
      technicalTest.score = score;
    }

    if (feedback) {
      technicalTest.feedback = feedback;
    }

    application.updatedBy = req.user._id;
    await application.save();

    res.json({
      success: true,
      message: 'Technical test updated successfully',
      data: application
    });
  })
);

// @route   POST /api/applications/:id/notes
// @desc    Add note to application
// @access  Private (HR and Admin)
router.post('/:id/notes', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { content, type } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    application.notes.push({
      content,
      type: type || 'general',
      createdBy: req.user._id
    });

    await application.save();

    res.json({
      success: true,
      message: 'Note added successfully',
      data: application
    });
  })
);

// @route   DELETE /api/applications/:id
// @desc    Delete application
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    await Application.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Application deleted successfully'
    });
  })
);

// @route   GET /api/applications/stats/overview
// @desc    Get application statistics
// @access  Private (HR and Admin)
router.get('/stats/overview', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const stats = await Application.aggregate([
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          appliedApplications: {
            $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] }
          },
          screeningApplications: {
            $sum: { $cond: [{ $eq: ['$status', 'screening'] }, 1, 0] }
          },
          shortlistedApplications: {
            $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] }
          },
          interviewedApplications: {
            $sum: { $cond: [{ $eq: ['$status', 'interviewed'] }, 1, 0] }
          },
          offeredApplications: {
            $sum: { $cond: [{ $eq: ['$status', 'offer_sent'] }, 1, 0] }
          },
          hiredApplications: {
            $sum: { $cond: [{ $eq: ['$status', 'hired'] }, 1, 0] }
          },
          rejectedApplications: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get applications by status
    const statusStats = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get applications by job posting
    const jobPostingStats = await Application.aggregate([
      {
        $lookup: {
          from: 'jobpostings',
          localField: 'jobPosting',
          foreignField: '_id',
          as: 'jobPostingInfo'
        }
      },
      {
        $unwind: '$jobPostingInfo'
      },
      {
        $group: {
          _id: '$jobPostingInfo.title',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalApplications: 0,
          appliedApplications: 0,
          screeningApplications: 0,
          shortlistedApplications: 0,
          interviewedApplications: 0,
          offeredApplications: 0,
          hiredApplications: 0,
          rejectedApplications: 0
        },
        byStatus: statusStats,
        byJobPosting: jobPostingStats
      }
    });
  })
);

module.exports = router; 