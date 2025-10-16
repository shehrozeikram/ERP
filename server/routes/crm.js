const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Lead = require('../models/crm/Lead');
const Contact = require('../models/crm/Contact');
const Company = require('../models/crm/Company');
const Opportunity = require('../models/crm/Opportunity');
const Department = require('../models/hr/Department');
const User = require('../models/User');

const router = express.Router();

// ==================== LEADS ROUTES ====================

// @route   GET /api/crm/leads
// @desc    Get all leads with filters and pagination
// @access  Private (CRM and Admin)
router.get('/leads', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      source, 
      assignedTo, 
      department,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (source) query.source = source;
    if (assignedTo) query.assignedTo = assignedTo;
    if (department) query.department = department;

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
      .populate('department', 'name code')
      .populate('contactId', 'firstName lastName email status')
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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Clean request body - remove empty strings for ObjectId fields
  const leadData = { ...req.body };
  if (!leadData.department || leadData.department === '') {
    delete leadData.department;
  }
  if (!leadData.assignedTo || leadData.assignedTo === '') {
    delete leadData.assignedTo;
  }

  const lead = new Lead({
    ...leadData,
    createdBy: req.user.id
  });

  await lead.save();

  const populatedLead = await Lead.findById(lead._id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('department', 'name code')
    .populate('contactId', 'firstName lastName email status');

  res.status(201).json({
    success: true,
    data: populatedLead
  });
}));

// @route   GET /api/crm/leads/:id
// @desc    Get lead by ID
// @access  Private (CRM and Admin)
router.get('/leads/:id', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('department', 'name code')
      .populate('contactId', 'firstName lastName email status');

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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Clean request body - remove empty strings for ObjectId fields
  const updateData = { ...req.body };
  if (!updateData.department || updateData.department === '') {
    delete updateData.department;
  }
  if (!updateData.assignedTo || updateData.assignedTo === '') {
    delete updateData.assignedTo;
  }

  // Get the old lead to check status change
  const oldLead = await Lead.findById(req.params.id);
  if (!oldLead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email')
   .populate('department', 'name code')
   .populate('contactId', 'firstName lastName email status');

  if (!lead) {
    return res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
  }

  // ==================== SYNCHRONIZATION LOGIC ====================
  // If lead status changed to 'Won' and has linked contact, update contact status
  if (lead.status === 'Won' && oldLead.status !== 'Won' && lead.contactId) {
    try {
      await Contact.findByIdAndUpdate(lead.contactId, {
        status: 'Active', // Convert from Lead status to Active
        isConvertedFromLead: true,
        conversionDate: new Date()
      });
    } catch (syncError) {
      // Silent error handling
    }
  }

  // If lead data updated and has linked contact, sync the data
  if (lead.contactId && !lead.autoCreatedFromContact) {
    try {
      const contactUpdateData = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        jobTitle: lead.jobTitle
      };

      if (lead.assignedTo) contactUpdateData.assignedTo = lead.assignedTo;

      await Contact.findByIdAndUpdate(lead.contactId, contactUpdateData);
    } catch (syncError) {
      // Silent error handling
    }
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
  authorize('super_admin', 'admin', 'crm_manager'), 
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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
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
      .populate('leadId', 'firstName lastName status')
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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
  
  try {
    await company.save();
  } catch (saveError) {
    return res.status(500).json({
      success: false,
      message: 'Database error while saving company',
      error: saveError.message
    });
  }

  // Create lead if company status is 'Lead'
  let createdLead = null;
  if (company.status === 'Lead') {
    try {
      const leadEmail = company.email || `${company.name.toLowerCase().replace(/\s+/g, '')}@example.com`;
      
      // Check if a lead with this email already exists
      let existingLead = await Lead.findOne({ email: leadEmail });
      
      if (existingLead) {
        // Link to existing lead
        company.leadId = existingLead._id;
        await company.save();
        createdLead = existingLead;
      } else{
        // Get a representative contact name if email exists
        let firstName = 'Company';
        let lastName = 'Representative';
        
        // Try to extract name from email if available
        if (company.email) {
          const emailParts = company.email.split('@')[0].split('.');
          if (emailParts.length >= 2) {
            firstName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
            lastName = emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1);
          }
        }

        const leadData = {
          firstName,
          lastName,
          email: leadEmail,
          phone: company.phone,
          company: company.name,
          industry: company.industry,
          companySize: company.size,
          annualRevenue: company.annualRevenue,
          source: 'Website',
          status: 'New',
          priority: 'Medium',
          autoCreatedFromContact: true, // Reusing this flag for company-created leads
          createdBy: req.user.id
        };

        // Add optional fields if they exist
        if (company.assignedTo) {
          leadData.assignedTo = company.assignedTo;
        }
        if (company.address) {
          leadData.address = company.address;
        }

        createdLead = new Lead(leadData);
        await createdLead.save();
        
        // Update company with lead reference
        company.leadId = createdLead._id;
        await company.save();
      }
    } catch (leadError) {
      // Don't fail company creation if lead creation fails
    }
  }

  const populatedCompany = await Company.findById(company._id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('leadId', 'firstName lastName status');
  
  res.status(201).json({
    success: true,
    data: populatedCompany,
    leadCreated: !!createdLead,
    leadId: createdLead?._id
  });
}));

// @route   GET /api/crm/companies/:id
// @desc    Get company by ID
// @access  Private (CRM and Admin)
router.get('/companies/:id', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const company = await Company.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('leadId', 'firstName lastName status');

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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  // Get the old company to check status change
  const oldCompany = await Company.findById(req.params.id);
  if (!oldCompany) {
    return res.status(404).json({
      success: false,
      message: 'Company not found'
    });
  }

  const company = await Company.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email')
   .populate('leadId', 'firstName lastName status');

  if (!company) {
    return res.status(404).json({
      success: false,
      message: 'Company not found'
    });
  }

  // ==================== SYNCHRONIZATION LOGIC ====================
  let leadCreated = false;
  let leadId = company.leadId;

  // Check if company status changed to 'Lead' and no lead exists yet
  if (company.status === 'Lead' && !company.leadId) {
    try {
      const leadEmail = company.email || `${company.name.toLowerCase().replace(/\s+/g, '')}@example.com`;
      
      // Check if a lead with this email already exists
      let existingLead = await Lead.findOne({ email: leadEmail });
      
      if (existingLead) {
        // Link to existing lead
        company.leadId = existingLead._id;
        await company.save();
        leadCreated = false;
        leadId = existingLead._id;
      } else {
        // Get a representative contact name if email exists
        let firstName = 'Company';
        let lastName = 'Representative';
        
        // Try to extract name from email if available
        if (company.email) {
          const emailParts = company.email.split('@')[0].split('.');
          if (emailParts.length >= 2) {
            firstName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
            lastName = emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1);
          }
        }

        const leadData = {
          firstName,
          lastName,
          email: leadEmail,
          phone: company.phone,
          company: company.name,
          industry: company.industry,
          companySize: company.size,
          annualRevenue: company.annualRevenue,
          source: 'Website',
          status: 'New',
          priority: 'Medium',
          autoCreatedFromContact: true,
          createdBy: req.user.id
        };

        // Add optional fields
        if (company.assignedTo) {
          leadData.assignedTo = company.assignedTo;
        }
        if (company.address) {
          leadData.address = company.address;
        }

        const newLead = new Lead(leadData);
        await newLead.save();
        
        // Update company with lead reference
        company.leadId = newLead._id;
        await company.save();

        leadCreated = true;
        leadId = newLead._id;
      }
    } catch (leadError) {
      // Don't fail company update if lead creation fails
    }
  }

  // If company has a lead, sync important data
  if (company.leadId && !leadCreated) {
    try {
      const leadUpdateData = {
        company: company.name,
        phone: company.phone,
        industry: company.industry,
        companySize: company.size,
        annualRevenue: company.annualRevenue
      };

      if (company.email) leadUpdateData.email = company.email;
      if (company.assignedTo) leadUpdateData.assignedTo = company.assignedTo;
      if (company.address) leadUpdateData.address = company.address;

      await Lead.findByIdAndUpdate(company.leadId, leadUpdateData);
    } catch (syncError) {
      // Silent error handling
    }
  }

  // Repopulate to get updated leadId
  const finalCompany = await Company.findById(company._id)
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('leadId', 'firstName lastName status');

  res.json({
    success: true,
    data: finalCompany,
    leadCreated,
    leadId
  });
}));

// @route   DELETE /api/crm/companies/:id
// @desc    Delete company
// @access  Private (CRM and Admin)
router.delete('/companies/:id', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    await Company.findByIdAndDelete(req.params.id);

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
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
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
      .populate('department', 'name code')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('leadId', 'firstName lastName status')
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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
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

  // Validate ObjectId fields
  if (contactData.company && !mongoose.Types.ObjectId.isValid(contactData.company)) {
    delete contactData.company;
  }
  if (contactData.department && !mongoose.Types.ObjectId.isValid(contactData.department)) {
    delete contactData.department;
  }
  if (contactData.assignedTo && !mongoose.Types.ObjectId.isValid(contactData.assignedTo)) {
    delete contactData.assignedTo;
  }
  
  const contact = new Contact({
    ...contactData,
    createdBy: req.user.id
  });

  await contact.save();

  // ==================== AUTO-CREATE LEAD IF STATUS = 'Lead' ====================
  let createdLead = null;
  if (contact.status === 'Lead') {
    try {
      // Get company name if company is referenced
      let companyName = null;
      if (contact.company && mongoose.Types.ObjectId.isValid(contact.company)) {
        const companyDoc = await Company.findById(contact.company);
        companyName = companyDoc?.name || null;
      }

      // Create lead data from contact
      const leadData = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone || contact.mobile,
        company: companyName,
        jobTitle: contact.jobTitle,
        source: contact.source || 'Website',
        status: 'New',
        priority: 'Medium',
        contactId: contact._id,
        autoCreatedFromContact: true,
        createdBy: req.user.id
      };

      // Add optional fields if they exist and are valid
      if (contact.assignedTo && mongoose.Types.ObjectId.isValid(contact.assignedTo)) {
        leadData.assignedTo = contact.assignedTo;
      }
      // Only add department if it's a valid ObjectId
      if (contact.department && mongoose.Types.ObjectId.isValid(contact.department)) {
        leadData.department = contact.department;
      }

      // Create the lead
      createdLead = new Lead(leadData);
      await createdLead.save();
      
      // Update contact with lead reference
      contact.leadId = createdLead._id;
      await contact.save();
    } catch (leadError) {
      // Don't fail contact creation if lead creation fails
    }
  }

  const populatedContact = await Contact.findById(contact._id)
    .populate('company', 'name industry')
    .populate('department', 'name code')
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('leadId', 'firstName lastName status');

  res.status(201).json({
    success: true,
    data: populatedContact,
    leadCreated: createdLead ? true : false,
    leadId: createdLead?._id
  });
}));

// @route   GET /api/crm/contacts/:id
// @desc    Get contact by ID
// @access  Private (CRM and Admin)
router.get('/contacts/:id', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const contact = await Contact.findById(req.params.id)
      .populate('company', 'name industry')
      .populate('department', 'name code')
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('leadId', 'firstName lastName status');

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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
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

  // Validate ObjectId fields
  if (contactData.company && !mongoose.Types.ObjectId.isValid(contactData.company)) {
    delete contactData.company;
  }
  if (contactData.department && !mongoose.Types.ObjectId.isValid(contactData.department)) {
    delete contactData.department;
  }
  if (contactData.assignedTo && !mongoose.Types.ObjectId.isValid(contactData.assignedTo)) {
    delete contactData.assignedTo;
  }

  // Get the old contact to check status change
  const oldContact = await Contact.findById(req.params.id);
  if (!oldContact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    contactData,
    { new: true, runValidators: true }
  ).populate('company', 'name industry')
   .populate('department', 'name code')
   .populate('assignedTo', 'firstName lastName email')
   .populate('createdBy', 'firstName lastName email')
   .populate('leadId', 'firstName lastName status');

  if (!contact) {
    return res.status(404).json({
      success: false,
      message: 'Contact not found'
    });
  }

  // ==================== SYNCHRONIZATION LOGIC ====================
  let leadCreated = false;
  let leadId = contact.leadId;

  // Case 1: Status changed TO 'Lead' - Create lead if doesn't exist
  if (contact.status === 'Lead' && oldContact.status !== 'Lead' && !contact.leadId) {
    try {
      // Get company name if company is referenced
      let companyName = null;
      if (contact.company && mongoose.Types.ObjectId.isValid(contact.company)) {
        const companyDoc = await Company.findById(contact.company);
        companyName = companyDoc?.name || null;
      }

      const leadData = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone || contact.mobile,
        company: companyName,
        jobTitle: contact.jobTitle,
        source: contact.source || 'Website',
        status: 'New',
        priority: 'Medium',
        contactId: contact._id,
        autoCreatedFromContact: true,
        createdBy: req.user.id
      };

      // Add optional fields if they exist and are valid
      if (contact.assignedTo && mongoose.Types.ObjectId.isValid(contact.assignedTo)) {
        leadData.assignedTo = contact.assignedTo;
      }
      // Only add department if it's a valid ObjectId
      if (contact.department && mongoose.Types.ObjectId.isValid(contact.department)) {
        leadData.department = contact.department;
      }

      const newLead = new Lead(leadData);
      await newLead.save();
      
      contact.leadId = newLead._id;
      await contact.save();
      
      leadCreated = true;
      leadId = newLead._id;
    } catch (leadError) {
      // Silent error handling
    }
  }

  // Case 2: Status changed FROM 'Lead' to something else - Update lead to converted
  if (oldContact.status === 'Lead' && contact.status !== 'Lead' && contact.leadId) {
    try {
      await Lead.findByIdAndUpdate(contact.leadId, {
        isConvertedToContact: true,
        conversionDate: new Date(),
        status: 'Won' // Mark as won since contact is now qualified
      });
    } catch (syncError) {
      // Silent error handling
    }
  }

  // Case 3: Contact data updated - Sync with existing lead
  if (contact.status === 'Lead' && contact.leadId) {
    try {
      // Get company name if company is referenced
      let companyName = null;
      if (contact.company && mongoose.Types.ObjectId.isValid(contact.company)) {
        const companyDoc = await Company.findById(contact.company);
        companyName = companyDoc?.name || null;
      }

      const leadUpdateData = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone || contact.mobile,
        company: companyName,
        jobTitle: contact.jobTitle
      };

      // Add optional fields if they exist and are valid
      if (contact.assignedTo && mongoose.Types.ObjectId.isValid(contact.assignedTo)) {
        leadUpdateData.assignedTo = contact.assignedTo;
      }
      // Only add department if it's a valid ObjectId
      if (contact.department && mongoose.Types.ObjectId.isValid(contact.department)) {
        leadUpdateData.department = contact.department;
      }

      await Lead.findByIdAndUpdate(contact.leadId, leadUpdateData);
    } catch (syncError) {
      // Silent error handling
    }
  }

  // Repopulate to get updated leadId
  const finalContact = await Contact.findById(contact._id)
    .populate('company', 'name industry')
    .populate('department', 'name code')
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('leadId', 'firstName lastName status');

  res.json({
    success: true,
    data: finalContact,
    leadCreated,
    leadId
  });
}));

// @route   DELETE /api/crm/contacts/:id
// @desc    Delete contact
// @access  Private (CRM and Admin)
router.delete('/contacts/:id', authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
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

  const opportunity = new Opportunity(opportunityData);

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
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
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

  res.json({
    success: true,
    data: opportunity
  });
}));

// @route   DELETE /api/crm/opportunities/:id
// @desc    Delete opportunity
// @access  Private (CRM and Admin)
router.delete('/opportunities/:id', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.id);
    
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    await Opportunity.findByIdAndDelete(req.params.id);

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
], authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), asyncHandler(async (req, res) => {
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
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const [
      totalLeads,
      totalContacts,
      totalCompanies,
      totalOpportunities,
      leadStats,
      pipelineSummary,
      recentLeads,
      recentOpportunities,
      leadSourceStats
    ] = await Promise.all([
      Lead.countDocuments(),
      Contact.countDocuments(),
      Company.countDocuments(),
      Opportunity.countDocuments(),
      // Lead status breakdown
      Lead.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      // Pipeline summary by opportunity stage
      Opportunity.aggregate([
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Recent leads for activity feed
      Lead.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('assignedTo', 'firstName lastName')
        .select('firstName lastName company status createdAt'),
      // Recent opportunities for activity feed
      Opportunity.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('company', 'name')
        .populate('assignedTo', 'firstName lastName')
        .select('title stage amount createdAt company assignedTo'),
      // Lead source statistics
      Lead.aggregate([
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    // Format recent activities from leads and opportunities
    const recentActivities = [
      ...recentLeads.map(lead => ({
        type: 'Lead',
        subject: `New Lead: ${lead.firstName} ${lead.lastName}`,
        description: `${lead.company || 'No company'} - Status: ${lead.status}`,
        date: lead.createdAt,
        duration: null
      })),
      ...recentOpportunities.map(opp => ({
        type: 'Proposal',
        subject: `Opportunity: ${opp.title}`,
        description: `${opp.company?.name || 'No company'} - ${opp.stage}`,
        date: opp.createdAt,
        duration: null
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

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
        pipelineSummary,
        recentActivities,
        leadSourceStats
      }
    });
  })
);

// ==================== USERS ROUTES ====================

// @route   GET /api/crm/users
// @desc    Get users for assignment dropdowns
// @access  Private (CRM and Admin)
router.get('/users', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
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

// ==================== DEPARTMENTS ROUTES ====================

// @route   GET /api/crm/departments
// @desc    Get all active departments for CRM dropdowns
// @access  Private (CRM and Admin)
router.get('/departments', 
  authorize('super_admin', 'admin', 'crm_manager', 'sales_manager'), 
  asyncHandler(async (req, res) => {
    const departments = await Department.find({ isActive: true })
      .select('name code description')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: departments
    });
  })
);

module.exports = router; 