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
      applicationType = 'standard',
      personalInfo,
      professionalInfo,
      education,
      skills,
      additionalInfo,
      documents
    } = req.body;

    // Validate required fields based on application type
    if (!affiliateCode || !personalInfo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: affiliateCode and personalInfo'
      });
    }

    // For standard applications, require professionalInfo
    if (applicationType === 'standard' && !professionalInfo) {
      return res.status(400).json({
        success: false,
        message: 'Professional information is required for standard applications'
      });
    }

    // For easy apply, require CV
    if (applicationType === 'easy_apply' && !documents?.cv) {
      return res.status(400).json({
        success: false,
        message: 'CV is required for easy apply applications'
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

    // Create the application with conditional fields
    const applicationData = {
      jobPosting: jobPosting._id,
      affiliateCode: affiliateCode,
      applicationType: applicationType,
      personalInfo,
      status: 'applied',
      submittedAt: new Date()
    };

    // Add optional fields for standard applications
    if (applicationType === 'standard') {
      applicationData.professionalInfo = professionalInfo;
      applicationData.education = education;
      applicationData.skills = skills;
      applicationData.additionalInfo = additionalInfo;
    }

    // Add documents
    applicationData.documents = {
      cv: documents?.cv || null,
      coverLetter: documents?.coverLetter || null,
      additionalDocuments: documents?.additionalDocuments || []
    };

    const application = new Application(applicationData);

    await application.save();

    // Update job posting application count
    jobPosting.applications = (jobPosting.applications || 0) + 1;
    await jobPosting.save();

    // Application submitted successfully - no automatic evaluation
    console.log(`Application ${application._id} submitted successfully - awaiting manual review`);

    res.status(201).json({
      success: true,
      message: applicationType === 'easy_apply' 
        ? 'Easy application submitted successfully' 
        : 'Application submitted successfully',
      data: {
        applicationId: application._id,
        status: application.status,
        submittedAt: application.submittedAt,
        applicationType: application.applicationType
      }
    });
  })
);

module.exports = router; 