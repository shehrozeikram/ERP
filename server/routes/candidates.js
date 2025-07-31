const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Candidate = require('../models/hr/Candidate');

const router = express.Router();

// @route   GET /api/candidates
// @desc    Get all candidates with pagination and filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      source,
      experienceLevel,
      availability,
      search
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (availability) filter.availability = availability;
    if (experienceLevel) {
      // Filter by years of experience
      switch (experienceLevel) {
        case 'entry':
          filter.yearsOfExperience = { $gte: 0, $lt: 2 };
          break;
        case 'junior':
          filter.yearsOfExperience = { $gte: 2, $lt: 5 };
          break;
        case 'mid':
          filter.yearsOfExperience = { $gte: 5, $lt: 8 };
          break;
        case 'senior':
          filter.yearsOfExperience = { $gte: 8, $lt: 12 };
          break;
        case 'lead':
          filter.yearsOfExperience = { $gte: 12 };
          break;
      }
    }
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { currentPosition: { $regex: search, $options: 'i' } },
        { currentCompany: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const candidates = await Candidate.paginate(filter, options);

    // Transform candidates to include email delivery status
    const transformedCandidates = candidates.docs.map(candidate => {
      const candidateObj = candidate.toObject();
      
      // Get latest email notification for shortlist
      const latestShortlistEmail = candidate.emailNotifications
        ?.filter(notification => notification.type === 'shortlist')
        ?.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
      
      // Add email delivery status
      candidateObj.emailDeliveryStatus = latestShortlistEmail ? {
        status: latestShortlistEmail.deliveryStatus,
        sentAt: latestShortlistEmail.sentAt,
        deliveredAt: latestShortlistEmail.deliveredAt,
        messageId: latestShortlistEmail.messageId,
        jobPosting: latestShortlistEmail.jobPosting
      } : null;
      
      return candidateObj;
    });

    candidates.docs = transformedCandidates;

    res.json({
      success: true,
      data: candidates
    });
  })
);

// @route   GET /api/candidates/:id
// @desc    Get candidate by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Transform candidate to include email delivery status
    const candidateObj = candidate.toObject();
    
    // Get latest email notification for shortlist
    const latestShortlistEmail = candidate.emailNotifications
      ?.filter(notification => notification.type === 'shortlist')
      ?.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
    
    // Add email delivery status
    candidateObj.emailDeliveryStatus = latestShortlistEmail ? {
      status: latestShortlistEmail.deliveryStatus,
      sentAt: latestShortlistEmail.sentAt,
      deliveredAt: latestShortlistEmail.deliveredAt,
      messageId: latestShortlistEmail.messageId,
      jobPosting: latestShortlistEmail.jobPosting
    } : null;

    res.json({
      success: true,
      data: candidateObj
    });
  })
);

// @route   POST /api/candidates
// @desc    Create new candidate
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      nationality,
      address,
      currentPosition,
      currentCompany,
      yearsOfExperience,
      expectedSalary,
      noticePeriod,
      education,
      workExperience,
      skills,
      certifications,
      languages,
      references,
      source,
      sourceDetails,
      availability,
      preferredWorkType,
      preferredLocations
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !dateOfBirth || 
        !gender || !nationality || !source) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Check if email already exists
    const existingCandidate = await Candidate.findOne({ email });
    if (existingCandidate) {
      return res.status(400).json({
        success: false,
        message: 'Candidate with this email already exists'
      });
    }

    const candidate = new Candidate({
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      nationality,
      address: address || {},
      currentPosition,
      currentCompany,
      yearsOfExperience: yearsOfExperience || 0,
      expectedSalary,
      noticePeriod: noticePeriod || 30,
      education: education || [],
      workExperience: workExperience || [],
      skills: skills || [],
      certifications: certifications || [],
      languages: languages || [],
      references: references || [],
      source,
      sourceDetails,
      availability: availability || 'negotiable',
      preferredWorkType: preferredWorkType || 'on_site',
      preferredLocations: preferredLocations || [],
      createdBy: req.user._id
    });

    await candidate.save();

    res.status(201).json({
      success: true,
      message: 'Candidate created successfully',
      data: candidate
    });
  })
);

// @route   PUT /api/candidates/:id
// @desc    Update candidate
// @access  Private (HR and Admin)
router.put('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Check if email is being changed and if it already exists
    if (req.body.email && req.body.email !== candidate.email) {
      const existingCandidate = await Candidate.findOne({ email: req.body.email });
      if (existingCandidate) {
        return res.status(400).json({
          success: false,
          message: 'Candidate with this email already exists'
        });
      }
    }

    const updatedCandidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Candidate updated successfully',
      data: updatedCandidate
    });
  })
);

// @route   PUT /api/candidates/:id/status
// @desc    Update candidate status
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

    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    candidate.status = status;
    candidate.updatedBy = req.user._id;
    await candidate.save();

    res.json({
      success: true,
      message: 'Candidate status updated successfully',
      data: candidate
    });
  })
);

// @route   POST /api/candidates/:id/notes
// @desc    Add note to candidate
// @access  Private (HR and Admin)
router.post('/:id/notes', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }

    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    candidate.notes.push({
      content,
      createdBy: req.user._id
    });

    await candidate.save();

    res.json({
      success: true,
      message: 'Note added successfully',
      data: candidate
    });
  })
);

// @route   DELETE /api/candidates/:id
// @desc    Delete candidate
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    await Candidate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  })
);

// @route   GET /api/candidates/stats/overview
// @desc    Get candidate statistics
// @access  Private (HR and Admin)
router.get('/stats/overview', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const stats = await Candidate.aggregate([
      {
        $group: {
          _id: null,
          totalCandidates: { $sum: 1 },
          activeCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          shortlistedCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] }
          },
          interviewedCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'interviewed'] }, 1, 0] }
          },
          offeredCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'offered'] }, 1, 0] }
          },
          hiredCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'hired'] }, 1, 0] }
          },
          rejectedCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          withdrawnCandidates: {
            $sum: { $cond: [{ $eq: ['$status', 'withdrawn'] }, 1, 0] }
          },
          averageExperience: { $avg: '$yearsOfExperience' }
        }
      }
    ]);

    // Get candidates by source
    const sourceStats = await Candidate.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get candidates by experience level
    const experienceStats = await Candidate.aggregate([
      {
        $bucket: {
          groupBy: '$yearsOfExperience',
          boundaries: [0, 2, 5, 8, 12, 100],
          default: '12+',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Get candidates by availability
    const availabilityStats = await Candidate.aggregate([
      {
        $group: {
          _id: '$availability',
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
          totalCandidates: 0,
          activeCandidates: 0,
          shortlistedCandidates: 0,
          interviewedCandidates: 0,
          offeredCandidates: 0,
          hiredCandidates: 0,
          rejectedCandidates: 0,
          withdrawnCandidates: 0,
          averageExperience: 0
        },
        bySource: sourceStats,
        byExperience: experienceStats,
        byAvailability: availabilityStats
      }
    });
  })
);

module.exports = router; 