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
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
  authorize('admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    console.log('=== GET COMPANIES REQUEST ===');
    console.log('User:', req.user);
    console.log('Query params:', req.query);
    
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

    console.log('Query:', query);
    console.log('Sort options:', sortOptions);
    
    const companies = await Company.find(query)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Company.countDocuments(query);
    
    console.log('Found companies:', companies.length);
    console.log('Total companies in DB:', total);
    console.log('Companies:', companies.map(c => ({ id: c._id, name: c.name })));

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
  body('phone').optional().matches(/^[\+]?[0-9][\d]{0,15}$/).withMessage('Valid phone number is required'),
  body('website').optional().custom((value) => {
    if (value && value.trim() !== '') {
      // Allow simple text if not a full URL
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return true; // Allow non-URL values
      }
      // If it starts with http/https, validate as URL
      const urlRegex = /^https?:\/\/.+/;
      if (!urlRegex.test(value)) {
        throw new Error('Valid website URL is required');
      }
    }
    return true;
  }).withMessage('Valid website URL is required'),
  body('type').optional().isIn(['Customer', 'Prospect', 'Partner', 'Vendor', 'Competitor', 'Other']).withMessage('Valid type is required'),
  body('size').optional().isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).withMessage('Valid size is required')
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  console.log('=== COMPANY CREATION REQUEST ===');
  console.log('User:', req.user);
  console.log('Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  console.log('Creating company with data:', req.body);
  
  const company = new Company({
    ...req.body,
    createdBy: req.user.id
  });

  console.log('Company object before save:', company);
  
  try {
    await company.save();
    console.log('Company saved successfully:', company._id);
  } catch (saveError) {
    console.error('Error saving company to database:', saveError);
    return res.status(500).json({
      success: false,
      message: 'Database error while saving company',
      error: saveError.message
    });
  }

  const populatedCompany = await Company.findById(company._id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  console.log('Company creation completed successfully');
  
  res.status(201).json({
    success: true,
    data: populatedCompany
  });
}));

// @route   GET /api/crm/companies/:id
// @desc    Get company by ID
// @access  Private (CRM and Admin)
router.get('/companies/:id', 
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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

// @route   DELETE /api/crm/companies/:id
// @desc    Delete company
// @access  Private (CRM and Admin)
router.delete('/companies/:id', 
  authorize('admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    console.log('=== DELETING COMPANY ===');
    console.log('Company ID:', req.params.id);
    
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      console.log('Company not found');
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    console.log('Company found, deleting...');
    await Company.findByIdAndDelete(req.params.id);
    console.log('Company deleted successfully');

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  })
);

// ==================== CONTACTS ROUTES ====================

// @route   GET /api/crm/contacts
// @desc    Get all contacts with filters and pagination
// @access  Private (CRM and Admin)
router.get('/contacts', 
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
  body('company').optional().isString().withMessage('Company must be a string'),
  body('phone').optional().custom((value) => {
    if (value && value.trim() !== '') {
      return /^[\+]?[0-9][\d]{0,15}$/.test(value);
    }
    return true;
  }).withMessage('Valid phone number is required'),
  body('mobile').optional().custom((value) => {
    if (value && value.trim() !== '') {
      return /^[\+]?[0-9][\d]{0,15}$/.test(value);
    }
    return true;
  }).withMessage('Valid mobile number is required'),
  body('type').optional().isIn(['Customer', 'Prospect', 'Partner', 'Vendor', 'Other']).withMessage('Valid type is required'),
  body('status').optional().isIn(['Active', 'Inactive', 'Lead', 'Prospect']).withMessage('Valid status is required'),
  body('preferredContactMethod').optional().isIn(['Email', 'Phone', 'Mobile', 'Mail']).withMessage('Valid preferred contact method is required'),
  body('doNotContact').optional().custom((value) => {
    if (value === undefined || value === null || value === '' || value === true || value === false) {
      return true;
    }
    return false;
  }).withMessage('Do not contact must be a boolean'),
  body('marketingOptIn').optional().custom((value) => {
    if (value === undefined || value === null || value === '' || value === true || value === false) {
      return true;
    }
    return false;
  }).withMessage('Marketing opt-in must be a boolean')
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  console.log('=== CREATING CONTACT ===');
  console.log('Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Handle company field - if it's a string, find or create the company
  let companyId = null;
  if (req.body.company && typeof req.body.company === 'string' && req.body.company.trim()) {
    let company = await Company.findOne({ name: req.body.company.trim() });
    if (!company) {
      // Create a new company if it doesn't exist
      company = new Company({
        name: req.body.company.trim(),
        industry: 'Other',
        type: 'Customer',
        status: 'Active',
        createdBy: req.user.id
      });
      await company.save();
    }
    companyId = company._id;
  }

  // Clean up the request body - remove empty strings and convert booleans
  const contactData = { ...req.body };
  Object.keys(contactData).forEach(key => {
    if (contactData[key] === '') {
      delete contactData[key];
    }
    // Convert boolean fields
    if (key === 'doNotContact' || key === 'marketingOptIn') {
      contactData[key] = Boolean(contactData[key]);
    }
  });

  console.log('Contact data to save:', { ...contactData, company: companyId, createdBy: req.user.id });
  
  const contact = new Contact({
    ...contactData,
    company: companyId,
    createdBy: req.user.id
  });

  await contact.save();
  console.log('Contact saved successfully:', contact._id);

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
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
  body('phone').optional().custom((value) => {
    if (value && value !== '') {
      const phoneRegex = /^[\+]?[0-9][\d]{0,15}$/;
      if (!phoneRegex.test(value)) {
        throw new Error('Please enter a valid phone number');
      }
    }
    return true;
  }),
  body('mobile').optional().custom((value) => {
    if (value && value !== '') {
      const phoneRegex = /^[\+]?[0-9][\d]{0,15}$/;
      if (!phoneRegex.test(value)) {
        throw new Error('Please enter a valid mobile number');
      }
    }
    return true;
  }),
  body('company').optional().isString().withMessage('Company must be a string'),
  body('status').optional().isIn(['Active', 'Inactive', 'Lead', 'Prospect']).withMessage('Valid status is required'),
  body('type').optional().isIn(['Customer', 'Prospect', 'Partner', 'Vendor', 'Other']).withMessage('Valid type is required'),
  body('doNotContact').optional().custom((value) => {
    if (value !== undefined && value !== null && value !== '' && value !== true && value !== false) {
      throw new Error('doNotContact must be a boolean');
    }
    return true;
  }),
  body('marketingOptIn').optional().custom((value) => {
    if (value !== undefined && value !== null && value !== '' && value !== true && value !== false) {
      throw new Error('marketingOptIn must be a boolean');
    }
    return true;
  })
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  console.log('=== UPDATING CONTACT ===');
  console.log('Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Handle company field - if it's a string, find or create the company
  let companyId = null;
  if (req.body.company && typeof req.body.company === 'string' && req.body.company.trim()) {
    let company = await Company.findOne({ name: req.body.company.trim() });
    if (!company) {
      // Create a new company if it doesn't exist
      company = new Company({
        name: req.body.company.trim(),
        industry: 'Other',
        type: 'Customer',
        status: 'Active',
        createdBy: req.user.id
      });
      await company.save();
    }
    companyId = company._id;
  }

  // Clean up the request body - remove empty strings and convert booleans
  const contactData = { ...req.body };
  Object.keys(contactData).forEach(key => {
    if (contactData[key] === '') {
      delete contactData[key];
    }
    // Convert boolean fields
    if (key === 'doNotContact' || key === 'marketingOptIn') {
      contactData[key] = Boolean(contactData[key]);
    }
  });

  console.log('Contact data to update:', { ...contactData, company: companyId });

  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { ...contactData, company: companyId },
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

// @route   DELETE /api/crm/contacts/:id
// @desc    Delete contact
// @access  Private (CRM and Admin)
router.delete('/contacts/:id', authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);
  
  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  await Contact.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Contact deleted successfully'
  });
}));

// ==================== OPPORTUNITIES ROUTES ====================

// @route   GET /api/crm/opportunities
// @desc    Get all opportunities with filters and pagination
// @access  Private (CRM and Admin)
router.get('/opportunities', 
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
  body('company').notEmpty().withMessage('Company is required'),
  body('stage').isIn(['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']).withMessage('Valid stage is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('expectedCloseDate').isDate().withMessage('Valid expected close date is required'),
  body('assignedTo').isMongoId().withMessage('Valid assigned user ID is required')
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  console.log('=== CREATING OPPORTUNITY ===');
  console.log('Request body:', req.body);
  console.log('Contact field value:', req.body.contact);
  console.log('Contact field type:', typeof req.body.contact);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Handle company - find by name or use as ID
  let companyId = req.body.company;
  if (req.body.company && !req.body.company.match(/^[0-9a-fA-F]{24}$/)) {
    // It's a company name, find or create the company
    let company = await Company.findOne({ name: { $regex: new RegExp(`^${req.body.company}$`, 'i') } });
    if (!company) {
      company = new Company({ 
        name: req.body.company,
        industry: 'Other', // Default industry
        createdBy: req.user.id // Set the creator
      });
      await company.save();
    }
    companyId = company._id;
  }

  // Handle contact - find by name or use as ID
  let contactId = req.body.contact;
  if (req.body.contact && req.body.contact.trim() !== '') {
    // Check if it's a valid ObjectId
    if (req.body.contact.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a valid ObjectId, verify the contact exists
      const contact = await Contact.findById(req.body.contact);
      if (!contact) {
        contactId = null; // Contact doesn't exist
      }
    } else {
      // It's a contact name, find the contact
      const contact = await Contact.findOne({ 
        $or: [
          { firstName: { $regex: new RegExp(`^${req.body.contact}$`, 'i') } },
          { lastName: { $regex: new RegExp(`^${req.body.contact}$`, 'i') } },
          { email: { $regex: new RegExp(`^${req.body.contact}$`, 'i') } }
        ]
      });
      if (contact) {
        contactId = contact._id;
      } else {
        contactId = null; // Don't set contact if not found
      }
    }
  } else {
    contactId = null; // Don't set contact if empty
  }
  
  console.log('Contact ID after processing:', contactId);

  // Remove contact from req.body to avoid conflicts
  const { contact, ...reqBodyWithoutContact } = req.body;
  
  const opportunityData = {
    ...reqBodyWithoutContact,
    company: companyId,
    createdBy: req.user.id
  };

  // Only add contact if it's provided and valid
  if (contactId && contactId !== null) {
    opportunityData.contact = contactId;
  }
  
  console.log('Final opportunity data:', opportunityData);
  console.log('Contact field in final data:', opportunityData.contact);

  const opportunity = new Opportunity(opportunityData);

  await opportunity.save();

  const populatedOpportunity = await Opportunity.findById(opportunity._id)
    .populate('company', 'name industry')
    .populate('contact', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  console.log('Opportunity created successfully:', opportunity._id);

  res.status(201).json({
    success: true,
    data: populatedOpportunity
  });
}));

// @route   GET /api/crm/opportunities/:id
// @desc    Get opportunity by ID
// @access  Private (CRM and Admin)
router.get('/opportunities/:id', 
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
  body('expectedCloseDate').optional().isDate().withMessage('Valid expected close date is required')
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  console.log('=== UPDATING OPPORTUNITY ===');
  console.log('Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Remove contact from req.body to avoid conflicts
  const { contact, ...reqBodyWithoutContact } = req.body;
  
  // Handle company - find by name or use as ID
  let updateData = { ...reqBodyWithoutContact };
  if (req.body.company && !req.body.company.match(/^[0-9a-fA-F]{24}$/)) {
    // It's a company name, find or create the company
    let company = await Company.findOne({ name: { $regex: new RegExp(`^${req.body.company}$`, 'i') } });
    if (!company) {
      company = new Company({ 
        name: req.body.company,
        industry: 'Other', // Default industry
        createdBy: req.user.id // Set the creator
      });
      await company.save();
    }
    updateData.company = company._id;
  }

  // Handle contact - find by name or use as ID
  if (req.body.contact && req.body.contact.trim() !== '') {
    // Check if it's a valid ObjectId
    if (req.body.contact.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a valid ObjectId, verify the contact exists
      const contact = await Contact.findById(req.body.contact);
      if (!contact) {
        updateData.contact = null; // Contact doesn't exist
      }
    } else {
      // It's a contact name, find the contact
      const contact = await Contact.findOne({ 
        $or: [
          { firstName: { $regex: new RegExp(`^${req.body.contact}$`, 'i') } },
          { lastName: { $regex: new RegExp(`^${req.body.contact}$`, 'i') } },
          { email: { $regex: new RegExp(`^${req.body.contact}$`, 'i') } }
        ]
      });
      if (contact) {
        updateData.contact = contact._id;
      } else {
        updateData.contact = null; // Remove contact if not found
      }
    }
  } else {
    updateData.contact = null; // Remove contact if empty
  }

  const opportunity = await Opportunity.findByIdAndUpdate(
    req.params.id,
    updateData,
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

  console.log('Opportunity updated successfully:', opportunity._id);

  res.json({
    success: true,
    data: opportunity
  });
}));

// @route   DELETE /api/crm/opportunities/:id
// @desc    Delete opportunity
// @access  Private (CRM and Admin)
router.delete('/opportunities/:id', 
  authorize('admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    console.log('=== DELETING OPPORTUNITY ===');
    console.log('Opportunity ID:', req.params.id);
    
    const opportunity = await Opportunity.findById(req.params.id);
    
    if (!opportunity) {
      console.log('Opportunity not found');
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    console.log('Opportunity found, deleting...');
    await Opportunity.findByIdAndDelete(req.params.id);
    console.log('Opportunity deleted successfully');

    res.json({
      success: true,
      message: 'Opportunity deleted successfully'
    });
  })
);

// @route   POST /api/crm/opportunities/:id/activities
// @desc    Add activity to opportunity
// @access  Private (CRM and Admin)
router.post('/opportunities/:id/activities', [
  body('type').isIn(['Call', 'Email', 'Meeting', 'Proposal', 'Follow-up', 'Other']).withMessage('Valid activity type is required'),
  body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject is required and must be less than 200 characters'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('date').isDate().withMessage('Valid activity date is required'),
  body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a positive integer'),
  body('outcome').optional().trim().isLength({ max: 500 }).withMessage('Outcome must be less than 500 characters')
], authorize('admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
  authorize('admin', 'crm_manager', 'sales_manager'), 
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
      Opportunity.getPipeline(),
      Opportunity.find()
        .sort({ createdAt: -1 })
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
  authorize('admin', 'crm_manager', 'sales_manager'), 
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