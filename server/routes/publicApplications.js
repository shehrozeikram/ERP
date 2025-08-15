const express = require('express');
const router = express.Router();
const Application = require('../models/hr/Application');
const Candidate = require('../models/hr/Candidate');
const JobPosting = require('../models/hr/JobPosting');

// Submit a new job application (public)
router.post('/submit', async (req, res) => {
  try {
    const {
      jobPostingId,
      candidateName,
      email,
      phone,
      resume,
      coverLetter,
      experience,
      education,
      skills,
      expectedSalary,
      availability
    } = req.body;

    // Validate required fields
    if (!jobPostingId || !candidateName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if job posting exists and is active
    const jobPosting = await JobPosting.findOne({
      _id: jobPostingId,
      status: 'published',
      isActive: true
    });

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or not available'
      });
    }

    // Create or update candidate
    let candidate = await Candidate.findOne({ email });
    
    if (!candidate) {
      candidate = new Candidate({
        name: candidateName,
        email,
        phone,
        experience,
        education,
        skills,
        expectedSalary,
        availability,
        source: 'Public Application'
      });
      await candidate.save();
    } else {
      // Update existing candidate
      candidate.name = candidateName;
      candidate.phone = phone;
      candidate.experience = experience;
      candidate.education = education;
      candidate.skills = skills;
      candidate.expectedSalary = expectedSalary;
      candidate.availability = availability;
      await candidate.save();
    }

    // Create application
    const application = new Application({
      jobPosting: jobPostingId,
      candidate: candidate._id,
      resume,
      coverLetter,
      status: 'Applied',
      source: 'Public'
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: application._id,
        candidateId: candidate._id
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting application',
      error: error.message
    });
  }
});

// Alias for backward compatibility
router.post('/', async (req, res) => {
  // Redirect to the submit endpoint
  req.url = '/submit';
  return router.handle(req, res);
});

// Get application status (public)
router.get('/status/:applicationId', async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId)
      .populate('jobPosting', 'title company')
      .populate('candidate', 'name email phone')
      .select('-__v -internalNotes');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      data: application
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching application status',
      error: error.message
    });
  }
});

module.exports = router;
