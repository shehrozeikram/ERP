const express = require('express');
const router = express.Router();
const JobPosting = require('../models/hr/JobPosting');

// Get all active job postings (public)
router.get('/', async (req, res) => {
  try {
    const jobPostings = await JobPosting.find({ 
      status: 'published',
      isActive: true 
    })
    .select('description qualificationExperience responsibilities location type salaryRange department company position')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: jobPostings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job postings',
      error: error.message
    });
  }
});

// Get specific job posting by affiliate code (public)
router.get('/:affiliateCode', async (req, res) => {
  try {
    const jobPosting = await JobPosting.findOne({ 
      affiliateCode: req.params.affiliateCode,
      status: 'published',
      isActive: true 
    })
    .select('-__v -createdBy -updatedBy -internalNotes')
    .populate('department', 'name')
    .populate('position', 'title')
    .populate('location', 'name');

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or not available'
      });
    }

    // Ensure required fields have default values if missing
    const enrichedJobPosting = {
      ...jobPosting.toObject(),
      employmentType: jobPosting.employmentType || 'full_time',
      experienceLevel: jobPosting.experienceLevel || 'entry',
      salaryRange: jobPosting.salaryRange || { min: 0, max: 0, currency: 'PKR' }
    };

    res.json({
      success: true,
      data: enrichedJobPosting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching job posting',
      error: error.message
    });
  }
});

// Search job postings (public)
router.get('/search', async (req, res) => {
  try {
    const { q, location, type, department } = req.query;
    
    let searchQuery = { 
      status: 'published',
      isActive: true 
    };

    if (q) {
      searchQuery.$or = [
        { description: { $regex: q, $options: 'i' } },
        { qualificationExperience: { $regex: q, $options: 'i' } }
      ];
    }

    if (location) {
      searchQuery.location = { $regex: location, $options: 'i' };
    }

    if (type) {
      searchQuery.type = type;
    }

    if (department) {
      searchQuery.department = { $regex: department, $options: 'i' };
    }

    const jobPostings = await JobPosting.find(searchQuery)
      .select('description qualificationExperience responsibilities location type salaryRange department company position')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: jobPostings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching job postings',
      error: error.message
    });
  }
});

module.exports = router;
