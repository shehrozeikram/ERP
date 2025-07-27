const express = require('express');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Lead = require('../models/crm/Lead');
const Contact = require('../models/crm/Contact');
const Company = require('../models/crm/Company');
const Opportunity = require('../models/crm/Opportunity');
const User = require('../models/User');

const router = express.Router();

// ==================== LEADS ROUTES ====================

// @route   GET /api/crm/leads
// @desc    Get all leads with filters and pagination
// @access  Private (CRM and Admin)
router.get('/leads', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      source, 
      assignedTo, 
      business,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (source) query.source = source;
    if (assignedTo) query.assignedTo = assignedTo;
    if (business) query.business = business;

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const leads = await Lead.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Lead.countDocuments(query);

    res.json({
      success: true,
      data: {
        leads,
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

// @route   POST /api/crm/leads
// @desc    Create a new lead
// @access  Private (CRM and Admin)
router.post('/leads', [
  body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name is required and must be less than 50 characters'),
  body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name is required and must be less than 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Valid phone number is required'),
  body('company').optional().trim().isLength({ max: 100 }).withMessage('Company name must be less than 100 characters'),
  body('source').isIn(['Website', 'Social Media', 'Referral', 'Cold Call', 'Trade Show', 'Advertisement', 'Email Campaign', 'Other']).withMessage('Valid source is required'),
  body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']).withMessage('Valid priority is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const lead = new Lead({
    ...req.body,
    createdBy: req.user.id
  });

  await lead.save();

  const populatedLead = await Lead.findById(lead._id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    data: populatedLead
  });
}));

// @route   GET /api/crm/leads/:id
// @desc    Get lead by ID
// @access  Private (CRM and Admin)
router.get('/leads/:id', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: lead
    });
  })
);

// @route   PUT /api/crm/leads/:id
// @desc    Update lead
// @access  Private (CRM and Admin)
router.put('/leads/:id', [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First name must be less than 50 characters'),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last name must be less than 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Valid phone number is required'),
  body('status').optional().isIn(['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Unqualified']).withMessage('Valid status is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email');

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  res.json({
    success: true,
    data: lead
  });
}));

// @route   DELETE /api/crm/leads/:id
// @desc    Delete lead
// @access  Private (CRM and Admin)
router.delete('/leads/:id', 
  authorize('admin', 'crm_manager'), 
  asyncHandler(async (req, res) => {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  })
);

// @route   POST /api/crm/leads/:id/notes
// @desc    Add note to lead
// @access  Private (CRM and Admin)
router.post('/leads/:id/notes', [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Note content is required and must be less than 1000 characters')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  await lead.addNote(req.body.content, req.user.id);

  const updatedLead = await Lead.findById(req.params.id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  res.json({
    success: true,
    data: updatedLead
  });
}));

// ==================== COMPANIES ROUTES ====================

// @route   GET /api/crm/companies
// @desc    Get all companies with filters and pagination
// @access  Private (CRM and Admin)
router.get('/companies', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status, 
      industry, 
      assignedTo, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (industry) query.industry = industry;
    if (assignedTo) query.assignedTo = assignedTo;

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const companies = await Company.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Company.countDocuments(query);

    res.json({
      success: true,
      data: {
        companies,
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

// @route   POST /api/crm/companies
// @desc    Create a new company
// @access  Private (CRM and Admin)
router.post('/companies', [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Company name is required and must be less than 100 characters'),
  body('industry').trim().isLength({ min: 1, max: 100 }).withMessage('Industry is required and must be less than 100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Valid phone number is required'),
  body('website').optional().isURL().withMessage('Valid website URL is required'),
  body('type').optional().isIn(['Customer', 'Prospect', 'Partner', 'Vendor', 'Competitor', 'Other']).withMessage('Valid type is required'),
  body('size').optional().isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).withMessage('Valid size is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const company = new Company({
    ...req.body,
    createdBy: req.user.id
  });

  await company.save();

  const populatedCompany = await Company.findById(company._id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    data: populatedCompany
  });
}));

// @route   GET /api/crm/companies/:id
// @desc    Get company by ID
// @access  Private (CRM and Admin)
router.get('/companies/:id', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const company = await Company.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: company
    });
  })
);

// @route   PUT /api/crm/companies/:id
// @desc    Update company
// @access  Private (CRM and Admin)
router.put('/companies/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Company name must be less than 100 characters'),
  body('industry').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Industry must be less than 100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('status').optional().isIn(['Active', 'Inactive', 'Lead', 'Prospect', 'Customer', 'Former Customer']).withMessage('Valid status is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const company = await Company.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email');

  if (!company) {
    return res.status(404).json({
      success: false,
      message: 'Company not found'
    });
  }

  res.json({
    success: true,
    data: company
  });
}));

// ==================== CONTACTS ROUTES ====================

// @route   GET /api/crm/contacts
// @desc    Get all contacts with filters and pagination
// @access  Private (CRM and Admin)
router.get('/contacts', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status, 
      company, 
      assignedTo, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (company) query.company = company;
    if (assignedTo) query.assignedTo = assignedTo;

    // Search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { jobTitle: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const contacts = await Contact.find(query)
      .populate('company', 'name industry')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Contact.countDocuments(query);

    res.json({
      success: true,
      data: {
        contacts,
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

// @route   POST /api/crm/contacts
// @desc    Create a new contact
// @access  Private (CRM and Admin)
router.post('/contacts', [
  body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name is required and must be less than 50 characters'),
  body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name is required and must be less than 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('company').isMongoId().withMessage('Valid company ID is required'),
  body('phone').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Valid phone number is required'),
  body('mobile').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Valid mobile number is required'),
  body('type').optional().isIn(['Customer', 'Prospect', 'Partner', 'Vendor', 'Other']).withMessage('Valid type is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const contact = new Contact({
    ...req.body,
    createdBy: req.user.id
  });

  await contact.save();

  const populatedContact = await Contact.findById(contact._id)
    .populate('company', 'name industry')
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    data: populatedContact
  });
}));

// @route   GET /api/crm/contacts/:id
// @desc    Get contact by ID
// @access  Private (CRM and Admin)
router.get('/contacts/:id', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const contact = await Contact.findById(req.params.id)
      .populate('company', 'name industry')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      data: contact
    });
  })
);

// @route   PUT /api/crm/contacts/:id
// @desc    Update contact
// @access  Private (CRM and Admin)
router.put('/contacts/:id', [
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First name must be less than 50 characters'),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last name must be less than 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('status').optional().isIn(['Active', 'Inactive', 'Lead', 'Prospect']).withMessage('Valid status is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('company', 'name industry')
   .populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email');

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  res.json({
    success: true,
    data: contact
  });
}));

// ==================== OPPORTUNITIES ROUTES ====================

// @route   GET /api/crm/opportunities
// @desc    Get all opportunities with filters and pagination
// @access  Private (CRM and Admin)
router.get('/opportunities', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      stage, 
      company, 
      assignedTo, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (stage) query.stage = stage;
    if (company) query.company = company;
    if (assignedTo) query.assignedTo = assignedTo;

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const opportunities = await Opportunity.find(query)
      .populate('company', 'name industry')
      .populate('contact', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Opportunity.countDocuments(query);

    res.json({
      success: true,
      data: {
        opportunities,
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

// @route   POST /api/crm/opportunities
// @desc    Create a new opportunity
// @access  Private (CRM and Admin)
router.post('/opportunities', [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('company').isMongoId().withMessage('Valid company ID is required'),
  body('stage').isIn(['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']).withMessage('Valid stage is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('expectedCloseDate').isISO8601().withMessage('Valid expected close date is required'),
  body('assignedTo').isMongoId().withMessage('Valid assigned user ID is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const opportunity = new Opportunity({
    ...req.body,
    createdBy: req.user.id
  });

  await opportunity.save();

  const populatedOpportunity = await Opportunity.findById(opportunity._id)
    .populate('company', 'name industry')
    .populate('contact', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    data: populatedOpportunity
  });
}));

// @route   GET /api/crm/opportunities/:id
// @desc    Get opportunity by ID
// @access  Private (CRM and Admin)
router.get('/opportunities/:id', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.id)
      .populate('company', 'name industry')
      .populate('contact', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    res.json({
      success: true,
      data: opportunity
    });
  })
);

// @route   PUT /api/crm/opportunities/:id
// @desc    Update opportunity
// @access  Private (CRM and Admin)
router.put('/opportunities/:id', [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('stage').optional().isIn(['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']).withMessage('Valid stage is required'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('expectedCloseDate').optional().isISO8601().withMessage('Valid expected close date is required')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const opportunity = await Opportunity.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('company', 'name industry')
   .populate('contact', 'firstName lastName email')
   .populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email');

  if (!opportunity) {
    return res.status(404).json({
      success: false,
      message: 'Opportunity not found'
    });
  }

  res.json({
    success: true,
    data: opportunity
  });
}));

// @route   POST /api/crm/opportunities/:id/activities
// @desc    Add activity to opportunity
// @access  Private (CRM and Admin)
router.post('/opportunities/:id/activities', [
  body('type').isIn(['Call', 'Email', 'Meeting', 'Proposal', 'Follow-up', 'Other']).withMessage('Valid activity type is required'),
  body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject is required and must be less than 200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a positive integer'),
  body('outcome').optional().trim().isLength({ max: 500 }).withMessage('Outcome must be less than 500 characters')
], authorize('admin', 'crm_manager', 'sales_rep'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const opportunity = await Opportunity.findById(req.params.id);
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      message: 'Opportunity not found'
    });
  }

  await opportunity.addActivity({
    ...req.body,
    createdBy: req.user.id
  });

  const updatedOpportunity = await Opportunity.findById(req.params.id)
    .populate('company', 'name industry')
    .populate('contact', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  res.json({
    success: true,
    data: updatedOpportunity
  });
}));

// ==================== DASHBOARD ROUTES ====================

// @route   GET /api/crm/dashboard
// @desc    Get CRM dashboard statistics
// @access  Private (CRM and Admin)
router.get('/dashboard', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const [
      totalLeads,
      totalContacts,
      totalCompanies,
      totalOpportunities,
      leadStats,
      opportunityStats,
      pipelineSummary,
      recentActivities
    ] = await Promise.all([
      Lead.countDocuments(),
      Contact.countDocuments(),
      Company.countDocuments(),
      Opportunity.countDocuments(),
      Lead.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Opportunity.aggregate([
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]),
      Opportunity.getPipelineSummary(),
      Opportunity.find()
        .sort({ 'activities.date': -1 })
        .limit(10)
        .populate('company', 'name')
        .populate('assignedTo', 'firstName lastName')
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalLeads,
          totalContacts,
          totalCompanies,
          totalOpportunities
        },
        leadStats,
        opportunityStats,
        pipelineSummary,
        recentActivities
      }
    });
  })
);

// ==================== USERS ROUTES ====================

// @route   GET /api/crm/users
// @desc    Get users for assignment dropdowns
// @access  Private (CRM and Admin)
router.get('/users', 
  authorize('admin', 'crm_manager', 'sales_rep'), 
  asyncHandler(async (req, res) => {
    const users = await User.find({ isActive: true })
      .select('firstName lastName email role')
      .sort({ firstName: 1, lastName: 1 });

    res.json({
      success: true,
      data: users
    });
  })
);

module.exports = router; 