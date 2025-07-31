const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const Application = require('../models/hr/Application');
const JobPosting = require('../models/hr/JobPosting');
const ApplicationEvaluationService = require('../services/applicationEvaluationService');

const router = express.Router();

// @route   POST /api/applications/public
// @desc    Submit public job application (no authentication required)
// @access  Public
router.post('/submit', 
  asyncHandler(async (req, res) => {
    const {
      affiliateCode,
      personalInfo,
      professionalInfo,
      education,
      skills,
      additionalInfo,
      documents
    } = req.body;

    // Validate required fields
    if (!affiliateCode || !personalInfo || !professionalInfo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Find the job posting by affiliate code
    const jobPosting = await JobPosting.findOne({
      affiliateCode: affiliateCode,
      status: 'published'
    });

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or not available'
      });
    }

    // Check if application deadline has passed
    if (new Date() > new Date(jobPosting.applicationDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'Application deadline has passed'
      });
    }

                    // Check if maximum applications reached
                if (jobPosting.applications >= jobPosting.positionsAvailable) {
                  return res.status(400).json({
                    success: false,
                    message: 'Maximum number of applications reached for this position'
                  });
                }

                // Check if user has already applied with this email
                const existingApplication = await Application.findOne({
                  jobPosting: jobPosting._id,
                  'personalInfo.email': personalInfo.email.toLowerCase()
                });

                if (existingApplication) {
                  return res.status(400).json({
                    success: false,
                    message: 'You have already applied for this position with this email address'
                  });
                }

    // Create the application
    const application = new Application({
      jobPosting: jobPosting._id,
      affiliateCode: affiliateCode,
      personalInfo,
      professionalInfo,
      education,
      skills,
      additionalInfo,
      // For now, we'll store document references as strings
      // In a production system, you'd want to handle file uploads properly
      documents: {
        cv: documents?.cv || null,
        coverLetter: documents?.coverLetter || null,
        additionalDocuments: documents?.additionalDocuments || []
      },
      status: 'applied',
      submittedAt: new Date()
    });

    await application.save();

    // Update job posting application count
    jobPosting.applications = (jobPosting.applications || 0) + 1;
    await jobPosting.save();

    // Automatically evaluate the application
    try {
      await ApplicationEvaluationService.evaluateApplication(application._id);
      console.log(`Application ${application._id} evaluated successfully`);
    } catch (evaluationError) {
      console.error('Error evaluating application:', evaluationError.message);
      // Don't fail the application submission if evaluation fails
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application._id,
        status: application.status,
        submittedAt: application.submittedAt
      }
    });
  })
);

module.exports = router; 