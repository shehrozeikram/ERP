const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');

const router = express.Router();

// @route   GET /api/job-postings/apply/:affiliateCode
// @desc    Get job posting by affiliate code (public)
// @access  Public
router.get('/:affiliateCode', 
  asyncHandler(async (req, res) => {
    const jobPosting = await JobPosting.findOne({ 
      affiliateCode: req.params.affiliateCode,
      status: 'published'
    })
      .populate('department', 'name')
      .populate('position', 'title')
      .populate('location', 'name');

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or not available'
      });
    }

    res.json({
      success: true,
      data: jobPosting
    });
  })
);

// @route   GET /api/job-postings/apply/:affiliateCode/check-email/:email
// @desc    Check if email has already applied for this job posting
// @access  Public
router.get('/:affiliateCode/check-email/:email', 
  asyncHandler(async (req, res) => {
    const { affiliateCode, email } = req.params;

    // Find the job posting
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

    // Check if email has already applied
    const existingApplication = await Application.findOne({
      jobPosting: jobPosting._id,
      'personalInfo.email': email.toLowerCase()
    });

    res.json({
      success: true,
      data: {
        hasApplied: !!existingApplication,
        applicationId: existingApplication?._id || null,
        appliedAt: existingApplication?.submittedAt || null
      }
    });
  })
);

module.exports = router; 