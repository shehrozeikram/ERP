const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const JobPosting = require('../models/hr/JobPosting');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Location = require('../models/hr/Location');

const router = express.Router();

// @route   GET /api/job-postings
// @desc    Get all job postings with pagination and filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      department,
      position,
      employmentType,
      experienceLevel,
      search
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (department) filter.department = department;
    if (position) filter.position = position;
    if (employmentType) filter.employmentType = employmentType;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { jobCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { requirements: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'department', select: 'name' },
        { path: 'position', select: 'title' },
        { path: 'location', select: 'name' },
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'approvedBy', select: 'firstName lastName' }
      ]
    };

    const jobPostings = await JobPosting.paginate(filter, options);

    res.json({
      success: true,
      data: jobPostings
    });
  })
);

// @route   GET /api/job-postings/:id
// @desc    Get job posting by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const jobPosting = await JobPosting.findById(req.params.id)
      .populate('department', 'name')
      .populate('position', 'title')
      .populate('location', 'name')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    res.json({
      success: true,
      data: jobPosting
    });
  })
);

// @route   POST /api/job-postings
// @desc    Create new job posting
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      title,
      department,
      position,
      location,
      description,
      requirements,
      responsibilities,
      qualifications,
      employmentType,
      experienceLevel,
      educationLevel,
      salaryRange,
      benefits,
      applicationDeadline,
      positionsAvailable,
      tags,
      keywords
    } = req.body;

    // Validate required fields
    if (!title || !department || !position || !description || !requirements || 
        !responsibilities || !qualifications || !experienceLevel || !educationLevel || 
        !salaryRange || !applicationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Validate salary range
    if (salaryRange.min >= salaryRange.max) {
      return res.status(400).json({
        success: false,
        message: 'Minimum salary must be less than maximum salary'
      });
    }

    // Validate application deadline
    if (new Date(applicationDeadline) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Application deadline must be in the future'
      });
    }

    const jobPosting = new JobPosting({
      title,
      department,
      position,
      location,
      description,
      requirements,
      responsibilities,
      qualifications,
      employmentType: employmentType || 'full_time',
      experienceLevel,
      educationLevel,
      salaryRange,
      benefits: benefits || [],
      applicationDeadline,
      positionsAvailable: positionsAvailable || 1,
      tags: tags || [],
      keywords: keywords || [],
      createdBy: req.user._id
    });

    await jobPosting.save();

    res.status(201).json({
      success: true,
      message: 'Job posting created successfully',
      data: jobPosting
    });
  })
);

// @route   PUT /api/job-postings/:id
// @desc    Update job posting
// @access  Private (HR and Admin)
router.put('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    // Only allow updates if job posting is in draft status
    if (jobPosting.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update job posting that is not in draft status'
      });
    }

    const updatedJobPosting = await JobPosting.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('department', 'name')
     .populate('position', 'title')
     .populate('location', 'name')
     .populate('createdBy', 'firstName lastName')
     .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Job posting updated successfully',
      data: updatedJobPosting
    });
  })
);

// @route   PUT /api/job-postings/:id/publish
// @desc    Publish job posting
// @access  Private (HR and Admin)
router.put('/:id/publish', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    if (jobPosting.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft job postings can be published'
      });
    }

    jobPosting.status = 'published';
    jobPosting.publishedAt = new Date();
    jobPosting.approvedBy = req.user._id;
    jobPosting.approvedAt = new Date();
    await jobPosting.save();

    res.json({
      success: true,
      message: 'Job posting published successfully',
      data: jobPosting
    });
  })
);

// @route   PUT /api/job-postings/:id/close
// @desc    Close job posting
// @access  Private (HR and Admin)
router.put('/:id/close', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    if (jobPosting.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Only published job postings can be closed'
      });
    }

    jobPosting.status = 'closed';
    jobPosting.closedAt = new Date();
    await jobPosting.save();

    res.json({
      success: true,
      message: 'Job posting closed successfully',
      data: jobPosting
    });
  })
);

// @route   PUT /api/job-postings/:id/cancel
// @desc    Cancel job posting
// @access  Private (HR and Admin)
router.put('/:id/cancel', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    if (jobPosting.status === 'closed' || jobPosting.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Job posting is already closed or cancelled'
      });
    }

    jobPosting.status = 'cancelled';
    jobPosting.closedAt = new Date();
    await jobPosting.save();

    res.json({
      success: true,
      message: 'Job posting cancelled successfully',
      data: jobPosting
    });
  })
);

// @route   DELETE /api/job-postings/:id
// @desc    Delete job posting
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const jobPosting = await JobPosting.findById(req.params.id);

    if (!jobPosting) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found'
      });
    }

    // Only allow deletion if job posting is in draft status
    if (jobPosting.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete job posting that is not in draft status'
      });
    }

    await JobPosting.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Job posting deleted successfully'
    });
  })
);

// @route   GET /api/job-postings/stats/overview
// @desc    Get job posting statistics
// @access  Private (HR and Admin)
router.get('/stats/overview', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const stats = await JobPosting.aggregate([
      {
        $group: {
          _id: null,
          totalJobPostings: { $sum: 1 },
          publishedJobPostings: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          draftJobPostings: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          closedJobPostings: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          },
          cancelledJobPostings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalViews: { $sum: '$views' },
          totalApplications: { $sum: '$applications' }
        }
      }
    ]);

    // Get job postings by department
    const departmentStats = await JobPosting.aggregate([
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      {
        $unwind: '$departmentInfo'
      },
      {
        $group: {
          _id: '$departmentInfo.name',
          count: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get job postings by employment type
    const employmentTypeStats = await JobPosting.aggregate([
      {
        $group: {
          _id: '$employmentType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalJobPostings: 0,
          publishedJobPostings: 0,
          draftJobPostings: 0,
          closedJobPostings: 0,
          cancelledJobPostings: 0,
          totalViews: 0,
          totalApplications: 0
        },
        byDepartment: departmentStats,
        byEmploymentType: employmentTypeStats
      }
    });
  })
);

module.exports = router; 