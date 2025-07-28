const express = require('express');
const { body, validationResult } = require('express-validator');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Campaign = require('../models/crm/Campaign');
const User = require('../models/User');

const router = express.Router();

// ==================== CAMPAIGNS ROUTES ====================

// @route   GET /api/campaigns
// @desc    Get all campaigns with filters and pagination
// @access  Private (CRM and Admin)
router.get('/', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status, 
      assignedTo, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    const query = {};

    // Apply filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    // Date range filter
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { targetAudience: { $regex: search, $options: 'i' } },
        { goals: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const campaigns = await Campaign.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Campaign.countDocuments(query);

    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  })
);

// @route   GET /api/campaigns/stats
// @desc    Get campaign statistics
// @access  Private (CRM and Admin)
router.get('/stats', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const stats = await Campaign.getStats();
    
    // Get campaigns by status
    const campaignsByStatus = await Campaign.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBudget: { $sum: '$budget' },
          totalRevenue: { $sum: '$actualRevenue' }
        }
      }
    ]);

    // Get campaigns by type
    const campaignsByType = await Campaign.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgConversionRate: { $avg: '$conversionRate' }
        }
      }
    ]);

    // Get top performing campaigns
    const topCampaigns = await Campaign.find({})
      .populate('assignedTo', 'firstName lastName')
      .sort({ actualRevenue: -1 })
      .limit(5)
      .select('name actualRevenue budget conversionRate assignedTo');

    res.json({
      success: true,
      data: {
        ...stats,
        campaignsByStatus,
        campaignsByType,
        topCampaigns
      }
    });
  })
);

// @route   GET /api/campaigns/:id
// @desc    Get campaign by ID
// @access  Private (CRM and Admin)
router.get('/:id', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('notes.createdBy', 'firstName lastName');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  })
);

// @route   POST /api/campaigns
// @desc    Create a new campaign
// @access  Private (CRM and Admin)
router.post('/', [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Campaign name is required and must be less than 200 characters'),
  body('type').isIn(['Email', 'Social Media', 'Direct Mail', 'Telemarketing', 'Event', 'Webinar', 'Content Marketing', 'Paid Advertising', 'Referral Program', 'Other']).withMessage('Valid campaign type is required'),
  body('status').optional().isIn(['Draft', 'Active', 'Paused', 'Completed', 'Cancelled']).withMessage('Valid status is required'),
  body('startDate').isDate().withMessage('Valid start date is required'),
  body('endDate').isDate().withMessage('Valid end date is required'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('expectedRevenue').optional().isFloat({ min: 0 }).withMessage('Expected revenue must be a positive number'),
  body('assignedTo').isMongoId().withMessage('Valid assigned user ID is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  console.log('=== CREATING CAMPAIGN ===');
  console.log('Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Validate dates
  const startDate = new Date(req.body.startDate);
  const endDate = new Date(req.body.endDate);
  
  if (startDate >= endDate) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date'
    });
  }

  // Validate assigned user exists
  const assignedUser = await User.findById(req.body.assignedTo);
  if (!assignedUser) {
    return res.status(400).json({
      success: false,
      message: 'Assigned user not found'
    });
  }

  const campaign = new Campaign({
    ...req.body,
    createdBy: req.user.id
  });

  await campaign.save();

  const populatedCampaign = await Campaign.findById(campaign._id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  console.log('Campaign created successfully:', campaign._id);

  res.status(201).json({
    success: true,
    data: populatedCampaign
  });
}));

// @route   PUT /api/campaigns/:id
// @desc    Update campaign
// @access  Private (CRM and Admin)
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Campaign name must be less than 200 characters'),
  body('type').optional().isIn(['Email', 'Social Media', 'Direct Mail', 'Telemarketing', 'Event', 'Webinar', 'Content Marketing', 'Paid Advertising', 'Referral Program', 'Other']).withMessage('Valid campaign type is required'),
  body('status').optional().isIn(['Draft', 'Active', 'Paused', 'Completed', 'Cancelled']).withMessage('Valid status is required'),
  body('startDate').optional().isDate().withMessage('Valid start date is required'),
  body('endDate').optional().isDate().withMessage('Valid end date is required'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('expectedRevenue').optional().isFloat({ min: 0 }).withMessage('Expected revenue must be a positive number'),
  body('actualRevenue').optional().isFloat({ min: 0 }).withMessage('Actual revenue must be a positive number'),
  body('conversionRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Conversion rate must be between 0 and 100'),
  body('assignedTo').optional().isMongoId().withMessage('Valid assigned user ID is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  console.log('=== UPDATING CAMPAIGN ===');
  console.log('Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: 'Campaign not found'
    });
  }

  // Validate dates if provided
  if (req.body.startDate && req.body.endDate) {
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }
  }

  // Validate assigned user if provided
  if (req.body.assignedTo) {
    const assignedUser = await User.findById(req.body.assignedTo);
    if (!assignedUser) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user not found'
      });
    }
  }

  const updatedCampaign = await Campaign.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email');

  console.log('Campaign updated successfully:', req.params.id);

  res.json({
    success: true,
    data: updatedCampaign
  });
}));

// @route   DELETE /api/campaigns/:id
// @desc    Delete campaign
// @access  Private (CRM and Admin)
router.delete('/:id', authorize('admin', 'crm_manager'), asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  
  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: 'Campaign not found'
    });
  }

  // Check if campaign is active
  if (campaign.status === 'Active') {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete an active campaign. Please pause or complete it first.'
    });
  }

  await Campaign.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Campaign deleted successfully'
  });
}));

// @route   POST /api/campaigns/:id/notes
// @desc    Add note to campaign
// @access  Private (CRM and Admin)
router.post('/:id/notes', [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Note content is required and must be less than 1000 characters')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: 'Campaign not found'
    });
  }

  await campaign.addNote(req.body.content, req.user.id);

  const updatedCampaign = await Campaign.findById(req.params.id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('notes.createdBy', 'firstName lastName');

  res.json({
    success: true,
    data: updatedCampaign
  });
}));

// @route   PUT /api/campaigns/:id/metrics
// @desc    Update campaign metrics
// @access  Private (CRM and Admin)
router.put('/:id/metrics', [
  body('impressions').optional().isInt({ min: 0 }).withMessage('Impressions must be a positive integer'),
  body('clicks').optional().isInt({ min: 0 }).withMessage('Clicks must be a positive integer'),
  body('opens').optional().isInt({ min: 0 }).withMessage('Opens must be a positive integer'),
  body('responses').optional().isInt({ min: 0 }).withMessage('Responses must be a positive integer'),
  body('meetings').optional().isInt({ min: 0 }).withMessage('Meetings must be a positive integer'),
  body('opportunities').optional().isInt({ min: 0 }).withMessage('Opportunities must be a positive integer'),
  body('deals').optional().isInt({ min: 0 }).withMessage('Deals must be a positive integer'),
  body('totalLeads').optional().isInt({ min: 0 }).withMessage('Total leads must be a positive integer'),
  body('qualifiedLeads').optional().isInt({ min: 0 }).withMessage('Qualified leads must be a positive integer'),
  body('actualRevenue').optional().isFloat({ min: 0 }).withMessage('Actual revenue must be a positive number')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) {
    return res.status(404).json({
      success: false,
      message: 'Campaign not found'
    });
  }

  // Update metrics
  if (req.body.metrics) {
    Object.keys(req.body.metrics).forEach(key => {
      if (campaign.metrics[key] !== undefined) {
        campaign.metrics[key] = req.body.metrics[key];
      }
    });
  }

  // Update other fields
  if (req.body.totalLeads !== undefined) campaign.totalLeads = req.body.totalLeads;
  if (req.body.qualifiedLeads !== undefined) campaign.qualifiedLeads = req.body.qualifiedLeads;
  if (req.body.actualRevenue !== undefined) campaign.actualRevenue = req.body.actualRevenue;

  // Calculate conversion rate if leads are provided
  if (req.body.totalLeads && req.body.totalLeads > 0) {
    campaign.conversionRate = ((req.body.qualifiedLeads || campaign.qualifiedLeads) / req.body.totalLeads) * 100;
  }

  await campaign.save();

  const updatedCampaign = await Campaign.findById(req.params.id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  res.json({
    success: true,
    data: updatedCampaign
  });
}));

module.exports = router; 