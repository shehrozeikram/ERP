const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { asyncHandler } = require('../middleware/errorHandler');
const Application = require('../models/hr/Application');
const JobPosting = require('../models/hr/JobPosting');
const ApplicationEvaluationService = require('../services/applicationEvaluationService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/cvs');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'cv-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only PDF, DOC, and DOCX files
  const allowedTypes = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// @route   POST /api/applications/easy-apply
// @desc    Submit easy application with CV upload
// @access  Public
router.post('/', 
  upload.single('cvFile'),
  asyncHandler(async (req, res) => {
    try {
      const { affiliateCode, applicationData } = req.body;
      
      // Parse application data
      const parsedData = JSON.parse(applicationData);
      
      // Validate required fields
      if (!affiliateCode || !req.file || !parsedData.personalInfo || !parsedData.professionalInfo) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: affiliateCode, cvFile, personalInfo, or professionalInfo'
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
        'personalInfo.email': parsedData.personalInfo.email.toLowerCase()
      });

      if (existingApplication) {
        return res.status(400).json({
          success: false,
          message: 'You have already applied for this position with this email address'
        });
      }

      // Create the easy application
      const application = new Application({
        jobPosting: jobPosting._id,
        affiliateCode: affiliateCode,
        personalInfo: {
          firstName: parsedData.personalInfo.firstName,
          lastName: parsedData.personalInfo.lastName,
          email: parsedData.personalInfo.email.toLowerCase(),
          phone: parsedData.personalInfo.phone
        },
        professionalInfo: {
          currentPosition: parsedData.professionalInfo.currentPosition,
          yearsOfExperience: parsedData.professionalInfo.yearsOfExperience,
          expectedSalary: parsedData.professionalInfo.expectedSalary,
          noticePeriod: parsedData.professionalInfo.noticePeriod,
          availability: parsedData.professionalInfo.availability
        },
        additionalInfo: {
          howDidYouHear: parsedData.additionalInfo.howDidYouHear
        },
        // Store CV file information
        documents: {
          cv: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            mimetype: req.file.mimetype
          }
        },
        status: 'applied',
        submittedAt: new Date(),
        applicationType: 'easy_apply' // Mark as easy apply
      });

      await application.save();

      // Update job posting application count
      jobPosting.applications = (jobPosting.applications || 0) + 1;
      await jobPosting.save();

      // Application submitted successfully - no automatic evaluation
      console.log(`Easy application ${application._id} submitted successfully - awaiting manual review`);

      res.status(201).json({
        success: true,
        message: 'Easy application submitted successfully',
        data: {
          applicationId: application._id,
          status: application.status,
          submittedAt: application.submittedAt,
          cvFilename: req.file.filename
        }
      });

    } catch (error) {
      console.error('Error in easy apply:', error);
      
      // If file was uploaded but processing failed, delete it
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Error submitting easy application. Please try again.',
        error: error.message
      });
    }
  })
);

// @route   GET /api/applications/easy-apply/:affiliateCode/check-email/:email
// @desc    Check if email has already applied for this job posting (Easy Apply)
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
        appliedAt: existingApplication?.submittedAt || null,
        applicationType: existingApplication?.applicationType || null
      }
    });
  })
);

module.exports = router;
